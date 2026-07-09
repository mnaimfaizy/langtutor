import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getCardCollectionIds,
  buildCollectionMembershipMap,
} from "@/lib/deck/collection-membership";
import { filterDeckCardsByCollection } from "@/lib/deck/filter-deck-cards";
import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import type { NewCard } from "@/lib/db";

let dbCounter = 0;
let db: LangTutorDB;

function makeCard(word: string): NewCard {
  return {
    word,
    definition: `definition of ${word}`,
    examples: [`An example using ${word}.`],
    cefr: "A1",
    fsrs: {
      due: new Date("2026-07-09T12:00:00.000Z"),
      stability: 2.5,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 1,
      reps: 0,
      lapses: 0,
      state: 0,
    },
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
  };
}

beforeEach(() => {
  db = new LangTutorDB(`lang-tutor-deck-collections-test-${dbCounter++}`);
});

afterEach(async () => {
  await db.delete();
});

describe("filterDeckCardsByCollection", () => {
  const cards = [
    { id: 1, word: "cat" },
    { id: 2, word: "dog" },
    { id: 3, word: "bird" },
  ];

  it("returns all cards when no collection is selected", () => {
    expect(filterDeckCardsByCollection(cards, null)).toEqual(cards);
  });

  it("returns only cards in the selected collection", () => {
    expect(filterDeckCardsByCollection(cards, new Set([1, 3]))).toEqual([cards[0], cards[2]]);
  });
});

describe("collection membership helpers", () => {
  it("maps a card to every collection it belongs to", () => {
    const membership = buildCollectionMembershipMap([
      { collectionId: 1, cardIds: [10, 20] },
      { collectionId: 2, cardIds: [20, 30] },
    ]);

    expect(getCardCollectionIds(20, membership).sort()).toEqual([1, 2]);
    expect(getCardCollectionIds(10, membership)).toEqual([1]);
    expect(getCardCollectionIds(99, membership)).toEqual([]);
  });
});

describe("deck collection membership rules (issue #102)", () => {
  it("lets a card belong to multiple collections at once", async () => {
    const repo = new DexieContentRepository(db);
    const animals = await repo.addCollection({ name: "animals", kind: "user" });
    const school = await repo.addCollection({ name: "school", kind: "user" });
    const cardId = await repo.addCard(makeCard("cat"));

    await repo.addCardToCollection(animals, cardId);
    await repo.addCardToCollection(school, cardId);

    expect((await repo.getCollectionCards(animals)).map((c) => c.id)).toEqual([cardId]);
    expect((await repo.getCollectionCards(school)).map((c) => c.id)).toEqual([cardId]);
    expect((await repo.getCollections()).map((c) => c.cardCount).sort()).toEqual([1, 1]);
  });

  it("deleting a collection leaves member cards intact", async () => {
    const repo = new DexieContentRepository(db);
    const travel = await repo.addCollection({ name: "travel", kind: "user" });
    const cardId = await repo.addCard(makeCard("passport"));

    await repo.addCardToCollection(travel, cardId);
    await repo.deleteCollection(travel);

    expect(await repo.getCollections()).toHaveLength(0);
    expect((await repo.getCard(cardId))?.word).toBe("passport");
    expect(await repo.getAllCards()).toHaveLength(1);
  });
});
