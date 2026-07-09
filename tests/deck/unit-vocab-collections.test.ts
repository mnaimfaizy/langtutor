import { describe, expect, it } from "vitest";

import {
  deriveUnitVocabCollections,
  isDerivedUnitVocabCollection,
  unitVocabCollectionId,
} from "@/lib/deck/unit-vocab-collections";
import type { Unit } from "@/lib/db";

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 1,
    index: 0,
    title: "Talking About Now",
    teacherNote: "note",
    targetGrammarIds: ["simple_present"],
    targetVocab: ["now", "today"],
    targetCefr: "A1",
    activities: [],
    status: "completed",
    bufferStatus: "empty",
    createdAt: new Date(0),
    ...overrides,
  };
}

describe("deriveUnitVocabCollections", () => {
  const cards = [
    { id: 10, word: "now" },
    { id: 11, word: "today" },
    { id: 12, word: "cat" },
  ];

  it("creates one virtual collection per completed unit with target vocab", () => {
    const units = [
      unit({ id: 1, index: 0, title: "Talking About Now", targetVocab: ["now", "today"] }),
      unit({
        id: 2,
        index: 1,
        title: "Past Simple",
        targetVocab: ["walked", "yesterday"],
        status: "completed",
      }),
    ];

    const { collections, membershipByCollection } = deriveUnitVocabCollections(units, cards);

    expect(collections).toEqual([
      {
        id: unitVocabCollectionId(1),
        name: "Talking About Now",
        kind: "unit",
        cardCount: 2,
      },
      {
        id: unitVocabCollectionId(2),
        name: "Past Simple",
        kind: "unit",
        cardCount: 0,
      },
    ]);
    expect([...membershipByCollection.get(unitVocabCollectionId(1))!].sort()).toEqual([10, 11]);
    expect(membershipByCollection.get(unitVocabCollectionId(2))).toEqual(new Set());
  });

  it("skips units that are not completed or have empty target vocab", () => {
    const units = [
      unit({ id: 1, status: "in-progress" }),
      unit({ id: 2, status: "completed", targetVocab: [] }),
      unit({ id: 3, status: "locked", targetVocab: ["now"] }),
    ];

    expect(deriveUnitVocabCollections(units, cards).collections).toEqual([]);
  });

  it("matches learner cards case-insensitively and only includes owned cards", () => {
    const units = [unit({ targetVocab: ["NOW", "missing"] })];
    const owned = [
      { id: 20, word: "Now" },
      { id: 21, word: "TODAY" },
    ];

    const { collections, membershipByCollection } = deriveUnitVocabCollections(units, owned);

    expect(collections[0]?.cardCount).toBe(1);
    expect([...membershipByCollection.get(unitVocabCollectionId(1))!]).toEqual([20]);
  });

  it("orders collections by unit index ascending", () => {
    const units = [
      unit({ id: 5, index: 2, title: "Later" }),
      unit({ id: 3, index: 0, title: "First" }),
      unit({ id: 4, index: 1, title: "Middle" }),
    ];

    expect(deriveUnitVocabCollections(units, cards).collections.map((c) => c.name)).toEqual([
      "First",
      "Middle",
      "Later",
    ]);
  });
});

describe("isDerivedUnitVocabCollection", () => {
  it("identifies virtual unit vocab collections", () => {
    expect(isDerivedUnitVocabCollection({ id: unitVocabCollectionId(7), kind: "unit" })).toBe(true);
    expect(isDerivedUnitVocabCollection({ id: 3, kind: "unit" })).toBe(false);
    expect(isDerivedUnitVocabCollection({ id: 1, kind: "user" })).toBe(false);
  });
});
