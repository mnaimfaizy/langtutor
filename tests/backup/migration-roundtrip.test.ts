/**
 * Cross-adapter round-trip: export from Dexie (old build) → import into SQLite (new build)
 * Verifies that vocab SRS state, XP, streak, and weakness history survive the migration.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BackupSchema } from "@/lib/backup/schema";
import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import { SqliteContentRepository } from "@/lib/db/sqlite-content-repository";
import * as schema from "@/lib/db/drizzle/schema";
import type { FsrsState, NewCard } from "@/lib/db";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle/migrations");

let dexieDbs: LangTutorDB[] = [];
let sqliteHandles: ReturnType<typeof Database>[] = [];
let dexieCounter = 0;

function makeDexieRepo() {
  const db = new LangTutorDB(`lang-tutor-migration-test-${dexieCounter++}`);
  dexieDbs.push(db);
  return new DexieContentRepository(db);
}

function makeSqliteRepo() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  sqliteHandles.push(sqlite);
  return new SqliteContentRepository(db);
}

beforeEach(() => {
  dexieDbs = [];
  sqliteHandles = [];
});

afterEach(async () => {
  await Promise.all(dexieDbs.map((d) => d.delete()));
  sqliteHandles.forEach((s) => s.close());
});

function makeFsrs(due: Date): FsrsState {
  return {
    due,
    stability: 2.5,
    difficulty: 4.0,
    elapsedDays: 3,
    scheduledDays: 7,
    reps: 2,
    lapses: 0,
    state: 2,
  };
}

function makeCard(word: string): NewCard {
  return {
    word,
    definition: `definition of ${word}`,
    examples: [`Example: ${word} is interesting.`],
    cefr: "B2",
    fsrs: makeFsrs(new Date("2024-06-15T00:00:00Z")),
    createdAt: new Date("2024-01-10T00:00:00Z"),
  };
}

describe("Dexie → SQLite migration round-trip", () => {
  it("preserves vocab SRS state, XP, streak, and weakness history", async () => {
    const dexieRepo = makeDexieRepo();

    // Populate the Dexie repo as a user would on the old build
    await dexieRepo.saveProfile({
      cefrLevel: "B2",
      goals: ["work", "travel"],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      settings: { ttsRate: 1.2 },
    });

    const cardId1 = await dexieRepo.addCard(makeCard("ephemeral"));
    const cardId2 = await dexieRepo.addCard(makeCard("serendipity"));

    await dexieRepo.saveGamification({
      xp: 250,
      level: 4,
      streakCount: 7,
      lastActivityDate: "2024-06-14",
      achievements: [
        { id: "first_review", unlockedAt: new Date("2024-01-20T00:00:00Z") },
        { id: "streak_3", unlockedAt: new Date("2024-03-01T00:00:00Z") },
      ],
    });

    await dexieRepo.putWeakness({
      skill: "writing",
      category: "grammar",
      cefr: "B2",
      score: 0.4,
      confidence: 0.75,
      updatedAt: new Date("2024-05-01T00:00:00Z"),
    });
    await dexieRepo.putWeakness({
      skill: "reading",
      category: "vocabulary",
      cefr: "C1",
      score: 0.6,
      confidence: 0.9,
      updatedAt: new Date("2024-05-15T00:00:00Z"),
    });

    await dexieRepo.addErrorEvent({
      skill: "speaking",
      category: "pronunciation",
      cefr: "B2",
      context: "She don't know.",
      createdAt: new Date("2024-04-01T00:00:00Z"),
    });

    await dexieRepo.putLexiconEntry({
      word: "ephemeral",
      data: { phonetic: "/ɪˈfem.ər.əl/", definitions: ["lasting a very short time"] },
      cachedAt: new Date("2024-02-01T00:00:00Z"),
    });

    // Simulate the export step on the old build
    const rawBackup = await dexieRepo.exportBackup();

    // Simulate file download + re-upload (JSON serialisation as it travels through the filesystem)
    const jsonString = JSON.stringify(rawBackup);
    const parsedBackup = BackupSchema.parse(JSON.parse(jsonString) as unknown);

    // Import into the new SQLite build
    const sqliteRepo = makeSqliteRepo();
    await sqliteRepo.importBackup(parsedBackup);

    // ── Verify profile ──────────────────────────────────────────────────────────
    const profile = await sqliteRepo.getProfile();
    expect(profile?.cefrLevel).toBe("B2");
    expect(profile?.goals).toEqual(["work", "travel"]);
    expect(profile?.settings.ttsRate).toBe(1.2);
    expect(profile?.createdAt).toEqual(new Date("2024-01-01T00:00:00Z"));

    // ── Verify vocab SRS state ──────────────────────────────────────────────────
    const cards = await sqliteRepo.getAllCards();
    expect(cards).toHaveLength(2);

    const card1 = await sqliteRepo.getCard(cardId1);
    expect(card1?.word).toBe("ephemeral");
    expect(card1?.fsrs.due).toEqual(new Date("2024-06-15T00:00:00Z"));
    expect(card1?.fsrs.stability).toBe(2.5);
    expect(card1?.fsrs.reps).toBe(2);
    expect(card1?.fsrs.state).toBe(2);

    const card2 = await sqliteRepo.getCard(cardId2);
    expect(card2?.word).toBe("serendipity");
    expect(card2?.cefr).toBe("B2");

    // ── Verify XP and streak ────────────────────────────────────────────────────
    const gamification = await sqliteRepo.getGamification();
    expect(gamification?.xp).toBe(250);
    expect(gamification?.level).toBe(4);
    expect(gamification?.streakCount).toBe(7);
    expect(gamification?.lastActivityDate).toBe("2024-06-14");
    expect(gamification?.achievements).toHaveLength(2);
    expect(gamification?.achievements[0].id).toBe("first_review");
    expect(gamification?.achievements[0].unlockedAt).toBeInstanceOf(Date);
    expect(gamification?.achievements[1].id).toBe("streak_3");

    // ── Verify weakness history ─────────────────────────────────────────────────
    const weaknesses = await sqliteRepo.getWeaknesses();
    expect(weaknesses).toHaveLength(2);
    const writingWeakness = weaknesses.find((w) => w.skill === "writing");
    expect(writingWeakness?.category).toBe("grammar");
    expect(writingWeakness?.score).toBe(0.4);
    expect(writingWeakness?.confidence).toBe(0.75);
    expect(writingWeakness?.updatedAt).toEqual(new Date("2024-05-01T00:00:00Z"));

    // ── Verify error events ─────────────────────────────────────────────────────
    const errorEvents = await sqliteRepo.queryErrorEvents({ skill: "speaking" });
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0].id).toBe(1);
    expect(errorEvents[0].category).toBe("pronunciation");

    // ── Verify lexicon cache ────────────────────────────────────────────────────
    const lexEntry = await sqliteRepo.getLexiconEntry("ephemeral");
    expect(lexEntry?.word).toBe("ephemeral");
    expect(lexEntry?.cachedAt).toBeInstanceOf(Date);
  });

  it("round-trip re-export equals original backup tables", async () => {
    const dexieRepo = makeDexieRepo();

    await dexieRepo.saveProfile({
      cefrLevel: "A2",
      goals: ["general"],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      settings: {},
    });
    const cardId = await dexieRepo.addCard(makeCard("curious"));
    await dexieRepo.saveGamification({
      xp: 80,
      level: 2,
      streakCount: 3,
      lastActivityDate: "2024-03-10",
      achievements: [],
    });

    const backup1 = await dexieRepo.exportBackup();
    const parsed = BackupSchema.parse(JSON.parse(JSON.stringify(backup1)) as unknown);

    const sqliteRepo = makeSqliteRepo();
    await sqliteRepo.importBackup(parsed);

    // Re-export from SQLite
    const backup2 = await sqliteRepo.exportBackup();

    // Profile fields should match
    expect(backup2.tables.profile[0].cefrLevel).toBe(backup1.tables.profile[0].cefrLevel);
    expect(backup2.tables.profile[0].goals).toEqual(backup1.tables.profile[0].goals);

    // Card IDs and SRS state should be preserved
    expect(backup2.tables.cards).toHaveLength(1);
    expect(backup2.tables.cards[0].id).toBe(cardId);
    expect(backup2.tables.cards[0].word).toBe("curious");
    expect(backup2.tables.cards[0].fsrs.due).toEqual(backup1.tables.cards[0].fsrs.due);

    // Gamification should be intact
    expect(backup2.tables.gamification[0].xp).toBe(80);
    expect(backup2.tables.gamification[0].streakCount).toBe(3);
  });
});
