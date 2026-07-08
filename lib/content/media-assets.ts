import type { ContentRepository } from "@/lib/db/content-repository";
import type { MediaAsset, MediaAssetKey } from "@/lib/db/schema";

/**
 * Generate-once, store-forever media resolution (ADR 0016). Checks the shared media
 * asset store first; only invokes `producer` on a cache miss, persists the result,
 * and returns the stored asset on every subsequent lookup.
 */
export async function resolveMediaAsset(
  repo: ContentRepository,
  key: MediaAssetKey,
  producer: () => Promise<MediaAsset>,
): Promise<MediaAsset> {
  const existing = await repo.getMediaAsset(key);
  if (existing) return existing;

  const produced = await producer();
  await repo.putMediaAsset(produced);
  return produced;
}
