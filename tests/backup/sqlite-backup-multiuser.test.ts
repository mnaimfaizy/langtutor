import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteContentRepository } from "@/lib/db/sqlite-content-repository";
import * as schema from "@/lib/db/drizzle/schema";
import type { FsrsState, NewCard } from "@/lib/db";

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

function makeRepo(userId: string) {
  return new SqliteContentRepository(drizzle(sqlite, { schema }), userId);
}

function makeFsrs(): FsrsState {
  return {
    due: new Date("2024-06-01T00:00:00Z"),
    stability: 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 1,
    reps: 0,
    lapses: 0,
    state: 0,
  };
}

function makeCard(word: string): NewCard {
  return {
    word,
    definition: `definition of ${word}`,
    examples: [`An example using ${word}.`],
    cefr: "B1",
    fsrs: makeFsrs(),
    createdAt: new Date("2024-01-01T00:00:00Z"),
  };
}

describe("per-user backup: export isolation", () => {
  it("export contains only the current user's per-user data", async () => {
    const repoA = makeRepo("user-a");
    const repoB = makeRepo("user-b");

    await repoA.saveProfile({
      cefrLevel: "A1",
      goals: [],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      settings: {},
    });
    await repoA.addCard(makeCard("apple"));
    await repoB.addCard(makeCard("banana"));

    const backupA = await repoA.exportBackup();

    expect(backupA.tables.profile).toHaveLength(1);
    expect(backupA.tables.cards).toHaveLength(1);
    expect(backupA.tables.cards[0].word).toBe("apple");
  });

  it("export includes shared content and lexiconCache tables as portable seed", async () => {
    const repoA = makeRepo("user-a");
    const repoB = makeRepo("user-b");

    await repoA.putContent({
      type: "passage",
      level: "A1",
      topic: "food",
      payload: { text: "An apple a day." },
      source: "seed",
      validatedAt: new Date("2024-01-01T00:00:00Z"),
    });
    await repoA.putLexiconEntry({
      word: "apple",
      data: { phonetic: "/ˈæp.əl/" },
      cachedAt: new Date("2024-01-01T00:00:00Z"),
    });

    const backupA = await repoA.exportBackup();
    const backupB = await repoB.exportBackup();

    expect(backupA.tables.content).toHaveLength(1);
    expect(backupA.tables.lexiconCache).toHaveLength(1);
    // User B's export also includes the shared tables
    expect(backupB.tables.content).toHaveLength(1);
    expect(backupB.tables.lexiconCache).toHaveLength(1);
  });
});

describe("per-user backup: import assigns rows to importing user", () => {
  it("imported per-user rows are assigned to the importing user", async () => {
    const repoA = makeRepo("user-a");
    const repoB = makeRepo("user-b");

    await repoA.saveProfile({
      cefrLevel: "B2",
      goals: ["work"],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      settings: { ttsRate: 1.5 },
    });
    await repoA.addCard(makeCard("serendipity"));
    await repoA.saveGamification({
      xp: 200,
      level: 3,
      streakCount: 7,
      lastActivityDate: "2024-05-01",
      achievements: [{ id: "streak_3", unlockedAt: new Date("2024-04-01T00:00:00Z") }],
    });

    const backupA = await repoA.exportBackup();
    await repoB.importBackup(backupA);

    const profileB = await repoB.getProfile();
    expect(profileB?.cefrLevel).toBe("B2");
    expect(profileB?.settings.ttsRate).toBe(1.5);

    const cardsB = await repoB.getAllCards();
    expect(cardsB).toHaveLength(1);
    expect(cardsB[0].word).toBe("serendipity");

    const gamificationB = await repoB.getGamification();
    expect(gamificationB?.xp).toBe(200);
    expect(gamificationB?.achievements[0].id).toBe("streak_3");
  });

  it("import merges shared rows without wiping other users' data", async () => {
    const repoA = makeRepo("user-a");
    const repoB = makeRepo("user-b");

    // Both users contribute shared content
    await repoA.putContent({
      type: "passage",
      level: "A1",
      topic: "food",
      payload: { text: "Content from A" },
      source: "seed",
      validatedAt: new Date("2024-01-01T00:00:00Z"),
    });
    await repoB.putContent({
      type: "passage",
      level: "B1",
      topic: "science",
      payload: { text: "Content from B" },
      source: "seed",
      validatedAt: new Date("2024-01-01T00:00:00Z"),
    });

    // User A exports (includes both shared content rows)
    const backupA = await repoA.exportBackup();
    expect(backupA.tables.content).toHaveLength(2);

    // User B imports user A's backup — shared rows must merge, not wipe
    await repoB.importBackup(backupA);

    const allContent = await repoB.queryContent();
    expect(allContent).toHaveLength(2);
  });
});

describe("per-user backup: second user unaffected by another user's import", () => {
  it("user B's per-user data survives user A's importBackup", async () => {
    const repoA = makeRepo("user-a");
    const repoB = makeRepo("user-b");

    // Establish user B's state
    await repoB.saveProfile({
      cefrLevel: "C1",
      goals: ["exam"],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      settings: {},
    });
    await repoB.addCard(makeCard("banana"));
    await repoB.saveGamification({
      xp: 500,
      level: 5,
      streakCount: 10,
      lastActivityDate: "2024-06-01",
      achievements: [],
    });

    // User A creates a backup and imports it
    await repoA.saveProfile({
      cefrLevel: "A1",
      goals: [],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      settings: {},
    });
    const backupA = await repoA.exportBackup();
    await repoA.importBackup(backupA);

    // User B's data must be completely unaffected
    const profileB = await repoB.getProfile();
    expect(profileB?.cefrLevel).toBe("C1");

    const cardsB = await repoB.getAllCards();
    expect(cardsB).toHaveLength(1);
    expect(cardsB[0].word).toBe("banana");

    const gamificationB = await repoB.getGamification();
    expect(gamificationB?.xp).toBe(500);
    expect(gamificationB?.level).toBe(5);
  });
});

describe("per-user backup: round-trip is data-equivalent for the user", () => {
  it("export → import → export produces identical per-user data", async () => {
    const repoA = makeRepo("user-a");

    await repoA.saveProfile({
      cefrLevel: "B1",
      goals: ["travel"],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      settings: { ttsRate: 1.2 },
    });
    await repoA.addCard(makeCard("ephemeral"));
    await repoA.putContent({
      type: "passage",
      level: "B1",
      topic: "travel",
      payload: { text: "Travel broadens the mind." },
      source: "seed",
      validatedAt: new Date("2024-01-01T00:00:00Z"),
    });
    await repoA.putLexiconEntry({
      word: "ephemeral",
      data: { phonetic: "/ɪˈfem.ər.əl/" },
      cachedAt: new Date("2024-01-01T00:00:00Z"),
    });
    await repoA.saveGamification({
      xp: 150,
      level: 2,
      streakCount: 4,
      lastActivityDate: "2024-05-15",
      achievements: [{ id: "first_review", unlockedAt: new Date("2024-02-01T00:00:00Z") }],
    });

    const backup1 = await repoA.exportBackup();
    await repoA.importBackup(backup1);
    const backup2 = await repoA.exportBackup();

    expect(backup2.tables.profile).toHaveLength(1);
    expect(backup2.tables.profile[0].cefrLevel).toBe("B1");
    expect(backup2.tables.profile[0].settings.ttsRate).toBe(1.2);

    expect(backup2.tables.cards).toHaveLength(1);
    expect(backup2.tables.cards[0].word).toBe("ephemeral");
    expect(backup2.tables.cards[0].fsrs.due).toBeInstanceOf(Date);

    expect(backup2.tables.content).toHaveLength(1);
    expect(backup2.tables.lexiconCache).toHaveLength(1);
    expect(backup2.tables.lexiconCache[0].word).toBe("ephemeral");

    expect(backup2.tables.gamification).toHaveLength(1);
    expect(backup2.tables.gamification[0].xp).toBe(150);
    expect(backup2.tables.gamification[0].achievements[0].id).toBe("first_review");
    expect(backup2.tables.gamification[0].achievements[0].unlockedAt).toBeInstanceOf(Date);
  });
});
