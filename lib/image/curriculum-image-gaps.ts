import type { ContentRepository } from "@/lib/db/content-repository";
import type { MediaAssetKey } from "@/lib/db/schema";
import {
  listSharedPathCatalogVocabulary,
  normalizeSharedPathTargetVocab,
} from "@/lib/path/shared-path-media-readiness";

import { listPreA1ImageVocabulary } from "./pre-a1-image-vocab";

const DEFAULT_STYLE = "kid-illustration";

/**
 * Full pre-A1 media vocabulary for curriculum gaps: bundled activity wordlists plus
 * target vocab from pending/approved shared path catalog templates.
 */
export async function listPreA1MediaGapVocabulary(
  repo: Pick<ContentRepository, "querySharedPathUnitTemplates">,
): Promise<string[]> {
  const catalog = await listSharedPathCatalogVocabulary(repo);
  return normalizeSharedPathTargetVocab([...listPreA1ImageVocabulary(), ...catalog]).sort((a, b) =>
    a.localeCompare(b),
  );
}

/**
 * Pre-A1 picture words that have no media-asset row for the given style (ADR 0026).
 * Includes shared-path draft/approved target vocab so admin can generate media for
 * densification units (not only the hardcoded activity lists).
 * Used by the admin curriculum gap helper — one-at-a-time generate only (ADR 0031).
 */
export async function listMissingPreA1ImageWords(
  repo: ContentRepository,
  style: string = DEFAULT_STYLE,
): Promise<string[]> {
  const missing: string[] = [];
  for (const word of await listPreA1MediaGapVocabulary(repo)) {
    const key: MediaAssetKey = { kind: "image", key: word, style };
    const existing = await repo.getMediaAssetRaw(key);
    if (!existing) missing.push(word);
  }
  return missing;
}
