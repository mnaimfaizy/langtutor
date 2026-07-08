import { resolveMediaAsset } from "@/lib/content/media-assets";
import type { ContentRepository } from "@/lib/db/content-repository";
import type { MediaAsset, MediaAssetKey } from "@/lib/db/schema";

import type { TtsSynthesizer } from "./tts-synthesizer";
import type { TtsSynthesizeOptions } from "./types";

const DEFAULT_STYLE = "default";

function normalizeWord(word: string): string {
  return word.toLowerCase().trim();
}

function mediaKey(word: string, style: string): MediaAssetKey {
  return { kind: "audio", key: normalizeWord(word), style };
}

/**
 * Resolve spoken audio for a word/phrase via the shared media store (ADR 0016).
 * On a store miss, calls `synthesizer` once, persists the result, and serves the
 * stored asset on every subsequent lookup.
 */
export async function resolveWordAudio(
  repo: ContentRepository,
  synthesizer: TtsSynthesizer,
  word: string,
  style: string = DEFAULT_STYLE,
  options?: TtsSynthesizeOptions,
): Promise<MediaAsset> {
  const normalized = normalizeWord(word);
  const key = mediaKey(normalized, style);

  return resolveMediaAsset(repo, key, async () => {
    const generated = await synthesizer.synthesize(normalized, options);

    const asset: MediaAsset = {
      ...key,
      data: generated.data,
      mimeType: generated.mimeType,
      createdAt: new Date(),
    };
    return asset;
  });
}
