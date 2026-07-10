import { resolveMediaAsset } from "@/lib/content/media-assets";
import type { ContentRepository } from "@/lib/db/content-repository";
import { defaultMediaAssetApproval, type MediaAsset, type MediaAssetKey } from "@/lib/db/schema";

import { applyTtsDurationCap } from "./truncate-audio";
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
 * Synthesize + truncate + build a pending generated audio asset (ADR 0028 / 0030).
 * Shared produce path so future admin regenerate/proactive generate reuse the same gate.
 */
export async function produceWordAudio(
  synthesizer: TtsSynthesizer,
  word: string,
  style: string = DEFAULT_STYLE,
  options?: TtsSynthesizeOptions,
): Promise<MediaAsset> {
  const normalized = normalizeWord(word);
  const key = mediaKey(normalized, style);
  const generated = await synthesizer.synthesize(normalized, options);
  const data = applyTtsDurationCap(generated.data, generated.mimeType);

  return {
    ...key,
    data,
    mimeType: generated.mimeType,
    createdAt: new Date(),
    source: "generated",
    approvalStatus: defaultMediaAssetApproval("generated"),
    prompt: null,
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
  options?: TtsSynthesizeOptions,
): Promise<MediaAsset | undefined> {
  const normalized = normalizeWord(word);
  const key = mediaKey(normalized, style);

  return resolveMediaAsset(repo, key, async () => {
    const resolved = await resolveSynthesizer(synthesizer);
    return produceWordAudio(resolved, normalized, style, options);
  });
}
