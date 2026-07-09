import { describe, expect, it } from "vitest";

import {
  ACTIVITY_HEATMAP_WEEKS,
  activityHeatmapTier,
  computeReviewActivityHeatmap,
  formatActivityDayLabel,
} from "@/lib/deck/review-activity-heatmap";

/** Local noon — avoids timezone edge cases around midnight. */
const NOW = new Date(2025, 5, 11, 12, 0, 0); // Wed Jun 11 2025

function localIso(year: number, month: number, day: number, hour = 9): string {
  return new Date(year, month, day, hour, 0, 0).toISOString();
}

function card(lastReviewIso?: string) {
  return { lastReviewIso };
}

describe("computeReviewActivityHeatmap", () => {
  it("returns a full week grid for the default window", () => {
    const days = computeReviewActivityHeatmap([], { now: NOW });
    expect(days).toHaveLength(ACTIVITY_HEATMAP_WEEKS * 7);
  });

  it("marks future days in the current week", () => {
    const days = computeReviewActivityHeatmap([], { weeks: 1, now: NOW });
    const future = days.filter((d) => d.isFuture);
    expect(future.length).toBeGreaterThan(0);
    expect(future.every((d) => d.count === 0)).toBe(true);
  });

  it("counts a review on today", () => {
    const todayIso = localIso(2025, 5, 11, 18);
    const days = computeReviewActivityHeatmap([card(todayIso)], { weeks: 1, now: NOW });
    const today = days.find((d) => !d.isFuture && d.date.getDate() === 11);
    expect(today?.count).toBe(1);
  });

  it("buckets multiple cards reviewed on the same local day", () => {
    const dayIso = localIso(2025, 5, 10);
    const days = computeReviewActivityHeatmap(
      [card(dayIso), card(dayIso), card(localIso(2025, 5, 9))],
      { weeks: 1, now: NOW },
    );
    const target = days.find((d) => d.date.getDate() === 10 && !d.isFuture);
    expect(target?.count).toBe(2);
  });

  it("excludes reviews before the grid window", () => {
    const old = localIso(2025, 2, 1);
    const days = computeReviewActivityHeatmap([card(old)], { weeks: 2, now: NOW });
    expect(days.reduce((sum, d) => sum + d.count, 0)).toBe(0);
  });

  it("excludes cards with no last review", () => {
    const days = computeReviewActivityHeatmap([card(), card()], { weeks: 1, now: NOW });
    expect(days.every((d) => d.count === 0)).toBe(true);
  });

  it("assigns weekIndex 0 to the oldest column", () => {
    const days = computeReviewActivityHeatmap([], { weeks: 2, now: NOW });
    const minWeek = Math.min(...days.map((d) => d.weekIndex));
    const maxWeek = Math.max(...days.map((d) => d.weekIndex));
    expect(minWeek).toBe(0);
    expect(maxWeek).toBe(1);
  });
});

describe("activityHeatmapTier", () => {
  it("returns 0 for zero count", () => {
    expect(activityHeatmapTier(0, 10)).toBe(0);
  });

  it("returns 4 when count equals max", () => {
    expect(activityHeatmapTier(8, 8)).toBe(4);
  });
});

describe("formatActivityDayLabel", () => {
  it("describes zero reviews", () => {
    const label = formatActivityDayLabel(NOW, 0, false);
    expect(label).toContain("no reviews");
  });

  it("pluralizes review count", () => {
    expect(formatActivityDayLabel(NOW, 1, false)).toContain("1 review");
    expect(formatActivityDayLabel(NOW, 3, false)).toContain("3 reviews");
  });

  it("returns empty for future days", () => {
    expect(formatActivityDayLabel(NOW, 0, true)).toBe("");
  });
});
