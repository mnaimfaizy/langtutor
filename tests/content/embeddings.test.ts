import { describe, expect, it } from "vitest";

import { cosineSimilarity, findNearest } from "@/lib/content/embeddings";

// ── cosineSimilarity() ────────────────────────────────────────────────────────

describe("cosineSimilarity()", () => {
  it("returns 1 for identical vectors (unit)", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1.0);
    expect(cosineSimilarity([0, 1], [0, 1])).toBeCloseTo(1.0);
  });

  it("returns 1 for identical vectors (non-unit) — magnitude-invariant", () => {
    expect(cosineSimilarity([3, 4], [3, 4])).toBeCloseTo(1.0);
    expect(cosineSimilarity([1, 1], [100, 100])).toBeCloseTo(1.0);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
    expect(cosineSimilarity([3, 4], [-3, -4])).toBeCloseTo(-1.0);
  });

  it("returns 0 when either vector is the zero vector", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([1, 1], [0, 0])).toBe(0);
  });

  it("returns a value in [-1, 1] for arbitrary real vectors", () => {
    const score = cosineSimilarity([1, 2, 3], [4, 5, 6]);
    expect(score).toBeGreaterThanOrEqual(-1);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("throws when vector dimensions differ", () => {
    expect(() => cosineSimilarity([1, 2, 3], [1, 2])).toThrow(/dimension/i);
  });

  it("works with higher-dimensional vectors (typical embedding size)", () => {
    // 4-D sanity check: [1,0,0,0] ⊥ [0,1,0,0]
    expect(cosineSimilarity([1, 0, 0, 0], [0, 1, 0, 0])).toBeCloseTo(0.0);
    expect(cosineSimilarity([1, 0, 0, 0], [1, 0, 0, 0])).toBeCloseTo(1.0);
  });
});

// ── findNearest() ─────────────────────────────────────────────────────────────
//
// 2-D semantic space illustration (unit vectors):
//   "cat"    →  [1.000, 0.000]   angle   0°
//   "kitten" →  [0.985, 0.174]   angle  10°  (very close to cat)
//   "dog"    →  [0.906, 0.423]   angle  25°  (close, also animal)
//   "bus"    →  [0.174, 0.985]   angle  80°  (vehicle)
//   "car"    →  [0.000, 1.000]   angle  90°  (vehicle, ⊥ to cat)
//   "anti"   →  [-1.00, 0.000]   angle 180°  (opposite)
//
// Similarities to [1, 0]:
//   cat(1.0) > kitten(0.985) > dog(0.906) > bus(0.174) > car(0.0) > anti(-1.0)

const CANDIDATES = [
  { item: "cat", embedding: [1.0, 0.0] },
  { item: "kitten", embedding: [0.985, 0.174] },
  { item: "dog", embedding: [0.906, 0.423] },
  { item: "bus", embedding: [0.174, 0.985] },
  { item: "car", embedding: [0.0, 1.0] },
  { item: "anti", embedding: [-1.0, 0.0] },
];

describe("findNearest()", () => {
  it("returns sensible neighbors — animal query returns animals before vehicles", () => {
    const results = findNearest([1, 0], CANDIDATES, 3);
    const items = results.map((r) => r.item);
    // Top 3 must all be animals
    expect(items).toContain("cat");
    expect(items).toContain("kitten");
    expect(items).toContain("dog");
    // Vehicles must not appear in the top 3
    expect(items).not.toContain("car");
    expect(items).not.toContain("bus");
  });

  it("returns results in strictly descending similarity order", () => {
    const results = findNearest([1, 0], CANDIDATES);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
    }
  });

  it("ranks the most similar item first", () => {
    expect(findNearest([1, 0], CANDIDATES, 1)[0].item).toBe("cat");
    expect(findNearest([0, 1], CANDIDATES, 1)[0].item).toBe("car");
  });

  it("ranks the least similar item last", () => {
    // Request all 6 candidates so "anti" (score −1) is included.
    const results = findNearest([1, 0], CANDIDATES, CANDIDATES.length);
    expect(results.at(-1)?.item).toBe("anti");
    expect(results.at(-1)?.score).toBeCloseTo(-1.0);
  });

  it("respects the topN limit", () => {
    expect(findNearest([1, 0], CANDIDATES, 2)).toHaveLength(2);
    expect(findNearest([1, 0], CANDIDATES, 4)).toHaveLength(4);
  });

  it("returns all candidates when topN >= candidates.length", () => {
    expect(findNearest([1, 0], CANDIDATES, 100)).toHaveLength(CANDIDATES.length);
  });

  it("defaults topN to 5", () => {
    // CANDIDATES has 6 items; default topN=5 should return 5
    expect(findNearest([1, 0], CANDIDATES)).toHaveLength(5);
  });

  it("returns empty array for empty candidates", () => {
    expect(findNearest([1, 0], [])).toHaveLength(0);
  });

  it("each result has an item and a numeric score in [-1, 1]", () => {
    for (const result of findNearest([1, 0], CANDIDATES)) {
      expect(result).toHaveProperty("item");
      expect(typeof result.score).toBe("number");
      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);
    }
  });
});
