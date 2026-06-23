import { describe, expect, it } from "vitest";

import { computeWer } from "@/lib/diagnostics/wer";

describe("computeWer", () => {
  it("returns wer=0 for identical strings", () => {
    const r = computeWer("the cat sat on the mat", "the cat sat on the mat");
    expect(r.wer).toBe(0);
    expect(r.substitutions).toBe(0);
    expect(r.deletions).toBe(0);
    expect(r.insertions).toBe(0);
  });

  it("counts one substitution", () => {
    const r = computeWer("the cat sat on the mat", "the cat sat in the mat");
    expect(r.wer).toBeCloseTo(1 / 6);
    expect(r.substitutions).toBe(1);
    expect(r.deletions).toBe(0);
    expect(r.insertions).toBe(0);
  });

  it("counts one deletion", () => {
    const r = computeWer("the cat sat on the mat", "the cat sat the mat");
    expect(r.wer).toBeCloseTo(1 / 6);
    expect(r.deletions).toBe(1);
    expect(r.substitutions).toBe(0);
    expect(r.insertions).toBe(0);
  });

  it("counts one insertion", () => {
    const r = computeWer("the cat sat on the mat", "the cat sat on the big mat");
    expect(r.wer).toBeCloseTo(1 / 6);
    expect(r.insertions).toBe(1);
    expect(r.substitutions).toBe(0);
    expect(r.deletions).toBe(0);
  });

  it("is case-insensitive", () => {
    const r = computeWer("The Cat Sat", "the cat sat");
    expect(r.wer).toBe(0);
  });

  it("strips punctuation before comparing", () => {
    const r = computeWer("Hello, world!", "Hello world");
    expect(r.wer).toBe(0);
  });

  it("handles an empty hypothesis (all deletions)", () => {
    const r = computeWer("one two three", "");
    expect(r.wer).toBe(1);
    expect(r.deletions).toBe(3);
    expect(r.insertions).toBe(0);
  });

  it("handles an empty reference with non-empty hypothesis (Infinity)", () => {
    const r = computeWer("", "extra word");
    expect(r.wer).toBe(Infinity);
    expect(r.insertions).toBe(2);
  });

  it("returns wer=0 and empty alignment for two empty strings", () => {
    const r = computeWer("", "");
    expect(r.wer).toBe(0);
    expect(r.alignment).toHaveLength(0);
  });

  it("builds correct alignment for a mixed-error sequence", () => {
    // ref: "one two three"
    // hyp: "one TWO four"  →  one=correct, two=correct (case), three→four=substitution
    const r = computeWer("one two three", "one TWO four");
    expect(r.substitutions).toBe(1);
    expect(r.deletions).toBe(0);
    expect(r.insertions).toBe(0);
    const types = r.alignment.map((a) => a.type);
    expect(types).toEqual(["correct", "correct", "substitution"]);
  });

  it("alignment has ref=null for insertions and hyp=null for deletions", () => {
    const r = computeWer("one three", "one two three");
    const ins = r.alignment.find((a) => a.type === "insertion");
    expect(ins?.ref).toBeNull();
    expect(ins?.hyp).toBe("two");

    const r2 = computeWer("one two three", "one three");
    const del = r2.alignment.find((a) => a.type === "deletion");
    expect(del?.hyp).toBeNull();
    expect(del?.ref).toBe("two");
  });
});
