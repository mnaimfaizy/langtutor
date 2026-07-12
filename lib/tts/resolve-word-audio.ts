import { resolveMediaAsset } from "@/lib/content/media-assets";
import type { ContentRepository } from "@/lib/db/content-repository";
import { defaultMediaAssetApproval, type MediaAsset, type MediaAssetKey } from "@/lib/db/schema";

import { resolveSpokenText } from "./prompts";
import { applyTtsDurationCap, TTS_MAX_DURATION_SECONDS } from "./truncate-audio";
import type { TtsSynthesizer } from "./tts-synthesizer";
import type { TtsSynthesizeOptions } from "./types";

const DEFAULT_STYLE = "default";
const MIN_ADMIN_DURATION_SECONDS = 0.5;

/** Concrete synthesizer, or a factory so store hits never need Groq credentials. */
export type TtsSynthesizerSource =
  | TtsSynthesizer
  | (() => TtsSynthesizer | Promise<TtsSynthesizer>);

/**
 * Admin TTS knobs (ADR 0022): voice/rate forwarded to the synthesizer; optional
 * soft truncate target clamped to the hard ~5s cap (ADR 0030); optional spoken-text
 * / vocal-direction override persisted on the asset (ADR 0044).
 */
export type AdminAudioGenerateOptions = TtsSynthesizeOptions & {
  maxDurationSeconds?: number;
  /** Spoken text sent to TTS (may include Orpheus `[direction]` tags). */
  prompt?: string;
};

function normalizeWord(word: string): string {
  return word.toLowerCase().trim();
}

function mediaKey(word: string, style: string): MediaAssetKey {
  return { kind: "audio", key: normalizeWord(word), style };
}

async function resolveSynthesizer(source: TtsSynthesizerSource): Promise<TtsSynthesizer> {
  return typeof source === "function" ? await source() : source;
}

function clampMaxDurationSeconds(maxDurationSeconds?: number): number {
  if (maxDurationSeconds === undefined) return TTS_MAX_DURATION_SECONDS;
  return Math.min(
    TTS_MAX_DURATION_SECONDS,
    Math.max(MIN_ADMIN_DURATION_SECONDS, maxDurationSeconds),
  );
}

function toSynthesizeOptions(
  options?: AdminAudioGenerateOptions,
): TtsSynthesizeOptions | undefined {
  if (!options) return undefined;
  const { rate, voiceUri } = options;
  if (rate === undefined && voiceUri === undefined) return undefined;
  return { rate, voiceUri };
}

/**
 * Synthesize + truncate + build a pending generated audio asset (ADR 0028 / 0030).
 * Shared produce path for learner resolve and admin regenerate/proactive generate.
 * Effective spoken text is persisted on `prompt` (ADR 0044).
 */
export async function produceWordAudio(
  synthesizer: TtsSynthesizer,
  word: string,
  style: string = DEFAULT_STYLE,
  options?: AdminAudioGenerateOptions,
): Promise<MediaAsset> {
  const normalized = normalizeWord(word);
  const key = mediaKey(normalized, style);
  const spokenText = resolveSpokenText(normalized, options?.prompt);
  const generated = await synthesizer.synthesize(spokenText, toSynthesizeOptions(options));
  const data = applyTtsDurationCap(
    generated.data,
    generated.mimeType,
    clampMaxDurationSeconds(options?.maxDurationSeconds),
  );

  return {
    ...key,
    data,
    mimeType: generated.mimeType,
    createdAt: new Date(),
    source: "generated",
    approvalStatus: defaultMediaAssetApproval("generated"),
    prompt: spokenText,
  };
}

/**
 * Resolve spoken audio for a word/phrase via the shared media store (ADR 0016).
 * On a store miss, synthesizes once, truncates to the TTS duration cap, persists
 * as `pending`, and returns the asset only once an admin has approved it
 * (ADR 0028 / 0030).
 *
 * Pass a factory `() => getTtsSynthesizer()` from route handlers so approved /
 * pending cache hits never require GROQ_API_KEY.
 */
export async function resolveWordAudio(
  repo: ContentRepository,
  synthesizer: TtsSynthesizerSource,
  word: string,
  style: string = DEFAULT_STYLE,
  options?: AdminAudioGenerateOptions,
): Promise<MediaAsset | undefined> {
  const normalized = normalizeWord(word);
  const key = mediaKey(normalized, style);

  return resolveMediaAsset(repo, key, async () => {
    const resolved = await resolveSynthesizer(synthesizer);
    return produceWordAudio(resolved, normalized, style, options);
  });
}

/**
 * Admin-only: delete the existing asset for @word and synthesize a fresh pending clip
 * with optional TTS knobs and spoken-text override (ADR 0022 / 0028 / 0030 / 0044).
 */
export async function regenerateWordAudio(
  repo: ContentRepository,
  synthesizer: TtsSynthesizerSource,
  word: string,
  style: string = DEFAULT_STYLE,
  options?: AdminAudioGenerateOptions,
): Promise<MediaAsset> {
  const normalized = normalizeWord(word);
  const key = mediaKey(normalized, style);

  await repo.deleteMediaAsset(key);
  const asset = await resolveMediaAsset(
    repo,
    key,
    async () => {
      const resolved = await resolveSynthesizer(synthesizer);
      return produceWordAudio(resolved, normalized, style, options);
    },
    { forceRegenerate: true },
  );
  if (!asset) {
    throw new Error("Audio regeneration failed");
  }
  return asset;
}

/**
 * Admin-only: create a pending audio clip for a word with no store row (ADR 0020 / 0026).
 * Rejects when a row already exists — use {@link regenerateWordAudio} instead (ADR 0027).
 * Optional `prompt` on options reuses the same produce path as regenerate (ADR 0044).
 */
export async function proactiveGenerateWordAudio(
  repo: ContentRepository,
  synthesizer: TtsSynthesizerSource,
  word: string,
  style: string = DEFAULT_STYLE,
  options?: AdminAudioGenerateOptions,
): Promise<MediaAsset> {
  const normalized = normalizeWord(word);
  if (!normalized) {
    throw new Error("Word is required");
  }
  const key = mediaKey(normalized, style);

  const asset = await resolveMediaAsset(
    repo,
    key,
    async () => {
      const resolved = await resolveSynthesizer(synthesizer);
      return produceWordAudio(resolved, normalized, style, options);
    },
    { createIfAbsent: true },
  );
  if (!asset) {
    throw new Error("Audio proactive generate failed");
  }
  return asset;
}
