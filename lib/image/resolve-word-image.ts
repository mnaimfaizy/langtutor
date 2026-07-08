import { resolveMediaAsset } from "@/lib/content/media-assets";
import type { ContentRepository } from "@/lib/db/content-repository";
import type { MediaAsset, MediaAssetKey } from "@/lib/db/schema";

import type { ImageGenerator } from "./image-generator";
import { buildKidIllustrationPrompt, wordImageSeed } from "./prompts";

const DEFAULT_STYLE = "kid-illustration";
const IMAGE_WIDTH = 512;
const IMAGE_HEIGHT = 512;

function normalizeWord(word: string): string {
  return word.toLowerCase().trim();
}

function mediaKey(word: string, style: string): MediaAssetKey {
  return { kind: "image", key: normalizeWord(word), style };
}

/**
 * Resolve a kid-tier word illustration via the shared media store (ADR 0016).
 * On a store miss, calls `generator` once, persists the result, and serves the
 * stored asset on every subsequent lookup.
 */
export async function resolveWordImage(
  repo: ContentRepository,
  generator: ImageGenerator,
  word: string,
  style: string = DEFAULT_STYLE,
): Promise<MediaAsset> {
  const normalized = normalizeWord(word);
  const key = mediaKey(normalized, style);

  return resolveMediaAsset(repo, key, async () => {
    const prompt = buildKidIllustrationPrompt(normalized);
    const generated = await generator.generate(prompt, {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      seed: wordImageSeed(normalized),
    });

    const asset: MediaAsset = {
      ...key,
      data: generated.data,
      mimeType: generated.mimeType,
      createdAt: new Date(),
    };
    return asset;
  });
}
