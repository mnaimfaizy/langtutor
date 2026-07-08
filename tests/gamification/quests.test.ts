import { describe, expect, it } from "vitest";

import type { QuestState } from "@/lib/db";
import {
  DAILY_QUEST_DEFS,
  applyCelebrationToQuests,
  rolloverDailyQuests,
} from "@/lib/gamification/quests";

const TODAY = "2025-06-01";
const YESTERDAY = "2025-05-31";
const NOW = new Date("2025-06-01T12:00:00Z");

function entry(questId: string, progress: number, completedAt: Date | null = null) {
  return { questId, progress, completedAt };
}

function state(
  dailyPeriodStart: string | null,
  entries: ReturnType<typeof entry>[] = [],
): QuestState {
  return { dailyPeriodStart, weeklyPeriodStart: null, entries };
}

// ---------------------------------------------------------------------------
// DAILY_QUEST_DEFS
// ---------------------------------------------------------------------------
describe("DAILY_QUEST_DEFS", () => {
  it("defines 2–3 daily quests", () => {
    expect(DAILY_QUEST_DEFS.length).toBeGreaterThanOrEqual(2);
    expect(DAILY_QUEST_DEFS.length).toBeLessThanOrEqual(3);
  });

  it("all ids are unique", () => {
    const ids = DAILY_QUEST_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// rolloverDailyQuests
// ---------------------------------------------------------------------------
describe("rolloverDailyQuests", () => {
  it("initializes daily entries on first visit", () => {
    const rolled = rolloverDailyQuests(undefined, TODAY);
    expect(rolled.dailyPeriodStart).toBe(TODAY);
    expect(rolled.entries).toHaveLength(DAILY_QUEST_DEFS.length);
    expect(rolled.entries.every((e) => e.progress === 0 && e.completedAt === null)).toBe(true);
  });

  it("does not reset progress on the same day", () => {
    const existing = state(TODAY, [
      entry("daily-review-10", 6),
      entry("daily-finish-unit", 0),
      entry("daily-review-session", 1, NOW),
    ]);
    const rolled = rolloverDailyQuests(existing, TODAY);
    expect(rolled.entries.find((e) => e.questId === "daily-review-10")?.progress).toBe(6);
    expect(rolled.entries.find((e) => e.questId === "daily-review-session")?.completedAt).toEqual(
      NOW,
    );
  });

  it("resets daily progress at the day boundary", () => {
    const existing = state(YESTERDAY, [
      entry("daily-review-10", 10, NOW),
      entry("daily-finish-unit", 1, NOW),
      entry("daily-review-session", 1, NOW),
    ]);
    const rolled = rolloverDailyQuests(existing, TODAY);
    expect(rolled.dailyPeriodStart).toBe(TODAY);
    expect(rolled.entries.every((e) => e.progress === 0 && e.completedAt === null)).toBe(true);
  });

  it("preserves non-daily entries across rollover", () => {
    const existing: QuestState = {
      dailyPeriodStart: YESTERDAY,
      weeklyPeriodStart: "2025-05-26",
      entries: [entry("daily-review-10", 10, NOW), entry("weekly-streak", 3)],
    };
    const rolled = rolloverDailyQuests(existing, TODAY);
    expect(rolled.entries.find((e) => e.questId === "weekly-streak")?.progress).toBe(3);
    expect(rolled.entries.find((e) => e.questId === "daily-review-10")?.progress).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyCelebrationToQuests
// ---------------------------------------------------------------------------
describe("applyCelebrationToQuests", () => {
  it("accumulates word-review progress from review-complete events", () => {
    const base = rolloverDailyQuests(undefined, TODAY);
    const updated = applyCelebrationToQuests(base, {
      kind: "review-complete",
      cardCount: 4,
      xpEarned: 40,
      leveledUp: false,
      at: NOW,
    });
    expect(updated.entries.find((e) => e.questId === "daily-review-10")?.progress).toBe(4);
  });

  it("marks review quests complete when targets are met", () => {
    let current = rolloverDailyQuests(undefined, TODAY);
    current = applyCelebrationToQuests(current, {
      kind: "review-complete",
      cardCount: 10,
      xpEarned: 100,
      leveledUp: true,
      at: NOW,
    });
    const review10 = current.entries.find((e) => e.questId === "daily-review-10");
    const reviewSession = current.entries.find((e) => e.questId === "daily-review-session");
    expect(review10?.progress).toBe(10);
    expect(review10?.completedAt).toEqual(NOW);
    expect(reviewSession?.completedAt).toEqual(NOW);
  });

  it("accumulates unit-finish progress from unit-complete events", () => {
    const base = rolloverDailyQuests(undefined, TODAY);
    const updated = applyCelebrationToQuests(base, {
      kind: "unit-complete",
      unitId: 1,
      unitIndex: 0,
      at: NOW,
    });
    const finishUnit = updated.entries.find((e) => e.questId === "daily-finish-unit");
    expect(finishUnit?.progress).toBe(1);
    expect(finishUnit?.completedAt).toEqual(NOW);
  });

  it("does not double-count completed quests", () => {
    let current = rolloverDailyQuests(undefined, TODAY);
    current = applyCelebrationToQuests(current, {
      kind: "review-complete",
      cardCount: 10,
      xpEarned: 100,
      leveledUp: false,
      at: NOW,
    });
    const afterRepeat = applyCelebrationToQuests(current, {
      kind: "review-complete",
      cardCount: 5,
      xpEarned: 50,
      leveledUp: false,
      at: NOW,
    });
    expect(afterRepeat.entries.find((e) => e.questId === "daily-review-10")?.progress).toBe(10);
  });

  it("caps progress at the quest target", () => {
    let current = rolloverDailyQuests(undefined, TODAY);
    current = applyCelebrationToQuests(current, {
      kind: "review-complete",
      cardCount: 15,
      xpEarned: 150,
      leveledUp: false,
      at: NOW,
    });
    expect(current.entries.find((e) => e.questId === "daily-review-10")?.progress).toBe(10);
  });
});
