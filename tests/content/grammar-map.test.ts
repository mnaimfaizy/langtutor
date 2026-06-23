import { describe, expect, it } from "vitest";

import {
  GRAMMAR_MAP,
  constructionsByLevel,
  grammarLevel,
  levelCoverage,
  lookupConstruction,
} from "@/lib/content/grammar-map";

// ── level coverage (snapshot) ─────────────────────────────────────────────────

describe("level coverage", () => {
  it("covers all six CEFR levels (snapshot)", () => {
    expect(levelCoverage(GRAMMAR_MAP)).toMatchInlineSnapshot(`
      {
        "A1": 7,
        "A2": 7,
        "B1": 8,
        "B2": 7,
        "C1": 6,
        "C2": 4,
      }
    `);
  });

  it("every CEFR level has at least one construction", () => {
    const coverage = levelCoverage(GRAMMAR_MAP);
    for (const level of ["A1", "A2", "B1", "B2", "C1", "C2"] as const) {
      expect(coverage[level], `${level} must have ≥1 construction`).toBeGreaterThan(0);
    }
  });

  it("all construction ids are unique", () => {
    const ids = GRAMMAR_MAP.map((c) => c.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("every construction has non-empty markers and examples", () => {
    for (const c of GRAMMAR_MAP) {
      expect(c.markers.length, `${c.id} markers`).toBeGreaterThan(0);
      expect(c.examples.length, `${c.id} examples`).toBeGreaterThan(0);
    }
  });
});

// ── grammarLevel() ───────────────────────────────────────────────────────────

describe("grammarLevel()", () => {
  it("returns the correct level for one construction from each CEFR band", () => {
    expect(grammarLevel("simple_present")).toBe("A1");
    expect(grammarLevel("past_continuous")).toBe("A2");
    expect(grammarLevel("first_conditional")).toBe("B1");
    expect(grammarLevel("second_conditional")).toBe("B2");
    expect(grammarLevel("inversion_emphasis")).toBe("C1");
    expect(grammarLevel("absolute_constructions")).toBe("C2");
  });

  it("returns null for an unknown construction id", () => {
    expect(grammarLevel("nonexistent_construction")).toBeNull();
  });
});

// ── lookupConstruction() ─────────────────────────────────────────────────────

describe("lookupConstruction()", () => {
  it("returns the full construction object for a known id", () => {
    const c = lookupConstruction("present_continuous");
    expect(c).toBeDefined();
    expect(c?.cefr).toBe("A1");
    expect(c?.label).toBeTruthy();
    expect(c?.description).toBeTruthy();
    expect(c?.markers.length).toBeGreaterThan(0);
    expect(c?.examples.length).toBeGreaterThan(0);
  });

  it("returns undefined for an unknown id", () => {
    expect(lookupConstruction("nonexistent")).toBeUndefined();
  });
});

// ── constructionsByLevel() ───────────────────────────────────────────────────

describe("constructionsByLevel()", () => {
  it("returns only constructions at the requested level", () => {
    const b2 = constructionsByLevel("B2");
    expect(b2.length).toBeGreaterThan(0);
    expect(b2.every((c) => c.cefr === "B2")).toBe(true);
  });

  it("each construction has all required fields", () => {
    for (const c of constructionsByLevel("C1")) {
      expect(c.id).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(c.cefr).toBe("C1");
      expect(c.description).toBeTruthy();
      expect(Array.isArray(c.markers)).toBe(true);
      expect(Array.isArray(c.examples)).toBe(true);
    }
  });
});
