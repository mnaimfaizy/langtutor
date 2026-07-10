import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listMissingPreA1ImageWords } from "@/lib/image/curriculum-image-gaps";
import { listPreA1ImageVocabulary } from "@/lib/image/pre-a1-image-vocab";
import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import { ALPHABET_ENTRIES } from "@/lib/alphabet/vocab";
import { LISTEN_TAP_OPTION_WORDS } from "@/lib/listen-tap/vocab";
import { PICTURE_MATCH_OPTION_WORDS } from "@/lib/picture-match/vocab";

let dbCounter = 0;
let db: LangTutorDB;
let repo: DexieContentRepository;

beforeEach(() => {
  db = new LangTutorDB(`curriculum-image-gaps-test-${dbCounter++}`);
  repo = new DexieContentRepository(db);
});

afterEach(async () => {
  await db.delete();
});

describe("listPreA1ImageVocabulary", () => {
  it("unions alphabet, picture-match, and listen-tap picture words uniquely", () => {
    const words = listPreA1ImageVocabulary();
    expect(words).toContain("apple");
    expect(words).toContain("zebra");
    expect(words).toEqual([...words].sort((a, b) => a.localeCompare(b)));
    expect(new Set(words).size).toBe(words.length);

    for (const entry of ALPHABET_ENTRIES) {
      expect(words).toContain(entry.pictureWord);
    }
    for (const word of PICTURE_MATCH_OPTION_WORDS) {
      expect(words).toContain(word);
    }
    for (const word of LISTEN_TAP_OPTION_WORDS) {
      expect(words).toContain(word);
    }
  });
});

describe("listMissingPreA1ImageWords", () => {
  it("lists all pre-A1 words when the store is empty", async () => {
    const missing = await listMissingPreA1ImageWords(repo);
    expect(missing).toEqual([...listPreA1ImageVocabulary()]);
  });

  it("excludes words that already have an image row", async () => {
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
    await repo.putMediaAsset({
      kind: "image",
      key: "ball",
      style: "kid-illustration",
      data: new Uint8Array([2]),
      mimeType: "image/png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "pending",
      prompt: "pending ball",
    });

    const missing = await listMissingPreA1ImageWords(repo);
    expect(missing).not.toContain("apple");
    expect(missing).not.toContain("ball");
    expect(missing).toContain("cat");
  });
});
