import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveWordImage, regenerateWordImage } from "@/lib/image/resolve-word-image";
import { MockImageGenerator } from "@/lib/image/mock-image-generator";
import { buildKidIllustrationPrompt } from "@/lib/image/prompts";
import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";

let dbCounter = 0;
let db: LangTutorDB;
let repo: DexieContentRepository;

const IMAGE_KEY = { kind: "image" as const, key: "apple", style: "kid-illustration" };

beforeEach(() => {
  db = new LangTutorDB(`resolve-word-image-test-${dbCounter++}`);
  repo = new DexieContentRepository(db);
});

afterEach(async () => {
  await db.delete();
  vi.restoreAllMocks();
});

describe("resolveWordImage", () => {
  it("invokes the generator exactly once on a store miss and stores a pending asset", async () => {
    const generator = new MockImageGenerator({ data: new Uint8Array([42]) });

    const first = await resolveWordImage(repo, generator, "Apple");
    const second = await resolveWordImage(repo, generator, "apple");

    expect(generator.calls).toHaveLength(1);
    expect(generator.calls[0]?.prompt).toBe(buildKidIllustrationPrompt("apple"));
    expect(first).toBeUndefined();
    expect(second).toBeUndefined();

    const stored = await repo.getMediaAssetRaw(IMAGE_KEY);
    expect(stored?.data).toEqual(new Uint8Array([42]));
    expect(stored?.approvalStatus).toBe("pending");
    expect(stored?.source).toBe("generated");
    expect(await repo.getMediaAsset(IMAGE_KEY)).toBeUndefined();
  });

  it("returns approved assets from the store without calling the generator", async () => {
    await repo.putMediaAsset({
      kind: "image",
      key: "cat",
      style: "kid-illustration",
      data: new Uint8Array([7]),
      mimeType: "image/png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "approved",
    });

    const generator = new MockImageGenerator();
    const resolved = await resolveWordImage(repo, generator, "cat");

    expect(generator.calls).toHaveLength(0);
    expect(resolved?.data).toEqual(new Uint8Array([7]));
  });

  it("does not return pending cache hits to learners", async () => {
    await repo.putMediaAsset({
      kind: "image",
      key: "dog",
      style: "kid-illustration",
      data: new Uint8Array([3]),
      mimeType: "image/png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "pending",
    });

    const generator = new MockImageGenerator();
    const resolved = await resolveWordImage(repo, generator, "dog");

    expect(generator.calls).toHaveLength(0);
    expect(resolved).toBeUndefined();
  });
});

describe("regenerateWordImage", () => {
  it("replaces a pending asset with a freshly generated one", async () => {
    await repo.putMediaAsset({
      kind: "image",
      key: "ball",
      style: "kid-illustration",
      data: new Uint8Array([1]),
      mimeType: "image/png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "pending",
    });

    const generator = new MockImageGenerator({ data: new Uint8Array([99]) });
    const regenerated = await regenerateWordImage(repo, generator, "ball");

    expect(generator.calls).toHaveLength(1);
    expect(regenerated.data).toEqual(new Uint8Array([99]));
    expect(regenerated.approvalStatus).toBe("pending");
    expect(
      await repo.getMediaAssetRaw({ kind: "image", key: "ball", style: "kid-illustration" }),
    ).toEqual(regenerated);
  });
});
