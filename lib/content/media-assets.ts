import type { ContentRepository } from "@/lib/db/content-repository";
import type { MediaAsset, MediaAssetKey } from "@/lib/db/schema";

export interface ResolveMediaAssetOptions {
  /** When true, always invoke `producer` and return the stored asset regardless of approval. */
  forceRegenerate?: boolean;
  /**
   * Admin proactive create: reject when a row already exists; otherwise coalesce on the
   * in-flight map, persist, and return the asset even when pending.
   */
  createIfAbsent?: boolean;
}

type FlightResult = { asset: MediaAsset; produced: boolean };

/** In-flight producers keyed by `(kind, key, style)` so concurrent misses share one call. */
const inFlight = new Map<string, Promise<FlightResult>>();

function mediaAssetFlightKey(key: MediaAssetKey): string {
  return `${key.kind}\0${key.key.toLowerCase()}\0${key.style}`;
}

function alreadyExistsError(key: MediaAssetKey): Error {
  const label = key.kind === "audio" ? "Audio" : "Image";
  return new Error(`${label} already exists for "${key.key}". Use regenerate instead.`);
}

/**
 * Produce and persist on a miss. If a row appears mid-flight, return it without
 * overwriting (`produced: false`) so createIfAbsent can reject.
 */
async function produceAndStore(
  repo: ContentRepository,
  key: MediaAssetKey,
  producer: () => Promise<MediaAsset>,
): Promise<FlightResult> {
  const raced = await repo.getMediaAssetRaw(key);
  if (raced) return { asset: raced, produced: false };

  const produced = await producer();
  await repo.putMediaAsset(produced);
  return { asset: produced, produced: true };
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
  const createIfAbsent = options?.createIfAbsent === true;

  if (forceRegenerate) {
    const produced = await producer();
    await repo.putMediaAsset(produced);
    return produced;
  }

  const existing = await repo.getMediaAssetRaw(normalizedKey);
  if (existing) {
    if (createIfAbsent) throw alreadyExistsError(normalizedKey);
    return existing.approvalStatus === "approved" ? existing : undefined;
  }

  const flightKey = mediaAssetFlightKey(normalizedKey);
  const pending = inFlight.get(flightKey);
  const work =
    pending ??
    produceAndStore(repo, normalizedKey, producer).finally(() => {
      if (inFlight.get(flightKey) === work) {
        inFlight.delete(flightKey);
      }
    });
  if (!pending) {
    inFlight.set(flightKey, work);
  }

  const { asset, produced } = await work;

  if (createIfAbsent) {
    if (!produced) throw alreadyExistsError(normalizedKey);
    return asset;
  }

  return asset.approvalStatus === "approved" ? asset : undefined;
}
