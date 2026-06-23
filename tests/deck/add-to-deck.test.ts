import { describe, expect, it } from "vitest";

import { buildNewCard, isDuplicate } from "@/lib/deck/add-to-deck";

const NOW = new Date("2025-06-01T09:00:00Z");

// ─── buildNewCard ─────────────────────────────────────────────────────────────

describe("buildNewCard", () => {
  it("populates word, definition, examples, cefr, createdAt from data", () => {
    const card = buildNewCard(
      {
        word: "luminous",
        definition: "emitting or reflecting light",
        examples: ["The luminous stars filled the sky."],
        cefr: "B2",
      },
      NOW,
    );

    expect(card.word).toBe("luminous");
    expect(card.definition).toBe("emitting or reflecting light");
    expect(card.examples).toEqual(["The luminous stars filled the sky."]);
    expect(card.cefr).toBe("B2");
    expect(card.createdAt).toEqual(NOW);
  });

  it("card is due immediately — fsrs.due equals now", () => {
    const card = buildNewCard({ word: "test", definition: "d", examples: [], cefr: "A1" }, NOW);
    expect(card.fsrs.due).toEqual(NOW);
  });

  it("card starts as New (state=0) with no reps or lapses", () => {
    const card = buildNewCard({ word: "test", definition: "d", examples: [], cefr: "A1" }, NOW);
    expect(card.fsrs.state).toBe(0);
    expect(card.fsrs.reps).toBe(0);
    expect(card.fsrs.lapses).toBe(0);
  });

  it("lowercases the word", () => {
    const card = buildNewCard({ word: "Luminous", definition: "d", examples: [], cefr: "B2" }, NOW);
    expect(card.word).toBe("luminous");
  });

  it("attaches the sense disambiguator when provided", () => {
    const card = buildNewCard(
      { word: "run", sense: "v:run:01", definition: "move swiftly", examples: [], cefr: "A1" },
      NOW,
    );
    expect(card.sense).toBe("v:run:01");
  });

  it("sense is undefined when not provided", () => {
    const card = buildNewCard({ word: "run", definition: "d", examples: [], cefr: "A1" }, NOW);
    expect(card.sense).toBeUndefined();
  });

  it("uses the current time when now is omitted", () => {
    const before = new Date();
    const card = buildNewCard({ word: "run", definition: "d", examples: [], cefr: "A1" });
    const after = new Date();
    expect(card.fsrs.due >= before).toBe(true);
    expect(card.fsrs.due <= after).toBe(true);
  });
});

// ─── isDuplicate ──────────────────────────────────────────────────────────────

describe("isDuplicate", () => {
  it("returns false for an empty deck", () => {
    expect(isDuplicate("run", [])).toBe(false);
  });

  it("returns true for an exact match", () => {
    expect(isDuplicate("run", ["walk", "run", "jump"])).toBe(true);
  });

  it("is case-insensitive on the query word", () => {
    expect(isDuplicate("RUN", ["run"])).toBe(true);
  });

  it("is case-insensitive on stored words", () => {
    expect(isDuplicate("run", ["RUN"])).toBe(true);
  });

  it("returns false for a different word", () => {
    expect(isDuplicate("sprint", ["run", "walk"])).toBe(false);
  });

  it("returns false for a prefix match (not a full match)", () => {
    expect(isDuplicate("run", ["runner", "running"])).toBe(false);
  });
});
