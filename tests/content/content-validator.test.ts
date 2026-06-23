import { describe, expect, it } from "vitest";

import type { CefrData } from "@/lib/lexicon";
import { GRAMMAR_MAP } from "@/lib/content/grammar-map";
import {
  validate,
  type GrammarViolation,
  type WordViolation,
} from "@/lib/content/content-validator";

// ── fixtures ─────────────────────────────────────────────────────────────────
// Inject a small, deterministic CEFR dataset so tests never depend on the
// gitignored data/words-cefr.json.

const CEFR: CefrData = {
  // A1
  a: "A1",
  an: "A1",
  the: "A1",
  she: "A1",
  he: "A1",
  they: "A1",
  goes: "A1",
  went: "A1",
  store: "A1",
  every: "A1",
  day: "A1",
  good: "A1",
  school: "A1",
  eat: "A1",
  food: "A1",
  big: "A1",
  small: "A1",
  // A2
  usually: "A2",
  often: "A2",
  describe: "A2",
  recent: "A2",
  suggest: "A2",
  // B1
  achieve: "B1",
  demonstrate: "B1",
  require: "B1",
  typical: "B1",
  // B2
  subsequently: "B2",
  fundamental: "B2",
  substantial: "B2",
  // C1
  exacerbate: "C1",
  paramount: "C1",
  cognitive: "C1",
  // C2
  perspicacious: "C2",
  recondite: "C2",
};

// Use the real grammar map (committed data) for grammar-detection tests.
const MAP = GRAMMAR_MAP;

// ── word violations ───────────────────────────────────────────────────────────

describe("word violations", () => {
  it("fails when a C1 word appears in text targeted at A2 — the offending word is named", () => {
    const result = validate("The scientist tried to exacerbate the situation.", "A2", CEFR, MAP);
    expect(result.ok).toBe(false);
    const wordViol = result.violations.filter((v): v is WordViolation => v.type === "word");
    expect(wordViol.length).toBeGreaterThan(0);
    const exacerbate = wordViol.find((v) => v.word === "exacerbate");
    expect(exacerbate).toBeDefined();
    expect(exacerbate?.wordLevel).toBe("C1");
    expect(exacerbate?.targetLevel).toBe("A2");
  });

  it("passes for a clean A2 sentence with no above-target words", () => {
    const result = validate("She usually goes to the store every day.", "A2", CEFR, MAP);
    const wordViol = result.violations.filter((v): v is WordViolation => v.type === "word");
    expect(wordViol).toHaveLength(0);
  });

  it("flags a B2 word when target is A1", () => {
    const result = validate("She subsequently left.", "A1", CEFR, MAP);
    expect(result.ok).toBe(false);
    const wordViol2 = result.violations.filter((v): v is WordViolation => v.type === "word");
    const v = wordViol2.find((v) => v.word === "subsequently");
    expect(v).toBeDefined();
    expect(v?.wordLevel).toBe("B2");
  });

  it("does not flag a word at exactly the target level", () => {
    const result = validate("She usually goes.", "A2", CEFR, MAP);
    const wordViol = result.violations.filter((v): v is WordViolation => v.type === "word");
    const usually = wordViol.find((v) => v.word === "usually");
    expect(usually).toBeUndefined();
  });

  it("does not flag a word below the target level", () => {
    const result = validate("She went to school.", "B1", CEFR, MAP);
    const wordViol = result.violations.filter((v): v is WordViolation => v.type === "word");
    // "went" is A1, "school" is A1 — both below B1
    expect(wordViol).toHaveLength(0);
  });

  it("ignores words absent from the CEFR dataset", () => {
    const result = validate("The xenomorphic entity arrived.", "A1", CEFR, MAP);
    const wordViol = result.violations.filter((v): v is WordViolation => v.type === "word");
    // "xenomorphic", "entity", "arrived" are not in CEFR fixture → no violation
    expect(wordViol).toHaveLength(0);
  });

  it("deduplicates: repeated words produce only one violation each", () => {
    const result = validate("Exacerbate, exacerbate, exacerbate!", "A2", CEFR, MAP);
    const wordViol = result.violations.filter((v) => v.type === "word" && v.word === "exacerbate");
    expect(wordViol).toHaveLength(1);
  });

  it("flags multiple distinct above-target words", () => {
    const result = validate("She was perspicacious and paramount.", "A1", CEFR, MAP);
    const wordViol = result.violations.filter((v): v is WordViolation => v.type === "word");
    expect(wordViol.length).toBeGreaterThanOrEqual(2);
  });
});

// ── grammar violations ────────────────────────────────────────────────────────

describe("grammar violations", () => {
  it("flags a second conditional (B2) when target is B1", () => {
    const result = validate("If she studied harder, she would pass the exam.", "B1", CEFR, MAP);
    const grammarViol = result.violations.filter(
      (v): v is GrammarViolation => v.type === "grammar",
    );
    const secondCond = grammarViol.find((v) => v.constructionId === "second_conditional");
    expect(secondCond).toBeDefined();
    expect(secondCond?.constructionLevel).toBe("B2");
    expect(secondCond?.targetLevel).toBe("B1");
  });

  it("does not flag a construction at or below the target level", () => {
    const result = validate("I was reading when she called.", "A2", CEFR, MAP);
    // past_continuous is A2 — not above A2
    const grammarViol = result.violations.filter(
      (v): v is GrammarViolation => v.type === "grammar",
    );
    const pastCont = grammarViol.find((v) => v.constructionId === "past_continuous");
    expect(pastCont).toBeUndefined();
  });

  it("grammar violation includes construction id and label", () => {
    const result = validate("If she had known, she would have acted differently.", "B1", CEFR, MAP);
    const grammarViol = result.violations.filter(
      (v): v is GrammarViolation => v.type === "grammar",
    );
    const thirdCond = grammarViol.find((v) => v.constructionId === "third_conditional");
    expect(thirdCond?.constructionLabel).toBeTruthy();
    expect(thirdCond?.constructionLevel).toBe("B2");
  });
});

// ── combined / edge cases ─────────────────────────────────────────────────────

describe("combined and edge cases", () => {
  it("ok is false when there are any violations", () => {
    const result = validate("She exacerbate.", "A2", CEFR, MAP);
    expect(result.ok).toBe(false);
  });

  it("ok is true and violations is empty for a clean sentence", () => {
    const result = validate("She went to school.", "B2", CEFR, MAP);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("returns ok:true for an empty string", () => {
    const result = validate("", "A1", CEFR, MAP);
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
