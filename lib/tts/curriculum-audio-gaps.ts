import type { ContentRepository } from "@/lib/db/content-repository";
import type { MediaAssetKey } from "@/lib/db/schema";
import { listPreA1MediaGapVocabulary } from "@/lib/image/curriculum-image-gaps";

const DEFAULT_STYLE = "default";

/**
 * Pre-A1 vocabulary that has no audio media-asset row for the given style
 * (ADR 0026). Uses the same gap vocabulary as images (bundled lists + shared path
 * catalog target vocab). Used by the admin curriculum gap helper — one-at-a-time
 * generate only (ADR 0031).
 */
export async function listMissingPreA1AudioWords(
  repo: ContentRepository,
  style: string = DEFAULT_STYLE,
): Promise<string[]> {
  const missing: string[] = [];
  for (const word of await listPreA1MediaGapVocabulary(repo)) {
    const key: MediaAssetKey = { kind: "audio", key: word, style };
    const existing = await repo.getMediaAssetRaw(key);
    if (!existing) missing.push(word);
  }
  return missing;
}
