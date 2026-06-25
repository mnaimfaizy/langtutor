import { beforeEach, describe, expect, it } from "vitest";

import type {
  Cefr,
  ContentRepository,
  ContentType,
  NewCard,
  NewContent,
  NewErrorEvent,
  Profile,
  Skill,
} from "@/lib/db";

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

function makeErrorEvent(
  skill: Skill,
  category: string,
  cefr: Cefr,
  context: string,
): NewErrorEvent {
  return { skill, category, cefr, context, createdAt: new Date(0) };
}

/**
 * Reusable contract suite for the ContentRepository seam. Pass a factory that produces
 * a fresh, empty instance per test. Any implementation wired into lib/registry.ts should
 * pass all of these tests.
 */
export function runContentRepositoryContract(factory: () => ContentRepository): void {
  describe("ContentRepository contract", () => {
    let repo: ContentRepository;

    beforeEach(() => {
      repo = factory();
    });

    // -------------------------------------------------------------------------
    describe("profile (singleton)", () => {
      it("returns undefined before any profile is saved", async () => {
        expect(await repo.getProfile()).toBeUndefined();
      });

      it("round-trips a profile and hides the storage key", async () => {
        const profile: Profile = {
          cefrLevel: "B1",
          goals: ["work", "travel"],
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          settings: { ttsRate: 1, macLlmModel: "qwen2.5:14b" },
        };
        await repo.saveProfile(profile);

        const loaded = await repo.getProfile();
        expect(loaded).toEqual(profile);
      });

      it("stays a single row when saved repeatedly", async () => {
        await repo.saveProfile(makeProfile());
        await repo.saveProfile({ ...makeProfile(), cefrLevel: "C1", goals: ["exam"] });

        expect((await repo.getProfile())?.cefrLevel).toBe("C1");
      });
    });

    // -------------------------------------------------------------------------
    describe("settings (profile.settings)", () => {
      it("defaults to empty settings before any profile exists", async () => {
        expect(await repo.getSettings()).toEqual({});
      });

      it("round-trips settings, creating a settings-only (not-yet-onboarded) profile", async () => {
        await repo.saveSettings({ macLlmBaseUrl: "http://mac:11434/v1", macLlmModel: "qwen" });

        expect(await repo.getSettings()).toEqual({
          macLlmBaseUrl: "http://mac:11434/v1",
          macLlmModel: "qwen",
        });
        expect((await repo.getProfile())?.cefrLevel).toBeUndefined();
      });

      it("preserves onboarding data when saving settings onto an existing profile", async () => {
        await repo.saveProfile({
          cefrLevel: "B1",
          goals: ["work"],
          createdAt: new Date(0),
          settings: {},
        });
        await repo.saveSettings({ macLlmModel: "qwen" });

        const profile = await repo.getProfile();
        expect(profile?.cefrLevel).toBe("B1");
        expect(profile?.goals).toEqual(["work"]);
        expect(profile?.settings).toEqual({ macLlmModel: "qwen" });
      });
    });

    // -------------------------------------------------------------------------
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

      it("getAllCards returns all stored cards", async () => {
        await repo.addCard(makeCard("apple", "A1"));
        await repo.addCard(makeCard("banana", "A1"));

        expect(await repo.getAllCards()).toHaveLength(2);
      });

      it("getDueCards returns only cards due at or before now", async () => {
        const cutoff = new Date("2026-06-22T00:00:00.000Z");
        await repo.addCard(makeCard("due-card", "A1", new Date("2026-06-01T00:00:00.000Z")));
        await repo.addCard(makeCard("future-card", "A1", new Date("2026-12-01T00:00:00.000Z")));

        const due = await repo.getDueCards(cutoff);
        expect(due.map((c) => c.word)).toEqual(["due-card"]);
        expect(await repo.getAllCards()).toHaveLength(2);
      });

      it("getDueCards returns due cards in ascending order by due date", async () => {
        const earlier = new Date("2026-01-01T00:00:00.000Z");
        const later = new Date("2026-03-01T00:00:00.000Z");
        const cutoff = new Date("2026-06-22T00:00:00.000Z");

        // Added in reverse order to verify the sort is index-driven, not insertion-driven.
        await repo.addCard(makeCard("later-card", "A1", later));
        await repo.addCard(makeCard("earlier-card", "A1", earlier));

        const due = await repo.getDueCards(cutoff);
        expect(due.map((c) => c.word)).toEqual(["earlier-card", "later-card"]);
      });
    });

    // -------------------------------------------------------------------------
    describe("content (query filters)", () => {
      it("retrieves content by id", async () => {
        const id = await repo.putContent(makeContent("passage", "A2", "animals"));

        const content = await repo.getContent(id);
        expect(content?.topic).toBe("animals");
      });

      it("queries by type/level/topic", async () => {
        await repo.putContent(makeContent("passage", "A2", "animals"));
        await repo.putContent(makeContent("quiz", "A2", "animals"));
        await repo.putContent(makeContent("passage", "B1", "travel"));

        expect(await repo.queryContent({ type: "passage" })).toHaveLength(2);
        expect(await repo.queryContent({ level: "A2", topic: "animals" })).toHaveLength(2);
        expect(await repo.queryContent()).toHaveLength(3);
      });

      it("uses [type+level] compound filter for joint queries", async () => {
        await repo.putContent(makeContent("passage", "A2", "animals"));
        await repo.putContent(makeContent("quiz", "A2", "animals"));
        await repo.putContent(makeContent("passage", "B1", "travel"));

        const a2Passages = await repo.queryContent({ type: "passage", level: "A2" });
        expect(a2Passages).toHaveLength(1);
        expect(a2Passages[0]?.topic).toBe("animals");

        const b1Passages = await repo.queryContent({ type: "passage", level: "B1" });
        expect(b1Passages).toHaveLength(1);
        expect(b1Passages[0]?.topic).toBe("travel");

        expect(await repo.queryContent({ type: "quiz", level: "B1" })).toHaveLength(0);
      });
    });

    // -------------------------------------------------------------------------
    describe("error events + weakness (compound key)", () => {
      it("uses [skill+cefr] compound filter for joint queries", async () => {
        await repo.addErrorEvent(makeErrorEvent("reading", "past-simple", "A2", "ctx1"));
        await repo.addErrorEvent(makeErrorEvent("reading", "present-perfect", "B1", "ctx2"));
        await repo.addErrorEvent(makeErrorEvent("writing", "articles", "A2", "ctx3"));

        const readingA2 = await repo.queryErrorEvents({ skill: "reading", cefr: "A2" });
        expect(readingA2).toHaveLength(1);
        expect(readingA2[0]?.category).toBe("past-simple");

        expect(await repo.queryErrorEvents({ skill: "reading" })).toHaveLength(2);
        expect(await repo.queryErrorEvents({ skill: "writing", cefr: "A2" })).toHaveLength(1);
        expect(await repo.queryErrorEvents({ skill: "listening" })).toHaveLength(0);
      });

      it("keys weakness by (skill, category, cefr) — same triple overwrites", async () => {
        await repo.addErrorEvent(
          makeErrorEvent("reading", "past-simple", "A2", "He go home yesterday."),
        );
        await repo.addErrorEvent(makeErrorEvent("writing", "articles", "B1", "I saw cat."));

        expect(await repo.queryErrorEvents({ skill: "reading" })).toHaveLength(1);

        const key = { skill: "reading" as const, category: "past-simple", cefr: "A2" as const };
        await repo.putWeakness({ ...key, score: 0.7, confidence: 0.5, updatedAt: new Date(0) });
        await repo.putWeakness({ ...key, score: 0.4, confidence: 0.8, updatedAt: new Date(0) });

        const weaknesses = await repo.getWeaknesses();
        expect(weaknesses).toHaveLength(1);
        expect(weaknesses[0]?.score).toBe(0.4);
      });
    });

    // -------------------------------------------------------------------------
    describe("gamification (singleton)", () => {
      it("returns undefined before any state is saved", async () => {
        expect(await repo.getGamification()).toBeUndefined();
      });

      it("round-trips gamification state", async () => {
        await repo.saveGamification({
          xp: 120,
          level: 2,
          streakCount: 3,
          lastActivityDate: "2026-06-22",
          achievements: [{ id: "first-review", unlockedAt: new Date(0) }],
        });

        expect((await repo.getGamification())?.xp).toBe(120);
      });

      it("overwrites on repeated save (stays a single row)", async () => {
        await repo.saveGamification({
          xp: 100,
          level: 1,
          streakCount: 1,
          lastActivityDate: null,
          achievements: [],
        });
        await repo.saveGamification({
          xp: 200,
          level: 2,
          streakCount: 2,
          lastActivityDate: "2026-06-22",
          achievements: [],
        });

        const state = await repo.getGamification();
        expect(state?.xp).toBe(200);
        expect(state?.level).toBe(2);
      });
    });

    // -------------------------------------------------------------------------
    describe("lexicon cache (case-insensitive)", () => {
      it("caches and retrieves entries case-insensitively", async () => {
        await repo.putLexiconEntry({
          word: "Hatchback",
          data: { def: "a car" },
          cachedAt: new Date(0),
        });

        const entry = await repo.getLexiconEntry("HATCHBACK");
        expect(entry?.word).toBe("hatchback");
      });
    });

    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    describe("backup export/import", () => {
      it("exports an empty backup with correct structure", async () => {
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

      it("round-trips data through export and import", async () => {
        const profile = makeProfile();
        await repo.saveProfile(profile);
        const cardId = await repo.addCard(makeCard("export-test", "B1"));

        const backup = await repo.exportBackup();
        await repo.clear();

        expect(await repo.getProfile()).toBeUndefined();

        await repo.importBackup(backup);

        expect(await repo.getProfile()).toEqual(profile);
        expect((await repo.getCard(cardId))?.word).toBe("export-test");
      });
    });
  });
}
