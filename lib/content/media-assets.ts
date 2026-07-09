import type { ContentRepository } from "@/lib/db/content-repository";
import type { MediaAsset, MediaAssetKey } from "@/lib/db/schema";

export interface ResolveMediaAssetOptions {
  /** When true, always invoke `producer` and return the stored asset regardless of approval. */
  forceRegenerate?: boolean;
}

/** In-flight producers keyed by `(kind, key, style)` so concurrent misses share one call. */
const inFlight = new Map<string, Promise<MediaAsset | undefined>>();

function mediaAssetFlightKey(key: MediaAssetKey): string {
  return `${key.kind}\0${key.key.toLowerCase()}\0${key.style}`;
}

async function produceAndStore(
  repo: ContentRepository,
  key: MediaAssetKey,
  producer: () => Promise<MediaAsset>,
  forceRegenerate: boolean,
): Promise<MediaAsset | undefined> {
  if (!forceRegenerate) {
    const raced = await repo.getMediaAssetRaw(key);
    if (raced) {
      return raced.approvalStatus === "approved" ? raced : undefined;
    }
  }

  const produced = await producer();
  await repo.putMediaAsset(produced);

  if (forceRegenerate) return produced;
  return produced.approvalStatus === "approved" ? produced : undefined;
}

/**
 * Generate-once, store-forever media resolution (ADR 0016). Checks the shared media
 * asset store first; only invokes `producer` on a cache miss, persists the result,
 * and returns the stored asset on every subsequent lookup.
 *
 * Concurrent misses for the same key coalesce onto a single producer invocation
 * (same pattern as path/content seeding mutexes).
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
  const normalizedKey: MediaAssetKey = { ...key, key: key.key.toLowerCase() };
  const forceRegenerate = options?.forceRegenerate === true;

  if (forceRegenerate) {
    return produceAndStore(repo, normalizedKey, producer, true);
  }

  const existing = await repo.getMediaAssetRaw(normalizedKey);
  if (existing) {
    return existing.approvalStatus === "approved" ? existing : undefined;
  }

  const flightKey = mediaAssetFlightKey(normalizedKey);
  const pending = inFlight.get(flightKey);
  if (pending) return pending;

  // Claim the flight slot synchronously (no await between get and set) so concurrent
  // callers that already observed a store miss join this same promise.
  const work = produceAndStore(repo, normalizedKey, producer, false).finally(() => {
    if (inFlight.get(flightKey) === work) {
      inFlight.delete(flightKey);
    }
  });
  inFlight.set(flightKey, work);
  return work;
}
