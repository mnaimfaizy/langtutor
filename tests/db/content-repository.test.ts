import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import type { Cefr, ContentRepository, ContentType, NewCard, NewContent, Profile } from "@/lib/db";

// A fresh, uniquely-named DB per test keeps fake-indexeddb state isolated.
let dbCounter = 0;
let db: LangTutorDB;
let repo: ContentRepository;

beforeEach(() => {
  db = new LangTutorDB(`lang-tutor-test-${dbCounter++}`);
  repo = new DexieContentRepository(db);
});

afterEach(async () => {
  await db.delete();
});

function makeCard(word: string, cefr: Cefr, due = new Date(0)): NewCard {
  return {
    word,
    definition: `definition of ${word}`,
    examples: [`An example using ${word}.`],
    cefr,
    fsrs: {
      due,
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: 0,
    },
    createdAt: new Date(0),
  };
}

function makeContent(type: ContentType, level: Cefr, topic: string): NewContent {
  return { type, level, topic, payload: { text: "…" }, source: "seed", validatedAt: new Date(0) };
}

function makeProfile(): Profile {
  return { cefrLevel: "A1", goals: [], createdAt: new Date(0), settings: {} };
}

describe("schema versioning", () => {
  it("opens at version 1 with all §4 tables", async () => {
    await db.open();
    expect(db.verno).toBe(1);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      "cards",
      "content",
      "errorEvents",
      "gamification",
      "lexiconCache",
      "profile",
      "weakness",
    ]);
  });
});

describe("profile (singleton)", () => {
  it("round-trips a profile and hides the storage key", async () => {
    expect(await repo.getProfile()).toBeUndefined();

    const profile: Profile = {
      cefrLevel: "B1",
      goals: ["work", "travel"],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      settings: { ttsRate: 1, macLlmModel: "qwen2.5:14b" },
    };
    await repo.saveProfile(profile);

    const loaded = await repo.getProfile();
    expect(loaded).toEqual(profile); // no `id` leaks back to callers
  });

  it("stays a single row when saved repeatedly", async () => {
    await repo.saveProfile(makeProfile());
    await repo.saveProfile({ ...makeProfile(), cefrLevel: "C1", goals: ["exam"] });

    expect((await repo.getProfile())?.cefrLevel).toBe("C1");
    expect(await db.profile.count()).toBe(1);
  });
});

describe("cards (CRUD)", () => {
  it("round-trips a card and assigns a numeric id", async () => {
    const newCard = makeCard("ubiquitous", "B2");
    const id = await repo.addCard(newCard);

    expect(typeof id).toBe("number");
    expect(await repo.getCard(id)).toEqual({ ...newCard, id });
  });

  it("updates and deletes a card", async () => {
    const id = await repo.addCard(makeCard("fine", "A2"));

    await repo.updateCard(id, { definition: "of very high quality" });
    expect((await repo.getCard(id))?.definition).toBe("of very high quality");

    await repo.deleteCard(id);
    expect(await repo.getCard(id)).toBeUndefined();
  });

  it("returns only due cards via the fsrs.due index", async () => {
    await repo.addCard(makeCard("due-card", "A1", new Date("2026-06-01T00:00:00.000Z")));
    await repo.addCard(makeCard("future-card", "A1", new Date("2026-12-01T00:00:00.000Z")));

    const due = await repo.getDueCards(new Date("2026-06-22T00:00:00.000Z"));
    expect(due.map((c) => c.word)).toEqual(["due-card"]);
    expect(await repo.getAllCards()).toHaveLength(2);
  });
});

describe("content", () => {
  it("queries by type/level/topic", async () => {
    await repo.putContent(makeContent("passage", "A2", "animals"));
    await repo.putContent(makeContent("quiz", "A2", "animals"));
    await repo.putContent(makeContent("passage", "B1", "travel"));

    expect(await repo.queryContent({ type: "passage" })).toHaveLength(2);
    expect(await repo.queryContent({ level: "A2", topic: "animals" })).toHaveLength(2);
    expect(await repo.queryContent()).toHaveLength(3);
  });
});

describe("diagnostics + weakness", () => {
  it("filters error events and keys weakness by (skill, category, cefr)", async () => {
    await repo.addErrorEvent({
      skill: "reading",
      category: "past-simple",
      cefr: "A2",
      context: "He go home yesterday.",
      createdAt: new Date(0),
    });
    await repo.addErrorEvent({
      skill: "writing",
      category: "articles",
      cefr: "B1",
      context: "I saw cat.",
      createdAt: new Date(0),
    });

    expect(await repo.queryErrorEvents({ skill: "reading" })).toHaveLength(1);

    const key = { skill: "reading", category: "past-simple", cefr: "A2" } as const;
    await repo.putWeakness({ ...key, score: 0.7, confidence: 0.5, updatedAt: new Date(0) });
    await repo.putWeakness({ ...key, score: 0.4, confidence: 0.8, updatedAt: new Date(0) });

    const weaknesses = await repo.getWeaknesses();
    expect(weaknesses).toHaveLength(1); // same compound key overwrites
    expect(weaknesses[0]?.score).toBe(0.4);
  });
});

describe("gamification (singleton) + lexicon cache", () => {
  it("round-trips gamification state", async () => {
    expect(await repo.getGamification()).toBeUndefined();

    await repo.saveGamification({
      xp: 120,
      level: 2,
      streakCount: 3,
      lastActivityDate: "2026-06-22",
      achievements: [{ id: "first-review", unlockedAt: new Date(0) }],
    });

    expect((await repo.getGamification())?.xp).toBe(120);
    expect(await db.gamification.count()).toBe(1);
  });

  it("caches lexicon entries case-insensitively", async () => {
    await repo.putLexiconEntry({
      word: "Hatchback",
      data: { def: "a car" },
      cachedAt: new Date(0),
    });

    const entry = await repo.getLexiconEntry("HATCHBACK");
    expect(entry?.word).toBe("hatchback");
  });
});

describe("clear()", () => {
  it("wipes every table", async () => {
    await repo.saveProfile(makeProfile());
    await repo.addCard(makeCard("temp", "A1"));
    await repo.putContent(makeContent("passage", "A1", "x"));

    await repo.clear();

    expect(await repo.getProfile()).toBeUndefined();
    expect(await repo.getAllCards()).toEqual([]);
    expect(await repo.queryContent()).toEqual([]);
  });
});
