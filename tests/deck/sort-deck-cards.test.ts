import { describe, expect, it } from "vitest";

import {
  compareDeckCardsByAlphabet,
  compareDeckCardsByDue,
  compareDeckCardsByRecency,
  sortDeckCards,
  type DeckSortableCard,
} from "@/lib/deck/sort-deck-cards";

const CARDS: DeckSortableCard[] = [
  {
    id: 1,
    word: "zebra",
    dueIso: "2026-07-15T12:00:00.000Z",
    createdAtIso: "2026-06-01T12:00:00.000Z",
    lastReviewIso: "2026-07-01T12:00:00.000Z",
  },
  {
    id: 2,
    word: "apple",
    dueIso: "2026-07-09T11:00:00.000Z",
    createdAtIso: "2026-07-09T10:00:00.000Z",
  },
  {
    id: 3,
    word: "mango",
    dueIso: "2026-07-09T12:00:00.000Z",
    createdAtIso: "2026-05-01T12:00:00.000Z",
    lastReviewIso: "2026-07-08T12:00:00.000Z",
  },
  {
    id: 4,
    word: "banana",
    dueIso: "2026-07-10T12:00:00.000Z",
    createdAtIso: "2026-07-07T12:00:00.000Z",
    lastReviewIso: "2026-07-09T09:00:00.000Z",
  },
];

describe("compareDeckCardsByDue", () => {
  it("orders soonest-due cards first", () => {
    expect([...CARDS].sort(compareDeckCardsByDue).map((card) => card.word)).toEqual([
      "apple",
      "mango",
      "banana",
      "zebra",
    ]);
  });
});

describe("compareDeckCardsByRecency", () => {
  it("orders most recently added or reviewed cards first", () => {
    expect([...CARDS].sort(compareDeckCardsByRecency).map((card) => card.word)).toEqual([
      "apple",
      "banana",
      "mango",
      "zebra",
    ]);
  });

  it("uses createdAt when a card has never been reviewed", () => {
    const neverReviewed: DeckSortableCard = {
      id: 10,
      word: "newest",
      dueIso: "2026-08-01T12:00:00.000Z",
      createdAtIso: "2026-07-09T23:00:00.000Z",
    };
    expect(compareDeckCardsByRecency(neverReviewed, CARDS[3]!)).toBeLessThan(0);
  });
});

describe("compareDeckCardsByAlphabet", () => {
  it("orders cards alphabetically by word", () => {
    expect([...CARDS].sort(compareDeckCardsByAlphabet).map((card) => card.word)).toEqual([
      "apple",
      "banana",
      "mango",
      "zebra",
    ]);
  });
});

describe("sortDeckCards", () => {
  it("does not mutate the input array", () => {
    const input = [...CARDS];
    const sorted = sortDeckCards(input, "alphabet");
    expect(input).toEqual(CARDS);
    expect(sorted).not.toBe(input);
  });

  it("applies the selected sort mode", () => {
    expect(sortDeckCards(CARDS, "due").map((card) => card.word)).toEqual([
      "apple",
      "mango",
      "banana",
      "zebra",
    ]);
  });
});
