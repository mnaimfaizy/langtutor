import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import type { ContentRepository } from "@/lib/db";

import { runContentRepositoryContract } from "./content-repository-contract";

// A fresh, uniquely-named DB per test keeps fake-indexeddb state isolated.
let dbCounter = 0;
let db: LangTutorDB;

beforeEach(() => {
  db = new LangTutorDB(`lang-tutor-test-${dbCounter++}`);
});

afterEach(async () => {
  await db.delete();
});

describe("DexieContentRepository — schema versioning", () => {
  it("opens at version 9 with shared path catalog", async () => {
    await db.open();
    expect(db.verno).toBe(9);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      "cardCollectionMembers",
      "cards",
      "chapterGates",
      "collectibleGrants",
      "collections",
      "content",
      "errorEvents",
      "gamification",
      "lexiconCache",
      "mediaAssets",
      "profile",
      "questState",
      "sharedPathStages",
      "sharedPathUnitTemplates",
      "units",
      "weakness",
    ]);
  });
});

runContentRepositoryContract((): ContentRepository => new DexieContentRepository(db));
