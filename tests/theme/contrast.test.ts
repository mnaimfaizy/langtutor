import { describe, expect, it } from "vitest";

import { contrastRatio, meetsWcagAa, parseRgbString } from "@/lib/theme/contrast";

const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 255, g: 255, b: 255 };

describe("contrastRatio", () => {
  it("returns 21:1 for black vs white", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 1);
  });

  it("returns 1:1 for identical colors", () => {
    const gray = { r: 128, g: 128, b: 128 };
    expect(contrastRatio(gray, gray)).toBeCloseTo(1, 5);
  });

  it("is order-independent", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(contrastRatio(WHITE, BLACK), 5);
  });
});

describe("meetsWcagAa", () => {
  it("passes normal text at 4.5:1", () => {
    expect(meetsWcagAa(BLACK, WHITE)).toBe(true);
  });

  it("fails normal text below 4.5:1", () => {
    // rgb(130,130,130) on white is ~3.84:1 — passes large text but fails the 4.5:1 normal bar.
    expect(meetsWcagAa({ r: 130, g: 130, b: 130 }, WHITE)).toBe(false);
  });

  it("accepts a lower 3:1 threshold for large text", () => {
    const midGray = { r: 130, g: 130, b: 130 };
    expect(meetsWcagAa(midGray, WHITE, true)).toBe(true);
  });
});

describe("parseRgbString", () => {
  it("parses rgb()", () => {
    expect(parseRgbString("rgb(11, 11, 20)")).toEqual({ r: 11, g: 11, b: 20 });
  });

  it("parses rgba() and ignores alpha", () => {
    expect(parseRgbString("rgba(242, 241, 250, 0.55)")).toEqual({ r: 242, g: 241, b: 250 });
  });

  it("throws on an unparseable value", () => {
    expect(() => parseRgbString("not-a-color")).toThrow();
  });
});
