import { describe, expect, it } from "vitest";

import {
  buildScopedReviewQueue,
  hasDeckBrowserScopeActive,
  parseScopedReviewCardIds,
  scopedReviewHref,
} from "@/lib/deck/scoped-review-queue";
import { initCard } from "@/lib/srs";

const NOW = new Date("2026-07-09T12:00:00.000Z");
const DUE = new Date("2026-07-09T11:00:00.000Z");
const LATER = new Date("2026-07-10T12:00:00.000Z");

function card(id: number, due: Date, suspended = false) {
  return {
    id,
    fsrs: { ...initCard(due), due },
    suspended,
  };
}

const CARDS = [card(1, DUE), card(2, DUE, true), card(3, LATER), card(4, DUE), card(5, DUE)];

describe("buildScopedReviewQueue", () => {
  it("returns only scoped cards that are due now", () => {
    expect(buildScopedReviewQueue(CARDS, new Set([1, 2, 3, 4]), NOW)).toEqual([CARDS[0], CARDS[3]]);
  });

  it("excludes suspended cards even when scoped", () => {
    expect(buildScopedReviewQueue(CARDS, new Set([2]), NOW)).toEqual([]);
  });

  it("returns an empty queue when no scoped cards are due", () => {
    expect(buildScopedReviewQueue(CARDS, new Set([3]), NOW)).toEqual([]);
  });

  it("returns an empty queue when the scoped id set is empty", () => {
    expect(buildScopedReviewQueue(CARDS, new Set(), NOW)).toEqual([]);
  });
});

describe("hasDeckBrowserScopeActive", () => {
  const emptyFilters = { cefr: null, mastery: null, due: null };

  it("is false with no filters, collection, or search", () => {
    expect(hasDeckBrowserScopeActive(emptyFilters, null, "")).toBe(false);
    expect(hasDeckBrowserScopeActive(emptyFilters, null, "   ")).toBe(false);
  });

  it("is true when a facet filter is active", () => {
    expect(hasDeckBrowserScopeActive({ ...emptyFilters, cefr: "A1" }, null, "")).toBe(true);
    expect(hasDeckBrowserScopeActive({ ...emptyFilters, mastery: "new" }, null, "")).toBe(true);
    expect(hasDeckBrowserScopeActive({ ...emptyFilters, due: "due" }, null, "")).toBe(true);
  });

  it("is true when a collection filter is active", () => {
    expect(hasDeckBrowserScopeActive(emptyFilters, 7, "")).toBe(true);
  });

  it("is true when search narrows the visible set", () => {
    expect(hasDeckBrowserScopeActive(emptyFilters, null, "park")).toBe(true);
  });
});

describe("parseScopedReviewCardIds", () => {
  it("parses comma-separated positive integer ids", () => {
    expect(parseScopedReviewCardIds("1, 4,10")).toEqual(new Set([1, 4, 10]));
  });

  it("returns null for empty or invalid params", () => {
    expect(parseScopedReviewCardIds(null)).toBeNull();
    expect(parseScopedReviewCardIds("")).toBeNull();
    expect(parseScopedReviewCardIds("   ")).toBeNull();
    expect(parseScopedReviewCardIds("abc,0,-1")).toBeNull();
  });
});

describe("scopedReviewHref", () => {
  it("builds a review URL with scoped card ids", () => {
    expect(scopedReviewHref([3, 1, 2])).toBe("/review?cards=3,1,2");
  });

  it("falls back to the full review route when no ids are provided", () => {
    expect(scopedReviewHref([])).toBe("/review");
  });
});
