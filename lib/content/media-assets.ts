import type { ContentRepository } from "@/lib/db/content-repository";
import type { MediaAsset, MediaAssetKey } from "@/lib/db/schema";

export interface ResolveMediaAssetOptions {
  /** When true, always invoke `producer` and return the stored asset regardless of approval. */
  forceRegenerate?: boolean;
}

/**
 * Generate-once, store-forever media resolution (ADR 0016). Checks the shared media
 * asset store first; only invokes `producer` on a cache miss, persists the result,
 * and returns the stored asset on every subsequent lookup.
 *
 * Learner-facing: returns only `approved` assets. Pending assets block visibility
 * without triggering regeneration (kid-safety gate, issue #69).
 */
export async function resolveMediaAsset(
  repo: ContentRepository,
  key: MediaAssetKey,
  producer: () => Promise<MediaAsset>,
  options?: ResolveMediaAssetOptions,
): Promise<MediaAsset | undefined> {
  const existing = await repo.getMediaAssetRaw(key);

  if (existing && !options?.forceRegenerate) {
    return existing.approvalStatus === "approved" ? existing : undefined;
  }

  const produced = await producer();
  await repo.putMediaAsset(produced);

  if (options?.forceRegenerate) return produced;
  return produced.approvalStatus === "approved" ? produced : undefined;
}
