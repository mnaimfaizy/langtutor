import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listPreA1ImageVocabulary } from "@/lib/image/pre-a1-image-vocab";
import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import { listMissingPreA1AudioWords } from "@/lib/tts/curriculum-audio-gaps";

let dbCounter = 0;
let db: LangTutorDB;
let repo: DexieContentRepository;

beforeEach(() => {
  db = new LangTutorDB(`curriculum-audio-gaps-test-${dbCounter++}`);
  repo = new DexieContentRepository(db);
});

afterEach(async () => {
  await db.delete();
});

describe("listMissingPreA1AudioWords", () => {
  it("lists all pre-A1 words when the audio store is empty", async () => {
    const missing = await listMissingPreA1AudioWords(repo);
    expect(missing).toEqual([...listPreA1ImageVocabulary()]);
  });

  it("excludes words that already have an audio row", async () => {
    await repo.putMediaAsset({
      kind: "audio",
      key: "apple",
      style: "default",
      data: new Uint8Array([1]),
      mimeType: "audio/wav",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "approved",
      prompt: null,
    });
    await repo.putMediaAsset({
      kind: "audio",
      key: "ball",
      style: "default",
      data: new Uint8Array([2]),
      mimeType: "audio/wav",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "pending",
      prompt: null,
    });

    const missing = await listMissingPreA1AudioWords(repo);
    expect(missing).not.toContain("apple");
    expect(missing).not.toContain("ball");
    expect(missing).toContain("cat");
  });

  it("does not treat an image row as filling the audio gap", async () => {
    await repo.putMediaAsset({
      kind: "image",
      key: "apple",
      style: "kid-illustration",
      data: new Uint8Array([1]),
      mimeType: "image/png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "curated-pack",
      approvalStatus: "approved",
      prompt: null,
    });

    const missing = await listMissingPreA1AudioWords(repo);
    expect(missing).toContain("apple");
  });
});
