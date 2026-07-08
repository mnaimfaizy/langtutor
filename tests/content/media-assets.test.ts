import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveMediaAsset } from "@/lib/content/media-assets";
import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import type { MediaAsset, MediaAssetKey } from "@/lib/db/schema";

let dbCounter = 0;
let db: LangTutorDB;
let repo: DexieContentRepository;

const KEY: MediaAssetKey = { kind: "image", key: "apple", style: "kid-illustration" };

function makeAsset(byte: number): MediaAsset {
  return {
    ...KEY,
    data: new Uint8Array([byte]),
    mimeType: "image/png",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

beforeEach(() => {
  db = new LangTutorDB(`media-assets-test-${dbCounter++}`);
  repo = new DexieContentRepository(db);
});

afterEach(async () => {
  await db.delete();
  vi.restoreAllMocks();
});

describe("resolveMediaAsset", () => {
  it("invokes the producer exactly once on a cache miss and serves the store on the next lookup", async () => {
    const producer = vi.fn(async () => makeAsset(42));

    const first = await resolveMediaAsset(repo, KEY, producer);
    const second = await resolveMediaAsset(repo, KEY, producer);

    expect(producer).toHaveBeenCalledTimes(1);
    expect(first).toEqual(makeAsset(42));
    expect(second).toEqual(makeAsset(42));
    expect(await repo.getMediaAsset(KEY)).toEqual(makeAsset(42));
  });

  it("never invokes the producer on a cache hit", async () => {
    await repo.putMediaAsset(makeAsset(7));
    const producer = vi.fn(async () => makeAsset(99));

    const resolved = await resolveMediaAsset(repo, KEY, producer);

    expect(producer).not.toHaveBeenCalled();
    expect(resolved).toEqual(makeAsset(7));
  });
});
