import { describe, expect, it } from "vitest";

import {
  applyDeckCardFilters,
  filterDeckCards,
  filterDeckCardsByCefr,
  filterDeckCardsByCollection,
  filterDeckCardsByDue,
  filterDeckCardsByMastery,
  type DeckFilterableCard,
} from "@/lib/deck/filter-deck-cards";

const NOW = new Date("2026-07-09T12:00:00.000Z");

const CARDS: DeckFilterableCard[] = [
  {
    word: "luminous",
    definition: "emitting or reflecting light",
    cefr: "C1",
    fsrsState: 0,
    dueIso: "2026-07-09T11:00:00.000Z",
  },
  {
    word: "run",
    definition: "move swiftly on foot",
    cefr: "A1",
    fsrsState: 1,
    dueIso: "2026-07-10T12:00:00.000Z",
  },
  {
    word: "park",
    definition: "a public garden or recreation area",
    cefr: "A2",
    fsrsState: 2,
    dueIso: "2026-07-09T12:00:00.000Z",
  },
  {
    word: "relearn",
    definition: "study again after forgetting",
    cefr: "B1",
    fsrsState: 3,
    dueIso: "2026-07-15T12:00:00.000Z",
  },
];

describe("filterDeckCards", () => {
  it("returns all cards when the query is empty", () => {
    expect(filterDeckCards(CARDS, "")).toEqual(CARDS);
  });

  it("returns all cards when the query is whitespace only", () => {
    expect(filterDeckCards(CARDS, "   ")).toEqual(CARDS);
  });

  it("matches cards by word substring (case-insensitive)", () => {
    expect(filterDeckCards(CARDS, "LUM")).toEqual([CARDS[0]]);
    expect(filterDeckCards(CARDS, "run")).toEqual([CARDS[1]]);
  });

  it("matches cards by definition substring (case-insensitive)", () => {
    expect(filterDeckCards(CARDS, "GARDEN")).toEqual([CARDS[2]]);
    expect(filterDeckCards(CARDS, "swiftly")).toEqual([CARDS[1]]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterDeckCards(CARDS, "zebra")).toEqual([]);
  });
});

describe("filterDeckCardsByCefr", () => {
  it("returns all cards when cefr is null", () => {
    expect(filterDeckCardsByCefr(CARDS, null)).toEqual(CARDS);
  });

  it("filters to cards at the selected CEFR level", () => {
    expect(filterDeckCardsByCefr(CARDS, "A1")).toEqual([CARDS[1]]);
    expect(filterDeckCardsByCefr(CARDS, "A2")).toEqual([CARDS[2]]);
    expect(filterDeckCardsByCefr(CARDS, "C1")).toEqual([CARDS[0]]);
  });
});

describe("filterDeckCardsByMastery", () => {
  it("returns all cards when mastery is null", () => {
    expect(filterDeckCardsByMastery(CARDS, null)).toEqual(CARDS);
  });

  it("filters to cards in the selected FSRS mastery bucket", () => {
    expect(filterDeckCardsByMastery(CARDS, "new")).toEqual([CARDS[0]]);
    expect(filterDeckCardsByMastery(CARDS, "learning")).toEqual([CARDS[1]]);
    expect(filterDeckCardsByMastery(CARDS, "review")).toEqual([CARDS[2]]);
    expect(filterDeckCardsByMastery(CARDS, "relearning")).toEqual([CARDS[3]]);
  });
});

describe("filterDeckCardsByDue", () => {
  it("returns all cards when due filter is null", () => {
    expect(filterDeckCardsByDue(CARDS, null, NOW)).toEqual(CARDS);
  });

  it("filters to cards due now (due <= now)", () => {
    expect(filterDeckCardsByDue(CARDS, "due", NOW)).toEqual([CARDS[0], CARDS[2]]);
  });

  it("filters to cards due later (due > now)", () => {
    expect(filterDeckCardsByDue(CARDS, "later", NOW)).toEqual([CARDS[1], CARDS[3]]);
  });
});

describe("filterDeckCardsByCollection", () => {
  const cardsWithIds = CARDS.map((card, index) => ({ ...card, id: index + 1 }));

  it("returns all cards when no collection is selected", () => {
    expect(filterDeckCardsByCollection(cardsWithIds, null)).toEqual(cardsWithIds);
  });

  it("returns only cards in the selected collection", () => {
    expect(filterDeckCardsByCollection(cardsWithIds, new Set([1, 3]))).toEqual([
      cardsWithIds[0],
      cardsWithIds[2],
    ]);
  });
});

describe("applyDeckCardFilters", () => {
  it("combines search and facet filters with AND semantics", () => {
    expect(
      applyDeckCardFilters(CARDS, { cefr: "A2", mastery: "review", due: "due" }, "garden", NOW),
    ).toEqual([CARDS[2]]);
  });

  it("returns empty when combined filters exclude every card", () => {
    expect(
      applyDeckCardFilters(CARDS, { cefr: "A1", mastery: "review", due: null }, "", NOW),
    ).toEqual([]);
  });

  it("passes through when all filters are unset and search is empty", () => {
    expect(applyDeckCardFilters(CARDS, { cefr: null, mastery: null, due: null }, "", NOW)).toEqual(
      CARDS,
    );
  });
});
