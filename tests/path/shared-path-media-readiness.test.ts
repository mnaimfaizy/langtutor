/**
 * Slice 1 — admin shared-path review: per-word image/audio readiness for draft vocab.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import {
  assessSharedPathVocabMedia,
  summarizeSharedPathMediaReadiness,
} from "@/lib/path/shared-path-media-readiness";

let dbCounter = 0;
let db: LangTutorDB;
let repo: DexieContentRepository;

beforeEach(() => {
  db = new LangTutorDB(`shared-path-media-readiness-${dbCounter++}`);
  repo = new DexieContentRepository(db);
});

afterEach(async () => {
  await db.delete();
});

describe("assessSharedPathVocabMedia", () => {
  it("returns an empty list when the template has no target vocab", async () => {
    expect(await assessSharedPathVocabMedia(repo, [])).toEqual([]);
  });

  it("marks every word missing image and audio when the store is empty", async () => {
    const rows = await assessSharedPathVocabMedia(repo, ["cat", "mat"]);
    expect(rows).toEqual([
      { word: "cat", image: "missing", audio: "missing" },
      { word: "mat", image: "missing", audio: "missing" },
    ]);
  });

  it("normalizes case and whitespace and dedupes while preserving first order", async () => {
    const rows = await assessSharedPathVocabMedia(repo, [" Cat ", "cat", "MAT", " mat "]);
    expect(rows.map((r) => r.word)).toEqual(["cat", "mat"]);
  });

  it("distinguishes pending vs approved image and audio rows", async () => {
    await repo.putMediaAsset({
      kind: "image",
      key: "cat",
      style: "kid-illustration",
      data: new Uint8Array([1]),
      mimeType: "image/png",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "pending",
      prompt: "cat",
    });
    await repo.putMediaAsset({
      kind: "image",
      key: "mat",
      style: "kid-illustration",
      data: new Uint8Array([2]),
      mimeType: "image/png",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      source: "curated-pack",
      approvalStatus: "approved",
      prompt: null,
    });
    await repo.putMediaAsset({
      kind: "audio",
      key: "cat",
      style: "default",
      data: new Uint8Array([3]),
      mimeType: "audio/wav",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "approved",
      prompt: null,
    });
    await repo.putMediaAsset({
      kind: "audio",
      key: "mat",
      style: "default",
      data: new Uint8Array([4]),
      mimeType: "audio/wav",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "pending",
      prompt: null,
    });

    const rows = await assessSharedPathVocabMedia(repo, ["cat", "mat", "sat"]);
    expect(rows).toEqual([
      { word: "cat", image: "pending", audio: "approved" },
      { word: "mat", image: "approved", audio: "pending" },
      { word: "sat", image: "missing", audio: "missing" },
    ]);
  });

  it("does not treat an image row as filling the audio gap", async () => {
    await repo.putMediaAsset({
      kind: "image",
      key: "apple",
      style: "kid-illustration",
      data: new Uint8Array([1]),
      mimeType: "image/png",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      source: "curated-pack",
      approvalStatus: "approved",
      prompt: null,
    });

    const rows = await assessSharedPathVocabMedia(repo, ["apple"]);
    expect(rows).toEqual([{ word: "apple", image: "approved", audio: "missing" }]);
  });
});

describe("summarizeSharedPathMediaReadiness", () => {
  it("counts words still missing learner-ready media", () => {
    const summary = summarizeSharedPathMediaReadiness([
      { word: "cat", image: "approved", audio: "approved" },
      { word: "mat", image: "pending", audio: "missing" },
      { word: "sat", image: "missing", audio: "pending" },
    ]);
    expect(summary).toEqual({
      wordCount: 3,
      imagesReady: 1,
      audioReady: 1,
      needsAttention: 2,
    });
  });
});
