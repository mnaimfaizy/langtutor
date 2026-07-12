"use server";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { getServerContentRepository } from "@/lib/db/server";
import type { MediaAssetApprovalStatus, MediaAssetKey, MediaAssetRecord } from "@/lib/db/schema";
import { listMissingPreA1AudioWords } from "@/lib/tts/curriculum-audio-gaps";
import {
  parseSpokenText,
  TTS_MAX_SPOKEN_TEXT_CHARS,
  type SpokenTextParts,
} from "@/lib/tts/prompts";
import {
  proactiveGenerateWordAudio,
  regenerateWordAudio,
  type AdminAudioGenerateOptions,
} from "@/lib/tts/resolve-word-audio";
import { getTtsSynthesizer } from "@/lib/tts/server";
import { GROQ_ORPHEUS_VOICES } from "@/lib/tts/speech-synthesis";
import { estimateWavDurationSeconds, TTS_MAX_DURATION_SECONDS } from "@/lib/tts/truncate-audio";

const DEFAULT_AUDIO_STYLE = "default";

const ORPHEUS_VOICE_URIS = GROQ_ORPHEUS_VOICES.map((v) => v.voiceURI) as [string, ...string[]];

const AudioMediaAssetKeySchema = z.object({
  kind: z.literal("audio"),
  key: z.string().trim().min(1).max(100),
  style: z.string().trim().min(1).max(64),
});

const AdminTtsOptionsSchema = z.object({
  rate: z.number().min(0.5).max(2).optional(),
  voiceUri: z.enum(ORPHEUS_VOICE_URIS).optional(),
  maxDurationSeconds: z.number().min(0.5).max(TTS_MAX_DURATION_SECONDS).optional(),
  prompt: z.string().max(TTS_MAX_SPOKEN_TEXT_CHARS).optional(),
});

const RegenerateSchema = AudioMediaAssetKeySchema.extend({
  options: AdminTtsOptionsSchema.optional(),
});

const ProactiveGenerateSchema = z.object({
  word: z.string().trim().min(1).max(100),
  style: z.string().trim().min(1).max(64).default(DEFAULT_AUDIO_STYLE),
  options: AdminTtsOptionsSchema.optional(),
});

export type AudioPreview = {
  dataUrl: string;
  /** Approximate duration in seconds from the WAV header; null when unknown. */
  durationSeconds: number | null;
};

export type ProactiveAudioGenerateResult =
  | { ok: true; asset: MediaAssetRecord }
  | { ok: false; code: "already_exists" | "error"; message: string };

export type AdminAudioTtsOptions = AdminAudioGenerateOptions;

export type AudioPromptDraft = SpokenTextParts;

function toAdminOptions(
  options?: z.infer<typeof AdminTtsOptionsSchema>,
): AdminAudioGenerateOptions | undefined {
  if (!options) return undefined;
  const out: AdminAudioGenerateOptions = {};
  if (options.rate !== undefined) out.rate = options.rate;
  if (options.voiceUri !== undefined) out.voiceUri = options.voiceUri;
  if (options.maxDurationSeconds !== undefined) {
    out.maxDurationSeconds = options.maxDurationSeconds;
  }
  const trimmedPrompt = options.prompt?.trim();
  if (trimmedPrompt) out.prompt = trimmedPrompt;
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function listAudioMediaAssets(
  approvalStatus?: MediaAssetApprovalStatus,
): Promise<MediaAssetRecord[]> {
  await requireAdmin();
  const repo = await getServerContentRepository();
  return repo.queryMediaAssets({ kind: "audio", approvalStatus });
}

export async function approveAudioMediaAsset(key: MediaAssetKey): Promise<void> {
  await requireAdmin();
  AudioMediaAssetKeySchema.parse(key);
  const repo = await getServerContentRepository();
  await repo.approveMediaAsset(key);
}

export async function purgeAudioMediaAsset(key: MediaAssetKey): Promise<void> {
  await requireAdmin();
  AudioMediaAssetKeySchema.parse(key);
  const repo = await getServerContentRepository();
  await repo.deleteMediaAsset(key);
}

/**
 * Admin regenerate with optional TTS knobs + spoken-text override (ADR 0022 / 0044).
 * Replaces the row as a pending generated asset (ADR 0028 / 0030).
 */
export async function regenerateAudioMediaAsset(
  key: MediaAssetKey,
  options?: AdminAudioTtsOptions,
): Promise<MediaAssetRecord> {
  await requireAdmin();
  const parsed = RegenerateSchema.parse({ ...key, options });
  const repo = await getServerContentRepository();
  const asset = await regenerateWordAudio(
    repo,
    () => getTtsSynthesizer(),
    parsed.key,
    parsed.style,
    toAdminOptions(parsed.options),
  );
  const { data: _data, ...record } = asset;
  return record;
}

/**
 * Admin proactive generate for a word with no audio row (ADR 0020 / 0026).
 * Returns `already_exists` when the key is present — use regenerate instead (ADR 0027).
 */
export async function proactiveGenerateAudioMediaAsset(
  word: string,
  options?: AdminAudioTtsOptions,
  style: string = DEFAULT_AUDIO_STYLE,
): Promise<ProactiveAudioGenerateResult> {
  await requireAdmin();
  let parsed: z.infer<typeof ProactiveGenerateSchema>;
  try {
    parsed = ProactiveGenerateSchema.parse({ word, style, options });
  } catch (err) {
    return {
      ok: false,
      code: "error",
      message: err instanceof Error ? err.message : "Invalid request",
    };
  }

  const repo = await getServerContentRepository();
  const normalized = parsed.word.toLowerCase();
  const existing = await repo.getMediaAssetRaw({
    kind: "audio",
    key: normalized,
    style: parsed.style,
  });
  if (existing) {
    return {
      ok: false,
      code: "already_exists",
      message: `Audio already exists for "${normalized}". Use regenerate instead.`,
    };
  }

  try {
    const asset = await proactiveGenerateWordAudio(
      repo,
      () => getTtsSynthesizer(),
      parsed.word,
      parsed.style,
      toAdminOptions(parsed.options),
    );
    const { data: _data, ...record } = asset;
    return { ok: true, asset: record };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    if (/already exists/i.test(message)) {
      return { ok: false, code: "already_exists", message };
    }
    return { ok: false, code: "error", message };
  }
}

/** Pre-A1 picture words missing an audio row for the default style. */
export async function listAudioCurriculumGaps(
  style: string = DEFAULT_AUDIO_STYLE,
): Promise<string[]> {
  await requireAdmin();
  const parsedStyle = z.string().trim().min(1).max(64).parse(style);
  const repo = await getServerContentRepository();
  return listMissingPreA1AudioWords(repo, parsedStyle);
}

/** Prior stored say + direction, or the word when missing (ADR 0044). */
export async function getRegenerateAudioPromptDraft(key: MediaAssetKey): Promise<AudioPromptDraft> {
  await requireAdmin();
  const parsed = AudioMediaAssetKeySchema.parse(key);
  const repo = await getServerContentRepository();
  const asset = await repo.getMediaAssetRaw(parsed);
  return parseSpokenText(asset?.prompt, parsed.key);
}

/** Default say/direction draft for proactive generate of @word. */
export async function getProactiveAudioPromptDraft(word: string): Promise<AudioPromptDraft> {
  await requireAdmin();
  const parsed = z.string().trim().min(1).max(100).parse(word);
  return parseSpokenText(null, parsed);
}

export async function getAudioMediaAssetPreview(key: MediaAssetKey): Promise<AudioPreview | null> {
  await requireAdmin();
  AudioMediaAssetKeySchema.parse(key);
  const repo = await getServerContentRepository();
  const asset = await repo.getMediaAssetRaw(key);
  if (!asset || asset.kind !== "audio") return null;
  const base64 = Buffer.from(asset.data).toString("base64");
  const durationSeconds = asset.mimeType.toLowerCase().includes("wav")
    ? estimateWavDurationSeconds(asset.data)
    : null;
  return {
    dataUrl: `data:${asset.mimeType};base64,${base64}`,
    durationSeconds,
  };
}
