import type { ContentRepository } from "@/lib/db/content-repository";
import type { MediaAssetKey } from "@/lib/db/schema";
import { listPreA1ImageVocabulary } from "@/lib/image/pre-a1-image-vocab";

const DEFAULT_STYLE = "default";

/**
 * Pre-A1 picture words that have no audio media-asset row for the given style
 * (ADR 0026). Reuses the image gap vocabulary enumeration. Used by the admin
 * curriculum gap helper — one-at-a-time generate only (ADR 0031).
 */
export async function listMissingPreA1AudioWords(
  repo: ContentRepository,
  style: string = DEFAULT_STYLE,
): Promise<string[]> {
  const missing: string[] = [];
  for (const word of listPreA1ImageVocabulary()) {
    const key: MediaAssetKey = { kind: "audio", key: word, style };
    const existing = await repo.getMediaAssetRaw(key);
    if (!existing) missing.push(word);
  }
  return missing;
}
