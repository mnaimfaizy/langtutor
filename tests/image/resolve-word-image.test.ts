import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveWordImage } from "@/lib/image/resolve-word-image";
import { MockImageGenerator } from "@/lib/image/mock-image-generator";
import { buildKidIllustrationPrompt } from "@/lib/image/prompts";
import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";

let dbCounter = 0;
let db: LangTutorDB;
let repo: DexieContentRepository;

beforeEach(() => {
  db = new LangTutorDB(`resolve-word-image-test-${dbCounter++}`);
  repo = new DexieContentRepository(db);
});

afterEach(async () => {
  await db.delete();
  vi.restoreAllMocks();
});

describe("resolveWordImage", () => {
  it("invokes the generator exactly once on a store miss and serves the store on the next lookup", async () => {
    const generator = new MockImageGenerator({ data: new Uint8Array([42]) });

    const first = await resolveWordImage(repo, generator, "Apple");
    const second = await resolveWordImage(repo, generator, "apple");

    expect(generator.calls).toHaveLength(1);
    expect(generator.calls[0]?.prompt).toBe(buildKidIllustrationPrompt("apple"));
    expect(first.data).toEqual(new Uint8Array([42]));
    expect(second.data).toEqual(new Uint8Array([42]));
    expect(
      await repo.getMediaAsset({ kind: "image", key: "apple", style: "kid-illustration" }),
    ).toEqual(first);
  });

  it("never invokes the generator on a cache hit", async () => {
    await repo.putMediaAsset({
      kind: "image",
      key: "cat",
      style: "kid-illustration",
      data: new Uint8Array([7]),
      mimeType: "image/png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const generator = new MockImageGenerator();
    const resolved = await resolveWordImage(repo, generator, "cat");

    expect(generator.calls).toHaveLength(0);
    expect(resolved.data).toEqual(new Uint8Array([7]));
  });
});
