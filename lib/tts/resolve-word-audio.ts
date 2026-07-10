import { resolveMediaAsset } from "@/lib/content/media-assets";
import type { ContentRepository } from "@/lib/db/content-repository";
import type { MediaAsset, MediaAssetKey } from "@/lib/db/schema";

import type { TtsSynthesizer } from "./tts-synthesizer";
import type { TtsSynthesizeOptions } from "./types";

const DEFAULT_STYLE = "default";

/** Concrete synthesizer, or a factory so store hits never need Groq credentials. */
export type TtsSynthesizerSource =
  | TtsSynthesizer
  | (() => TtsSynthesizer | Promise<TtsSynthesizer>);

function normalizeWord(word: string): string {
  return word.toLowerCase().trim();
}

function mediaKey(word: string, style: string): MediaAssetKey {
  return { kind: "audio", key: normalizeWord(word), style };
}

async function resolveSynthesizer(source: TtsSynthesizerSource): Promise<TtsSynthesizer> {
  return typeof source === "function" ? await source() : source;
}

/**
 * Resolve spoken audio for a word/phrase via the shared media store (ADR 0016).
 * On a store miss, calls `synthesizer` once, persists the result, and serves the
 * stored asset on every subsequent lookup.
 *
 * Pass a factory `() => getTtsSynthesizer()` from route handlers so cache hits
 * never require GROQ_API_KEY.
 */
export async function resolveWordAudio(
  repo: ContentRepository,
  synthesizer: TtsSynthesizerSource,
  word: string,
  style: string = DEFAULT_STYLE,
  options?: TtsSynthesizeOptions,
): Promise<MediaAsset> {
  const normalized = normalizeWord(word);
  const key = mediaKey(normalized, style);

  return resolveMediaAsset(repo, key, async () => {
    const resolved = await resolveSynthesizer(synthesizer);
    const generated = await resolved.synthesize(normalized, options);

    const asset: MediaAsset = {
      ...key,
      data: generated.data,
      mimeType: generated.mimeType,
      createdAt: new Date(),
      source: "generated",
      approvalStatus: "approved",
      prompt: null,
    };
    return asset;
  }).then((asset) => {
    if (!asset) throw new Error("Audio resolution failed");
    return asset;
  });
}
