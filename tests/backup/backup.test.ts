import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BackupSchema } from "@/lib/backup/schema";
import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import type { FsrsState, NewCard } from "@/lib/db";

let dbCounter = 0;

function makeDb(): { db: LangTutorDB; repo: DexieContentRepository } {
  const db = new LangTutorDB(`lang-tutor-backup-test-${dbCounter++}`);
  return { db, repo: new DexieContentRepository(db) };
}

function makeFsrs(dueOverride?: Date): FsrsState {
  return {
    due: dueOverride ?? new Date("2024-06-01T00:00:00Z"),
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

// Clean up after each test
const dbs: LangTutorDB[] = [];
beforeEach(() => dbs.splice(0));
afterEach(async () => {
  await Promise.all(dbs.map((d) => d.delete()));
});

function tracked<T extends LangTutorDB>(db: T): T {
  dbs.push(db);
  return db;
}

describe("exportBackup — empty DB", () => {
  it("returns version 1 with all empty tables", async () => {
    const { db, repo } = makeDb();
    tracked(db);
    const backup = await repo.exportBackup();
    expect(backup.version).toBe(1);
    expect(typeof backup.exportedAt).toBe("string");
    expect(backup.tables.profile).toHaveLength(0);
    expect(backup.tables.cards).toHaveLength(0);
    expect(backup.tables.content).toHaveLength(0);
    expect(backup.tables.errorEvents).toHaveLength(0);
    expect(backup.tables.weakness).toHaveLength(0);
    expect(backup.tables.gamification).toHaveLength(0);
    expect(backup.tables.lexiconCache).toHaveLength(0);
  });
});

describe("exportBackup — populated DB", () => {
  it("captures one row per table correctly", async () => {
    const { db, repo } = makeDb();
    tracked(db);

    await repo.saveProfile({
      cefrLevel: "B2",
      goals: ["work"],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      settings: { ttsRate: 1.5 },
    });
    await repo.addCard(makeCard("ephemeral"));
    await repo.putContent({
      type: "passage",
      level: "B2",
      topic: "science",
      payload: { title: "Test", body: "Body text." },
      source: "seed",
      validatedAt: new Date("2024-01-01T00:00:00Z"),
    });
    await repo.addErrorEvent({
      skill: "reading",
      category: "grammar",
      cefr: "B2",
      context: "She go to school.",
      createdAt: new Date("2024-02-01T00:00:00Z"),
    });
    await repo.putWeakness({
      skill: "writing",
      category: "vocabulary",
      cefr: "C1",
      score: 0.7,
      confidence: 0.8,
      updatedAt: new Date("2024-03-01T00:00:00Z"),
    });
    await repo.saveGamification({
      xp: 50,
      level: 1,
      streakCount: 2,
      lastActivityDate: "2024-03-01",
      achievements: [{ id: "first_review", unlockedAt: new Date("2024-02-15T00:00:00Z") }],
    });
    await repo.putLexiconEntry({
      word: "ephemeral",
      data: { phonetic: "/ɪˈfem.ər.əl/" },
      cachedAt: new Date("2024-02-01T00:00:00Z"),
    });

    const backup = await repo.exportBackup();

    expect(backup.tables.profile).toHaveLength(1);
    expect(backup.tables.profile[0].cefrLevel).toBe("B2");
    expect(backup.tables.cards).toHaveLength(1);
    expect(backup.tables.cards[0].word).toBe("ephemeral");
    expect(backup.tables.content).toHaveLength(1);
    expect(backup.tables.errorEvents).toHaveLength(1);
    expect(backup.tables.weakness).toHaveLength(1);
    expect(backup.tables.gamification).toHaveLength(1);
    expect(backup.tables.gamification[0].xp).toBe(50);
    expect(backup.tables.lexiconCache).toHaveLength(1);
  });
});

describe("importBackup — clears existing data", () => {
  it("replaces existing rows with the backup content", async () => {
    const { db, repo } = makeDb();
    tracked(db);

    await repo.addCard(makeCard("old-word"));
    expect(await repo.getAllCards()).toHaveLength(1);

    const emptyBackup = {
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      tables: {
        profile: [],
        cards: [],
        content: [],
        errorEvents: [],
        weakness: [],
        gamification: [],
        lexiconCache: [],
      },
    };

    await repo.importBackup(emptyBackup);
    expect(await repo.getAllCards()).toHaveLength(0);
  });
});

describe("round-trip: export → import → export", () => {
  it("produces identical table contents and preserves original IDs", async () => {
    const { db: db1, repo: repo1 } = makeDb();
    const { db: db2, repo: repo2 } = makeDb();
    tracked(db1);
    tracked(db2);

    // Populate db1
    await repo1.saveProfile({
      cefrLevel: "C1",
      goals: ["travel", "exam"],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      settings: { ttsRate: 0.8, macLlmModel: "qwen2.5:14b" },
    });
    const cardId = await repo1.addCard(makeCard("serendipity"));
    await repo1.saveGamification({
      xp: 120,
      level: 3,
      streakCount: 5,
      lastActivityDate: "2024-04-01",
      achievements: [{ id: "streak_3", unlockedAt: new Date("2024-03-15T00:00:00Z") }],
    });
    await repo1.putLexiconEntry({
      word: "serendipity",
      data: { definition: "the occurrence of events by chance" },
      cachedAt: new Date("2024-02-01T00:00:00Z"),
    });

    const backup1 = await repo1.exportBackup();

    // Restore into db2
    await repo2.importBackup(backup1);

    // Verify via re-export
    const backup2 = await repo2.exportBackup();

    expect(backup2.tables.profile).toHaveLength(1);
    expect(backup2.tables.profile[0].cefrLevel).toBe("C1");
    expect(backup2.tables.profile[0].settings.ttsRate).toBe(0.8);

    expect(backup2.tables.cards).toHaveLength(1);
    expect(backup2.tables.cards[0].id).toBe(cardId);
    expect(backup2.tables.cards[0].word).toBe("serendipity");
    expect(backup2.tables.cards[0].fsrs.due).toBeInstanceOf(Date);

    expect(backup2.tables.gamification).toHaveLength(1);
    expect(backup2.tables.gamification[0].xp).toBe(120);
    expect(backup2.tables.gamification[0].achievements[0].id).toBe("streak_3");
    expect(backup2.tables.gamification[0].achievements[0].unlockedAt).toBeInstanceOf(Date);

    expect(backup2.tables.lexiconCache).toHaveLength(1);
    expect(backup2.tables.lexiconCache[0].word).toBe("serendipity");
  });

  it("round-trip via JSON.stringify/parse (simulates real export+import flow)", async () => {
    const { db: db1, repo: repo1 } = makeDb();
    const { db: db2, repo: repo2 } = makeDb();
    tracked(db1);
    tracked(db2);

    await repo1.saveProfile({
      cefrLevel: "A2",
      goals: ["general"],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      settings: {},
    });
    await repo1.addCard(makeCard("curious"));

    const backup1 = await repo1.exportBackup();

    // Simulate file download + re-upload
    const jsonString = JSON.stringify(backup1);
    const parsed = BackupSchema.parse(JSON.parse(jsonString) as unknown);
    await repo2.importBackup(parsed);

    const profile = await repo2.getProfile();
    expect(profile?.cefrLevel).toBe("A2");

    const cards = await repo2.getAllCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].word).toBe("curious");
    expect(cards[0].fsrs.due).toBeInstanceOf(Date);
    expect(cards[0].createdAt).toBeInstanceOf(Date);
  });
});

describe("BackupSchema — date coercion", () => {
  it("parses ISO date strings as Date objects on all date fields", () => {
    const raw = {
      version: 1,
      exportedAt: "2024-01-01T00:00:00.000Z",
      tables: {
        profile: [
          {
            id: 1,
            cefrLevel: "B1",
            goals: ["work"],
            createdAt: "2024-01-01T00:00:00.000Z",
            settings: {},
          },
        ],
        cards: [
          {
            id: 1,
            word: "test",
            definition: "a test",
            examples: [],
            cefr: "A1",
            fsrs: {
              due: "2024-06-01T00:00:00.000Z",
              stability: 1,
              difficulty: 5,
              elapsedDays: 0,
              scheduledDays: 1,
              reps: 0,
              lapses: 0,
              state: 0,
            },
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        content: [
          {
            id: 1,
            type: "passage",
            level: "A1",
            topic: "daily life",
            payload: {},
            source: "seed",
            validatedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        errorEvents: [
          {
            id: 1,
            skill: "reading",
            category: "grammar",
            cefr: "A1",
            context: "ctx",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        weakness: [
          {
            skill: "writing",
            category: "vocabulary",
            cefr: "B1",
            score: 0.5,
            confidence: 0.6,
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        gamification: [
          {
            id: 1,
            xp: 10,
            level: 1,
            streakCount: 1,
            lastActivityDate: "2024-01-01",
            achievements: [{ id: "first_review", unlockedAt: "2024-01-01T00:00:00.000Z" }],
          },
        ],
        lexiconCache: [
          {
            word: "test",
            data: {},
            cachedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      },
    };

    const parsed = BackupSchema.parse(raw);

    expect(parsed.tables.profile[0].createdAt).toBeInstanceOf(Date);
    expect(parsed.tables.cards[0].fsrs.due).toBeInstanceOf(Date);
    expect(parsed.tables.cards[0].createdAt).toBeInstanceOf(Date);
    expect(parsed.tables.content[0].validatedAt).toBeInstanceOf(Date);
    expect(parsed.tables.errorEvents[0].createdAt).toBeInstanceOf(Date);
    expect(parsed.tables.weakness[0].updatedAt).toBeInstanceOf(Date);
    expect(parsed.tables.gamification[0].achievements[0].unlockedAt).toBeInstanceOf(Date);
    expect(parsed.tables.lexiconCache[0].cachedAt).toBeInstanceOf(Date);
  });

  it("rejects unknown version", () => {
    expect(() => BackupSchema.parse({ version: 2, exportedAt: "", tables: {} })).toThrow();
  });
});
