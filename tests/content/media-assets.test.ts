import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveMediaAsset } from "@/lib/content/media-assets";
import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import type { MediaAsset, MediaAssetKey } from "@/lib/db/schema";

let dbCounter = 0;
let db: LangTutorDB;
let repo: DexieContentRepository;

const KEY: MediaAssetKey = { kind: "image", key: "apple", style: "kid-illustration" };

function makeAsset(byte: number, approvalStatus: "pending" | "approved" = "approved"): MediaAsset {
  return {
    ...KEY,
    data: new Uint8Array([byte]),
    mimeType: "image/png",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    source: "generated",
    approvalStatus,
    prompt: null,
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
    const producer = vi.fn(async () => makeAsset(42, "approved"));

    const first = await resolveMediaAsset(repo, KEY, producer);
    const second = await resolveMediaAsset(repo, KEY, producer);

    expect(producer).toHaveBeenCalledTimes(1);
    expect(first).toEqual(makeAsset(42, "approved"));
    expect(second).toEqual(makeAsset(42, "approved"));
    expect(await repo.getMediaAsset(KEY)).toEqual(makeAsset(42, "approved"));
  });

  it("stores pending assets but hides them from learner-facing getMediaAsset", async () => {
    const producer = vi.fn(async () => makeAsset(42, "pending"));

    const resolved = await resolveMediaAsset(repo, KEY, producer);

    expect(producer).toHaveBeenCalledTimes(1);
    expect(resolved).toBeUndefined();
    expect(await repo.getMediaAsset(KEY)).toBeUndefined();
    expect(await repo.getMediaAssetRaw(KEY)).toEqual(makeAsset(42, "pending"));
  });

  it("does not regenerate when a pending asset already exists", async () => {
    await repo.putMediaAsset(makeAsset(7, "pending"));
    const producer = vi.fn(async () => makeAsset(99, "pending"));

    const resolved = await resolveMediaAsset(repo, KEY, producer);

    expect(producer).not.toHaveBeenCalled();
    expect(resolved).toBeUndefined();
  });

  it("never invokes the producer on a cache hit", async () => {
    await repo.putMediaAsset(makeAsset(7));
    const producer = vi.fn(async () => makeAsset(99));

    const resolved = await resolveMediaAsset(repo, KEY, producer);

    expect(producer).not.toHaveBeenCalled();
    expect(resolved).toEqual(makeAsset(7));
  });

  it("dedupes concurrent misses for the same key to a single producer call", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const producer = vi.fn(async () => {
      await gate;
      return makeAsset(42, "approved");
    });

    const first = resolveMediaAsset(repo, KEY, producer);
    const second = resolveMediaAsset(repo, KEY, producer);
    release();
    const [a, b] = await Promise.all([first, second]);

    expect(producer).toHaveBeenCalledTimes(1);
    expect(a).toEqual(makeAsset(42, "approved"));
    expect(b).toEqual(makeAsset(42, "approved"));
  });
});
