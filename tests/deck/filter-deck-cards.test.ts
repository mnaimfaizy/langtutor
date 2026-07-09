import { describe, expect, it } from "vitest";

import { filterDeckCards } from "@/lib/deck/filter-deck-cards";

const CARDS = [
  { id: 1, word: "luminous", definition: "emitting or reflecting light" },
  { id: 2, word: "run", definition: "move swiftly on foot" },
  { id: 3, word: "park", definition: "a public garden or recreation area" },
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
