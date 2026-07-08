import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteContentRepository } from "@/lib/db/sqlite-content-repository";
import * as schema from "@/lib/db/drizzle/schema";
import type { ContentRepository } from "@/lib/db";

import { runContentRepositoryContract } from "./content-repository-contract";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle/migrations");

let sqlite: ReturnType<typeof Database>;

beforeEach(() => {
  sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
});

afterEach(() => {
  sqlite.close();
});

runContentRepositoryContract((): ContentRepository => {
  const db = drizzle(sqlite, { schema });
  return new SqliteContentRepository(db);
});

describe("per-user isolation", () => {
  it("two users see disjoint per-user data but share content and lexiconCache", async () => {
    const db = drizzle(sqlite, { schema });
    const repo1 = new SqliteContentRepository(db, "user-aaa");
    const repo2 = new SqliteContentRepository(db, "user-bbb");

    // Per-user: user1 saves a profile, user2 has none
    await repo1.saveProfile({ cefrLevel: "A1", goals: [], createdAt: new Date(), settings: {} });
    expect(await repo1.getProfile()).toBeDefined();
    expect(await repo2.getProfile()).toBeUndefined();

    // Per-user: user1 adds a card, user2 sees none
    await repo1.addCard({
      word: "apple",
      definition: "a fruit",
      examples: ["An apple a day."],
      cefr: "A1",
      fsrs: {
        due: new Date(0),
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        state: 0,
      },
      createdAt: new Date(),
    });
    expect(await repo1.getAllCards()).toHaveLength(1);
    expect(await repo2.getAllCards()).toHaveLength(0);

    // Shared: content written by user1 is readable by user2
    const contentId = await repo1.putContent({
      type: "passage",
      level: "A1",
      topic: "food",
      payload: "An apple a day.",
      source: "seed",
      validatedAt: new Date(),
    });
    expect(await repo1.getContent(contentId)).toBeDefined();
    expect(await repo2.getContent(contentId)).toBeDefined();

    // Shared: lexicon entry written by user1 is readable by user2
    await repo1.putLexiconEntry({ word: "apple", data: {}, cachedAt: new Date() });
    expect(await repo1.getLexiconEntry("apple")).toBeDefined();
    expect(await repo2.getLexiconEntry("apple")).toBeDefined();

    // Shared: media asset written by user1 is readable by user2
    await repo1.putMediaAsset({
      kind: "image",
      key: "apple",
      style: "default",
      data: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
      createdAt: new Date(),
    });
    expect(
      await repo1.getMediaAsset({ kind: "image", key: "apple", style: "default" }),
    ).toBeDefined();
    expect(
      await repo2.getMediaAsset({ kind: "image", key: "apple", style: "default" }),
    ).toBeDefined();

    // Per-user: user1's learning path is invisible to user2
    await repo1.addUnit({
      index: 0,
      title: "Unit 1: Simple present tense",
      teacherNote: "Base verb form for habitual actions, facts, and permanent states.",
      targetGrammarIds: ["simple_present"],
      targetVocab: [],
      targetCefr: "A1",
      activities: [{ skill: "reading" }],
      status: "available",
      bufferStatus: "empty",
      createdAt: new Date(),
    });
    expect(await repo1.getUnits()).toHaveLength(1);
    expect(await repo2.getUnits()).toHaveLength(0);
  });
});
