"use server";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { getServerContentRepository } from "@/lib/db/server";
import type { MediaAssetApprovalStatus, MediaAssetKey, MediaAssetRecord } from "@/lib/db/schema";
import { listMissingPreA1ImageWords } from "@/lib/image/curriculum-image-gaps";
import { ImageProviderError } from "@/lib/image/errors";
import type { ImageGenerator } from "@/lib/image/image-generator";
import { buildKidIllustrationPrompt, resolveKidIllustrationPrompt } from "@/lib/image/prompts";
import { proactiveGenerateWordImage, regenerateWordImage } from "@/lib/image/resolve-word-image";
import { getImageGenerator } from "@/lib/image/server";
import {
  logImageGenerate,
  timingFromImageResult,
  type ImageGenerateTiming,
} from "@/lib/image/timing";

const DEFAULT_IMAGE_STYLE = "kid-illustration";

const ImageMediaAssetKeySchema = z.object({
  kind: z.literal("image"),
  key: z.string().trim().min(1).max(100),
  style: z.string().trim().min(1).max(64),
});

const RegenerateSchema = ImageMediaAssetKeySchema.extend({
  prompt: z.string().max(4000).optional(),
});

const ProactiveGenerateSchema = z.object({
  word: z.string().trim().min(1).max(100),
  style: z.string().trim().min(1).max(64).default(DEFAULT_IMAGE_STYLE),
  prompt: z.string().max(4000).optional(),
});

export type RegenerateMediaResult = {
  asset: MediaAssetRecord;
  timing: ImageGenerateTiming;
};

export type ProactiveGenerateResult =
  | { ok: true; asset: MediaAssetRecord; timing: ImageGenerateTiming }
  | { ok: false; code: "already_exists" | "error"; message: string };

function adminImageProviderMessage(err: ImageProviderError): string {
  const tip =
    err.provider === "cloudflare"
      ? " If this keeps happening, ensure NVIDIA_NIM_API_KEY is set so auto mode can fall back, or retry later."
      : err.provider === "nvidia"
        ? " NVIDIA free tier is capacity-limited; Cloudflare is preferred in auto mode."
        : "";
  return `${err.message}.${tip}`;
}

/**
 * Wrap the composition-root generator so admin actions can capture provider timing
 * without changing {@link regenerateWordImage} / learner resolve signatures.
 */
function timedAdminGenerator(
  operation: "regenerate" | "proactive",
  word: string,
  sink: { timing: ImageGenerateTiming },
): () => Promise<ImageGenerator> {
  return async () => {
    const gen = await getImageGenerator();
    return {
      async generate(prompt, options) {
        const result = await gen.generate(prompt, options);
        sink.timing = timingFromImageResult(result);
        logImageGenerate({ operation, word }, sink.timing);
        return result;
      },
    };
  };
}

export async function listMediaAssets(
  approvalStatus?: MediaAssetApprovalStatus,
): Promise<MediaAssetRecord[]> {
  await requireAdmin();
  const repo = await getServerContentRepository();
  return repo.queryMediaAssets({ kind: "image", approvalStatus });
}

export async function approveMediaAsset(key: MediaAssetKey): Promise<void> {
  await requireAdmin();
  ImageMediaAssetKeySchema.parse(key);
  const repo = await getServerContentRepository();
  await repo.approveMediaAsset(key);
}

export async function purgeMediaAsset(key: MediaAssetKey): Promise<void> {
  await requireAdmin();
  ImageMediaAssetKeySchema.parse(key);
  const repo = await getServerContentRepository();
  await repo.deleteMediaAsset(key);
}

/**
 * Admin regenerate with optional prompt override (ADR 0023 / 0024).
 * Replaces the row as a pending generated asset with the effective prompt stored.
 */
export async function regenerateMediaAsset(
  key: MediaAssetKey,
  prompt?: string,
): Promise<RegenerateMediaResult> {
  await requireAdmin();
  const parsed = RegenerateSchema.parse({ ...key, prompt });
  const repo = await getServerContentRepository();
  const sink: { timing: ImageGenerateTiming } = { timing: {} };
  try {
    const asset = await regenerateWordImage(
      repo,
      timedAdminGenerator("regenerate", parsed.key, sink),
      parsed.key,
      parsed.style,
      parsed.prompt,
    );
    const { data: _data, ...record } = asset;
    return { asset: record, timing: sink.timing };
  } catch (err) {
    if (err instanceof ImageProviderError) {
      throw new Error(adminImageProviderMessage(err));
    }
    throw err;
  }
}

/**
 * Admin proactive generate for a word with no media row (ADR 0020 / 0026).
 * Returns `already_exists` when the key is present — use regenerate instead (ADR 0027).
 */
export async function proactiveGenerateMediaAsset(
  word: string,
  prompt?: string,
  style: string = DEFAULT_IMAGE_STYLE,
): Promise<ProactiveGenerateResult> {
  await requireAdmin();
  let parsed: z.infer<typeof ProactiveGenerateSchema>;
  try {
    parsed = ProactiveGenerateSchema.parse({ word, style, prompt });
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
    kind: "image",
    key: normalized,
    style: parsed.style,
  });
  if (existing) {
    return {
      ok: false,
      code: "already_exists",
      message: `Image already exists for "${normalized}". Use regenerate instead.`,
    };
  }

  try {
    const sink: { timing: ImageGenerateTiming } = { timing: {} };
    const asset = await proactiveGenerateWordImage(
      repo,
      timedAdminGenerator("proactive", normalized, sink),
      parsed.word,
      parsed.style,
      parsed.prompt,
    );
    const { data: _data, ...record } = asset;
    return { ok: true, asset: record, timing: sink.timing };
  } catch (err) {
    if (err instanceof ImageProviderError) {
      return { ok: false, code: "error", message: adminImageProviderMessage(err) };
    }
    const message = err instanceof Error ? err.message : "Generation failed";
    if (/already exists/i.test(message)) {
      return { ok: false, code: "already_exists", message };
    }
    return { ok: false, code: "error", message };
  }
}

/** Pre-A1 picture words missing an image row for the default kid-illustration style. */
export async function listImageCurriculumGaps(
  style: string = DEFAULT_IMAGE_STYLE,
): Promise<string[]> {
  await requireAdmin();
  const parsedStyle = z.string().trim().min(1).max(64).parse(style);
  const repo = await getServerContentRepository();
  return listMissingPreA1ImageWords(repo, parsedStyle);
}

/** Prior stored prompt, or the default kid-illustration template when missing/curated. */
export async function getRegeneratePromptDraft(key: MediaAssetKey): Promise<string> {
  await requireAdmin();
  const parsed = ImageMediaAssetKeySchema.parse(key);
  const repo = await getServerContentRepository();
  const asset = await repo.getMediaAssetRaw(parsed);
  return resolveKidIllustrationPrompt(parsed.key, asset?.prompt);
}

/** Default kid-illustration prompt draft for proactive generate of @word. */
export async function getProactivePromptDraft(word: string): Promise<string> {
  await requireAdmin();
  const parsed = z.string().trim().min(1).max(100).parse(word);
  return buildKidIllustrationPrompt(parsed.toLowerCase());
}

export async function getMediaAssetPreview(key: MediaAssetKey): Promise<string | null> {
  await requireAdmin();
  ImageMediaAssetKeySchema.parse(key);
  const repo = await getServerContentRepository();
  const asset = await repo.getMediaAssetRaw(key);
  if (!asset || asset.kind !== "image") return null;
  const base64 = Buffer.from(asset.data).toString("base64");
  return `data:${asset.mimeType};base64,${base64}`;
}
