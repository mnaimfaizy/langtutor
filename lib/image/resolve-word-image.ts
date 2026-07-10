import { resolveMediaAsset } from "@/lib/content/media-assets";
import type { ContentRepository } from "@/lib/db/content-repository";
import { defaultMediaAssetApproval, type MediaAsset, type MediaAssetKey } from "@/lib/db/schema";

import type { ImageGenerator } from "./image-generator";
import { buildKidIllustrationPrompt, wordImageSeed } from "./prompts";

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
): Promise<MediaAsset> {
  const prompt = buildKidIllustrationPrompt(normalized);
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
 * Admin-only: delete the existing asset for @word and generate a fresh pending image.
 */
export async function regenerateWordImage(
  repo: ContentRepository,
  generator: ImageGeneratorSource,
  word: string,
  style: string = DEFAULT_STYLE,
): Promise<MediaAsset> {
  const normalized = normalizeWord(word);
  const key = mediaKey(normalized, style);

  await repo.deleteMediaAsset(key);
  const asset = await resolveMediaAsset(
    repo,
    key,
    async () => {
      const resolved = await resolveGenerator(generator);
      return produceWordImage(resolved, normalized, style);
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
