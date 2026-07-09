import { beforeEach, describe, expect, it } from "vitest";

import { initCard, scheduleCard } from "@/lib/srs/fsrs-wrapper";

import type {
  Cefr,
  ContentRepository,
  ContentType,
  MediaAsset,
  MediaAssetKey,
  NewCard,
  NewContent,
  NewErrorEvent,
  NewUnit,
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

function makeUnit(index: number, overrides: Partial<NewUnit> = {}): NewUnit {
  return {
    index,
    title: `Unit ${index + 1}: Simple present tense`,
    teacherNote: "Base verb form for habitual actions, facts, and permanent states.",
    targetGrammarIds: ["simple_present"],
    targetVocab: [],
    targetCefr: "A1",
    activities: [{ skill: "reading" }, { skill: "writing" }],
    status: index === 0 ? "available" : "locked",
    bufferStatus: "empty",
    createdAt: new Date(0),
    ...overrides,
  };
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

      it("leaves experienceMode undefined (adult default) when not specified", async () => {
        await repo.saveProfile(makeProfile());

        expect((await repo.getProfile())?.experienceMode).toBeUndefined();
      });

      it("round-trips experienceMode", async () => {
        await repo.saveProfile({ ...makeProfile(), experienceMode: "kid" });

        expect((await repo.getProfile())?.experienceMode).toBe("kid");
      });

      it("updates experienceMode on repeated save", async () => {
        await repo.saveProfile({ ...makeProfile(), experienceMode: "kid" });
        await repo.saveProfile({ ...makeProfile(), experienceMode: "adult" });

        expect((await repo.getProfile())?.experienceMode).toBe("adult");
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

      it("getDueCards excludes suspended cards but keeps their FSRS state", async () => {
        const cutoff = new Date("2026-06-22T00:00:00.000Z");
        const id = await repo.addCard(
          makeCard("suspended-card", "A1", new Date("2026-06-01T00:00:00.000Z")),
        );
        const before = await repo.getCard(id);
        await repo.suspendCard(id);

        expect(await repo.getDueCards(cutoff)).toHaveLength(0);
        const after = await repo.getCard(id);
        expect(after?.fsrs).toEqual(before?.fsrs);
        expect(after?.suspended).toBe(true);
      });

      it("resetCardProgress reinitializes FSRS to a new-card state", async () => {
        const T0 = new Date("2025-01-01T12:00:00.000Z");
        const id = await repo.addCard({
          ...makeCard("reset-me", "A1", T0),
          fsrs: scheduleCard(initCard(T0), "easy", T0),
        });

        await repo.resetCardProgress(id, T0);

        expect((await repo.getCard(id))?.fsrs).toEqual(initCard(T0));
      });
    });

    // -------------------------------------------------------------------------
    describe("deck collections (issue #90)", () => {
      it("round-trips a collection and lists it with card count", async () => {
        const id = await repo.addCollection({ name: "Travel words", kind: "user" });

        expect(await repo.getCollections()).toEqual([
          { id, name: "Travel words", kind: "user", cardCount: 0 },
        ]);
      });

      it("renames a collection", async () => {
        const id = await repo.addCollection({ name: "Old name", kind: "user" });
        await repo.renameCollection(id, "New name");

        expect((await repo.getCollections())[0]?.name).toBe("New name");
      });

      it("manages card membership and lists cards in a collection", async () => {
        const collectionId = await repo.addCollection({ name: "Unit deck", kind: "unit" });
        const cardA = await repo.addCard(makeCard("alpha", "A1"));
        const cardB = await repo.addCard(makeCard("beta", "A1"));

        await repo.addCardToCollection(collectionId, cardA);
        await repo.addCardToCollection(collectionId, cardB);
        await repo.addCardToCollection(collectionId, cardA);

        expect((await repo.getCollections())[0]?.cardCount).toBe(2);
        expect((await repo.getCollectionCards(collectionId)).map((c) => c.word).sort()).toEqual([
          "alpha",
          "beta",
        ]);
      });

      it("removes a card from a collection without deleting the card", async () => {
        const collectionId = await repo.addCollection({ name: "Subset", kind: "user" });
        const cardId = await repo.addCard(makeCard("keep-me", "A1"));
        await repo.addCardToCollection(collectionId, cardId);

        await repo.removeCardFromCollection(collectionId, cardId);

        expect((await repo.getCollections())[0]?.cardCount).toBe(0);
        expect(await repo.getCard(cardId)).toBeDefined();
      });

      it("deleting a collection does not delete member cards", async () => {
        const collectionId = await repo.addCollection({ name: "Temporary", kind: "user" });
        const cardId = await repo.addCard(makeCard("survivor", "A1"));
        await repo.addCardToCollection(collectionId, cardId);

        await repo.deleteCollection(collectionId);

        expect(await repo.getCollections()).toHaveLength(0);
        expect((await repo.getCard(cardId))?.word).toBe("survivor");
      });

      it("unsuspendCard clears the suspended flag", async () => {
        const id = await repo.addCard(makeCard("back-in-queue", "A1", new Date(0)));
        await repo.suspendCard(id);
        await repo.unsuspendCard(id);

        expect((await repo.getCard(id))?.suspended).toBeFalsy();
        expect(await repo.getDueCards(new Date())).toHaveLength(1);
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
    describe("quest state (singleton)", () => {
      it("returns undefined before any state is saved", async () => {
        expect(await repo.getQuestState()).toBeUndefined();
      });

      it("round-trips quest state", async () => {
        await repo.saveQuestState({
          dailyPeriodStart: "2026-06-22",
          weeklyPeriodStart: "2026-06-16",
          entries: [
            { questId: "daily-review-10", progress: 4, completedAt: null },
            {
              questId: "daily-finish-unit",
              progress: 1,
              completedAt: new Date("2026-06-22T12:00:00.000Z"),
            },
          ],
        });

        const loaded = await repo.getQuestState();
        expect(loaded?.dailyPeriodStart).toBe("2026-06-22");
        expect(loaded?.entries).toHaveLength(2);
        expect(loaded?.entries[1]?.completedAt).toEqual(new Date("2026-06-22T12:00:00.000Z"));
      });

      it("overwrites on repeated save (stays a single row)", async () => {
        await repo.saveQuestState({
          dailyPeriodStart: "2026-06-21",
          weeklyPeriodStart: null,
          entries: [],
        });
        await repo.saveQuestState({
          dailyPeriodStart: "2026-06-22",
          weeklyPeriodStart: "2026-06-16",
          entries: [{ questId: "daily-review-10", progress: 1, completedAt: null }],
        });

        const state = await repo.getQuestState();
        expect(state?.dailyPeriodStart).toBe("2026-06-22");
        expect(state?.entries).toHaveLength(1);
      });
    });

    // -------------------------------------------------------------------------
    describe("collectible grants", () => {
      const grantedAt = new Date("2026-06-22T15:00:00.000Z");

      it("returns an empty array before any grant", async () => {
        expect(await repo.getCollectibles()).toEqual([]);
      });

      it("round-trips a collectible grant", async () => {
        await repo.grantCollectible("sticker-fox", 42, grantedAt);

        expect(await repo.getCollectibles()).toEqual([
          { collectibleId: "sticker-fox", unitId: 42, grantedAt },
        ]);
      });

      it("granting the same collectible for the same unit twice is a no-op", async () => {
        await repo.grantCollectible("sticker-fox", 42, grantedAt);
        await repo.grantCollectible("sticker-fox", 42, new Date("2026-06-23T00:00:00.000Z"));

        const grants = await repo.getCollectibles();
        expect(grants).toHaveLength(1);
        expect(grants[0]?.grantedAt).toEqual(grantedAt);
      });

      it("allows the same collectible for different units", async () => {
        await repo.grantCollectible("sticker-fox", 1, grantedAt);
        await repo.grantCollectible("sticker-fox", 2, grantedAt);

        expect(await repo.getCollectibles()).toHaveLength(2);
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
    describe("units (learning path, ADR 0015)", () => {
      it("returns an empty array before any unit is added", async () => {
        expect(await repo.getUnits()).toEqual([]);
      });

      it("round-trips a unit and assigns a numeric id", async () => {
        const newUnit = makeUnit(0);
        const id = await repo.addUnit(newUnit);

        expect(typeof id).toBe("number");
        const units = await repo.getUnits();
        expect(units).toEqual([{ ...newUnit, id }]);
      });

      it("returns units ordered by index ascending, regardless of insert order", async () => {
        await repo.addUnit(makeUnit(2));
        await repo.addUnit(makeUnit(0));
        await repo.addUnit(makeUnit(1));

        const units = await repo.getUnits();
        expect(units.map((u) => u.index)).toEqual([0, 1, 2]);
      });

      it("defaults the first unit to available and later units to locked", async () => {
        await repo.addUnit(makeUnit(0));
        await repo.addUnit(makeUnit(1));

        const units = await repo.getUnits();
        expect(units.find((u) => u.index === 0)?.status).toBe("available");
        expect(units.find((u) => u.index === 1)?.status).toBe("locked");
      });

      it("patches fields via updateUnit, e.g. a status transition", async () => {
        const id = await repo.addUnit(makeUnit(0));

        await repo.updateUnit(id, { status: "in-progress" });

        const units = await repo.getUnits();
        expect(units[0]?.status).toBe("in-progress");
        expect(units[0]?.title).toBe(makeUnit(0).title);
      });

      it("persists a teacher-planned title/note/vocab via updateUnit (issue #58)", async () => {
        const id = await repo.addUnit(makeUnit(0));

        await repo.updateUnit(id, {
          title: "Talking About Yesterday",
          teacherNote: "This unit builds on the learner's goal of chatting about daily life.",
          targetVocab: ["yesterday", "walked", "finished", "already"],
        });

        const units = await repo.getUnits();
        expect(units[0]?.title).toBe("Talking About Yesterday");
        expect(units[0]?.targetVocab).toEqual(["yesterday", "walked", "finished", "already"]);
      });

      it("preserves activity order and content", async () => {
        const unit = makeUnit(0, {
          activities: [{ skill: "reading" }, { skill: "writing" }, { skill: "listening" }],
        });
        await repo.addUnit(unit);

        const units = await repo.getUnits();
        expect(units[0]?.activities).toEqual([
          { skill: "reading" },
          { skill: "writing" },
          { skill: "listening" },
        ]);
      });

      it("deletes a unit by id", async () => {
        const id = await repo.addUnit(makeUnit(-1));
        await repo.addUnit(makeUnit(0));

        await repo.deleteUnit(id);

        const units = await repo.getUnits();
        expect(units).toHaveLength(1);
        expect(units[0]?.index).toBe(0);
      });
    });

    // -------------------------------------------------------------------------
    describe("media assets (shared store, ADR 0016)", () => {
      const imageKey: MediaAssetKey = {
        kind: "image",
        key: "apple",
        style: "kid-illustration",
      };

      function makeAsset(key: MediaAssetKey, byte: number): MediaAsset {
        return {
          ...key,
          data: new Uint8Array([byte, byte + 1]),
          mimeType: key.kind === "image" ? "image/png" : "audio/mpeg",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          source: "generated",
          approvalStatus: "approved",
        };
      }

      it("returns undefined before any asset is stored", async () => {
        expect(await repo.getMediaAsset(imageKey)).toBeUndefined();
      });

      it("round-trips an image asset", async () => {
        const asset = makeAsset(imageKey, 1);
        await repo.putMediaAsset(asset);

        const loaded = await repo.getMediaAsset(imageKey);
        expect(loaded).toEqual(asset);
      });

      it("round-trips an audio asset under a distinct key", async () => {
        const audioKey: MediaAssetKey = { kind: "audio", key: "apple", style: "default" };
        const asset = makeAsset(audioKey, 42);
        await repo.putMediaAsset(asset);

        expect(await repo.getMediaAsset(audioKey)).toEqual(asset);
      });

      it("looks up keys case-insensitively on the word/phrase", async () => {
        const asset = makeAsset(imageKey, 7);
        await repo.putMediaAsset(asset);

        const loaded = await repo.getMediaAsset({
          kind: "image",
          key: "APPLE",
          style: "kid-illustration",
        });
        expect(loaded?.key).toBe("apple");
        expect(loaded?.data).toEqual(asset.data);
      });

      it("overwrites on put for the same (kind, key, style)", async () => {
        await repo.putMediaAsset(makeAsset(imageKey, 1));
        const updated = makeAsset(imageKey, 99);
        await repo.putMediaAsset(updated);

        expect(await repo.getMediaAsset(imageKey)).toEqual(updated);
      });

      it("hides pending images from learner-facing getMediaAsset", async () => {
        await repo.putMediaAsset({
          ...makeAsset(imageKey, 5),
          approvalStatus: "pending",
        });

        expect(await repo.getMediaAsset(imageKey)).toBeUndefined();
        expect((await repo.getMediaAssetRaw(imageKey))?.approvalStatus).toBe("pending");
      });

      it("approveMediaAsset makes a pending image visible to learners", async () => {
        await repo.putMediaAsset({
          ...makeAsset(imageKey, 5),
          approvalStatus: "pending",
        });

        await repo.approveMediaAsset(imageKey);

        expect((await repo.getMediaAsset(imageKey))?.approvalStatus).toBe("approved");
      });

      it("curated-pack assets default to approved and are learner-visible", async () => {
        await repo.putMediaAsset({
          ...makeAsset(imageKey, 8),
          source: "curated-pack",
          approvalStatus: "approved",
        });

        expect(await repo.getMediaAsset(imageKey)).toBeDefined();
        expect(await repo.queryMediaAssets({ approvalStatus: "approved" })).toHaveLength(1);
      });

      it("deleteMediaAsset removes the asset", async () => {
        await repo.putMediaAsset(makeAsset(imageKey, 3));
        await repo.deleteMediaAsset(imageKey);
        expect(await repo.getMediaAssetRaw(imageKey)).toBeUndefined();
      });

      it("queryMediaAssets omits binary payloads", async () => {
        await repo.putMediaAsset(makeAsset(imageKey, 4));
        const rows = await repo.queryMediaAssets({ kind: "image" });
        expect(rows[0]).toMatchObject({
          kind: "image",
          key: "apple",
          style: "kid-illustration",
          approvalStatus: "approved",
        });
        expect(rows[0]).not.toHaveProperty("data");
      });
    });

    // -------------------------------------------------------------------------
    describe("clear()", () => {
      it("wipes every table", async () => {
        await repo.saveProfile(makeProfile());
        const cardId = await repo.addCard(makeCard("temp", "A1"));
        const collectionId = await repo.addCollection({ name: "temp", kind: "user" });
        await repo.addCardToCollection(collectionId, cardId);
        await repo.putContent(makeContent("passage", "A1", "x"));
        await repo.putMediaAsset({
          kind: "image",
          key: "temp",
          style: "default",
          data: new Uint8Array([0]),
          mimeType: "image/png",
          createdAt: new Date(0),
          source: "generated",
          approvalStatus: "approved",
        });
        await repo.addUnit(makeUnit(0));
        await repo.saveQuestState({
          dailyPeriodStart: "2026-06-22",
          weeklyPeriodStart: null,
          entries: [],
        });
        await repo.grantCollectible("sticker-fox", 1, new Date(0));

        await repo.clear();

        expect(await repo.getProfile()).toBeUndefined();
        expect(await repo.getAllCards()).toEqual([]);
        expect(await repo.queryContent()).toEqual([]);
        expect(
          await repo.getMediaAsset({ kind: "image", key: "temp", style: "default" }),
        ).toBeUndefined();
        expect(await repo.getUnits()).toEqual([]);
        expect(await repo.getQuestState()).toBeUndefined();
        expect(await repo.getCollectibles()).toEqual([]);
        expect(await repo.getCollections()).toEqual([]);
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
        expect(backup.tables.units).toHaveLength(0);
      });

      it("round-trips data through export and import", async () => {
        const profile = makeProfile();
        await repo.saveProfile(profile);
        await repo.addCard(makeCard("export-test", "B1"));
        await repo.addUnit(makeUnit(0));

        const backup = await repo.exportBackup();
        await repo.clear();

        expect(await repo.getProfile()).toBeUndefined();

        await repo.importBackup(backup);

        expect(await repo.getProfile()).toEqual(profile);
        const cards = await repo.getAllCards();
        expect(cards).toHaveLength(1);
        expect(cards[0].word).toBe("export-test");
        const units = await repo.getUnits();
        expect(units).toHaveLength(1);
        expect(units[0]?.title).toBe(makeUnit(0).title);
      });

      it("importBackup defaults to an empty path for old-format backups without units", async () => {
        const backup = await repo.exportBackup();
        const { units: _units, ...tablesWithoutUnits } = backup.tables;
        void _units;

        await repo.importBackup({ ...backup, tables: tablesWithoutUnits });

        expect(await repo.getUnits()).toEqual([]);
      });
    });
  });
}
