import { resolveMediaAsset } from "@/lib/content/media-assets";
import type { ContentRepository } from "@/lib/db/content-repository";
import { defaultMediaAssetApproval, type MediaAsset, type MediaAssetKey } from "@/lib/db/schema";

import type { ImageGenerator } from "./image-generator";
import { resolveKidIllustrationPrompt, wordImageSeed } from "./prompts";

const DEFAULT_STYLE = "kid-illustration";
/** Hosted NIM FLUX rejects 512; use an allowed square size (see nvidia-sizes.ts). */
const IMAGE_WIDTH = 1024;
const IMAGE_HEIGHT = 1024;

/** Concrete generator, or a factory so store hits never need NVIDIA credentials. */
export type ImageGeneratorSource =
  | ImageGenerator
  | (() => ImageGenerator | Promise<ImageGenerator>);

function normalizeWord(word: string): string {
  return word.toLowerCase().trim();
}

function mediaKey(word: string, style: string): MediaAssetKey {
  return { kind: "image", key: normalizeWord(word), style };
}

async function resolveGenerator(source: ImageGeneratorSource): Promise<ImageGenerator> {
  return typeof source === "function" ? await source() : source;
}

async function produceWordImage(
  generator: ImageGenerator,
  normalized: string,
  style: string,
  promptOverride?: string | null,
): Promise<MediaAsset> {
  const prompt = resolveKidIllustrationPrompt(normalized, promptOverride);
  const generated = await generator.generate(prompt, {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    seed: wordImageSeed(normalized),
  });

  return {
    kind: "image",
    key: normalized,
    style,
    data: generated.data,
    mimeType: generated.mimeType,
    createdAt: new Date(),
    source: "generated",
    approvalStatus: defaultMediaAssetApproval("generated"),
    prompt,
  };
}

/**
 * Resolve a kid-tier word illustration via the shared media store (ADR 0016).
 * On a store miss, calls `generator` once, persists the result as `pending`, and
 * returns the asset only once an admin has approved it.
 *
 * Pass a factory `() => getImageGenerator()` from route handlers so approved /
 * pending cache hits never require NVIDIA credentials (e2e + offline learners).
 */
export async function resolveWordImage(
  repo: ContentRepository,
  generator: ImageGeneratorSource,
  word: string,
  style: string = DEFAULT_STYLE,
): Promise<MediaAsset | undefined> {
  const normalized = normalizeWord(word);
  const key = mediaKey(normalized, style);

  return resolveMediaAsset(repo, key, async () => {
    const resolved = await resolveGenerator(generator);
    return produceWordImage(resolved, normalized, style);
  });
}

/**
 * Admin-only: generate a fresh pending image and replace the store row.
 * Does **not** delete first — if generation fails, the previous asset is kept.
 * Optional `promptOverride` steers the generation (ADR 0023); the effective prompt is
 * persisted on the new generated row (ADR 0024).
 */
export async function regenerateWordImage(
  repo: ContentRepository,
  generator: ImageGeneratorSource,
  word: string,
  style: string = DEFAULT_STYLE,
  promptOverride?: string | null,
): Promise<MediaAsset> {
  const normalized = normalizeWord(word);
  const key = mediaKey(normalized, style);

  const asset = await resolveMediaAsset(
    repo,
    key,
    async () => {
      const resolved = await resolveGenerator(generator);
      return produceWordImage(resolved, normalized, style, promptOverride);
    },
    {
      forceRegenerate: true,
    },
  );
  if (!asset) {
    throw new Error("Image regeneration failed");
  }
  return asset;
}

/**
 * Admin-only: create a pending image for a word with no store row (ADR 0020 / 0026).
 * Rejects when a row already exists — use {@link regenerateWordImage} instead (ADR 0027).
 * Optional `promptOverride` reuses the same produce path as regenerate (ADR 0023 / 0024).
 */
export async function proactiveGenerateWordImage(
  repo: ContentRepository,
  generator: ImageGeneratorSource,
  word: string,
  style: string = DEFAULT_STYLE,
  promptOverride?: string | null,
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
      const resolved = await resolveGenerator(generator);
      return produceWordImage(resolved, normalized, style, promptOverride);
    },
    { createIfAbsent: true },
  );
  if (!asset) {
    throw new Error("Image proactive generate failed");
  }
  return asset;
}
