import { describe, expect, it } from "vitest";

import type { QuestState } from "@/lib/db";
import {
  DAILY_QUEST_DEFS,
  WEEKLY_QUEST_DEFS,
  applyCelebrationToQuests,
  localWeekStart,
  rolloverDailyQuests,
  rolloverWeeklyQuests,
} from "@/lib/gamification/quests";

const TODAY = "2025-06-01";
const YESTERDAY = "2025-05-31";
const THIS_WEEK_START = "2025-05-26";
const NEXT_WEEK_START = "2025-06-02";
const NOW = new Date("2025-06-01T12:00:00Z");
const TOMORROW = new Date("2025-06-02T12:00:00Z");

function entry(
  questId: string,
  progress: number,
  completedAt: Date | null = null,
  lastCountedDay: string | null = null,
) {
  return { questId, progress, completedAt, lastCountedDay };
}

function state(
  dailyPeriodStart: string | null,
  weeklyPeriodStart: string | null = null,
  entries: ReturnType<typeof entry>[] = [],
): QuestState {
  return { dailyPeriodStart, weeklyPeriodStart, entries };
}

function rollForToday(base: QuestState | undefined): QuestState {
  const daily = rolloverDailyQuests(base, TODAY);
  return rolloverWeeklyQuests(daily, TODAY);
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
// WEEKLY_QUEST_DEFS
// ---------------------------------------------------------------------------
describe("WEEKLY_QUEST_DEFS", () => {
  it("defines 1–2 weekly quests", () => {
    expect(WEEKLY_QUEST_DEFS.length).toBeGreaterThanOrEqual(1);
    expect(WEEKLY_QUEST_DEFS.length).toBeLessThanOrEqual(2);
  });

  it("all ids are unique and distinct from daily quests", () => {
    const weeklyIds = WEEKLY_QUEST_DEFS.map((d) => d.id);
    const dailyIds = DAILY_QUEST_DEFS.map((d) => d.id);
    expect(new Set(weeklyIds).size).toBe(weeklyIds.length);
    for (const id of weeklyIds) {
      expect(dailyIds).not.toContain(id);
    }
  });

  it("each weekly quest advertises a bonus XP reward", () => {
    for (const def of WEEKLY_QUEST_DEFS) {
      expect(def.xpReward).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// localWeekStart
// ---------------------------------------------------------------------------
describe("localWeekStart", () => {
  it("returns Monday for a mid-week date", () => {
    expect(localWeekStart("2025-05-28")).toBe("2025-05-26");
  });

  it("returns the same Monday for Sunday in the same ISO week", () => {
    expect(localWeekStart("2025-06-01")).toBe(THIS_WEEK_START);
  });

  it("advances to the next Monday on a new week", () => {
    expect(localWeekStart("2025-06-02")).toBe(NEXT_WEEK_START);
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
    const existing = state(TODAY, THIS_WEEK_START, [
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
    const existing = state(YESTERDAY, THIS_WEEK_START, [
      entry("daily-review-10", 10, NOW),
      entry("daily-finish-unit", 1, NOW),
      entry("daily-review-session", 1, NOW),
    ]);
    const rolled = rolloverDailyQuests(existing, TODAY);
    expect(rolled.dailyPeriodStart).toBe(TODAY);
    expect(
      rolled.entries
        .filter((e) => DAILY_QUEST_DEFS.some((d) => d.id === e.questId))
        .every((e) => e.progress === 0 && e.completedAt === null),
    ).toBe(true);
  });

  it("preserves weekly entries across daily rollover", () => {
    const existing: QuestState = {
      dailyPeriodStart: YESTERDAY,
      weeklyPeriodStart: THIS_WEEK_START,
      entries: [entry("daily-review-10", 10, NOW), entry("weekly-active-days", 3)],
    };
    const rolled = rolloverDailyQuests(existing, TODAY);
    expect(rolled.entries.find((e) => e.questId === "weekly-active-days")?.progress).toBe(3);
    expect(rolled.entries.find((e) => e.questId === "daily-review-10")?.progress).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// rolloverWeeklyQuests
// ---------------------------------------------------------------------------
describe("rolloverWeeklyQuests", () => {
  it("initializes weekly entries on first visit", () => {
    const daily = rolloverDailyQuests(undefined, TODAY);
    const rolled = rolloverWeeklyQuests(daily, TODAY);
    expect(rolled.weeklyPeriodStart).toBe(THIS_WEEK_START);
    expect(
      rolled.entries.filter((e) => WEEKLY_QUEST_DEFS.some((d) => d.id === e.questId)),
    ).toHaveLength(WEEKLY_QUEST_DEFS.length);
    expect(
      rolled.entries
        .filter((e) => WEEKLY_QUEST_DEFS.some((d) => d.id === e.questId))
        .every((e) => e.progress === 0 && e.completedAt === null),
    ).toBe(true);
  });

  it("does not reset weekly progress within the same week", () => {
    const existing = state(TODAY, THIS_WEEK_START, [
      ...DAILY_QUEST_DEFS.map((d) => entry(d.id, 0)),
      entry("weekly-active-days", 3, null, TODAY),
      entry("weekly-units-2", 1),
    ]);
    const rolled = rolloverWeeklyQuests(existing, TODAY);
    expect(rolled.entries.find((e) => e.questId === "weekly-active-days")?.progress).toBe(3);
    expect(rolled.entries.find((e) => e.questId === "weekly-units-2")?.progress).toBe(1);
  });

  it("resets weekly progress at the week boundary", () => {
    const existing = state("2025-06-01", THIS_WEEK_START, [
      ...DAILY_QUEST_DEFS.map((d) => entry(d.id, 0)),
      entry("weekly-active-days", 5, NOW, "2025-06-01"),
      entry("weekly-units-2", 2, NOW),
    ]);
    const rolled = rolloverWeeklyQuests(existing, NEXT_WEEK_START);
    expect(rolled.weeklyPeriodStart).toBe(NEXT_WEEK_START);
    expect(
      rolled.entries
        .filter((e) => WEEKLY_QUEST_DEFS.some((d) => d.id === e.questId))
        .every((e) => e.progress === 0 && e.completedAt === null),
    ).toBe(true);
  });

  it("preserves daily entries across weekly rollover", () => {
    const existing = state(TODAY, THIS_WEEK_START, [
      entry("daily-review-10", 7),
      entry("weekly-active-days", 2),
    ]);
    const rolled = rolloverWeeklyQuests(existing, NEXT_WEEK_START);
    expect(rolled.entries.find((e) => e.questId === "daily-review-10")?.progress).toBe(7);
    expect(rolled.entries.find((e) => e.questId === "weekly-active-days")?.progress).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyCelebrationToQuests
// ---------------------------------------------------------------------------
describe("applyCelebrationToQuests", () => {
  it("accumulates word-review progress from review-complete events", () => {
    const base = rollForToday(undefined);
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
    let current = rollForToday(undefined);
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
    const base = rollForToday(undefined);
    const updated = applyCelebrationToQuests(base, {
      kind: "unit-complete",
      unitId: 1,
      unitIndex: 0,
      at: NOW,
    });
    const finishUnit = updated.entries.find((e) => e.questId === "daily-finish-unit");
    const weeklyUnits = updated.entries.find((e) => e.questId === "weekly-units-2");
    expect(finishUnit?.progress).toBe(1);
    expect(finishUnit?.completedAt).toEqual(NOW);
    expect(weeklyUnits?.progress).toBe(1);
  });

  it("does not double-count completed quests", () => {
    let current = rollForToday(undefined);
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
    let current = rollForToday(undefined);
    current = applyCelebrationToQuests(current, {
      kind: "review-complete",
      cardCount: 15,
      xpEarned: 150,
      leveledUp: false,
      at: NOW,
    });
    expect(current.entries.find((e) => e.questId === "daily-review-10")?.progress).toBe(10);
  });

  it("accumulates active days from activity-complete events", () => {
    const base = rollForToday(undefined);
    const updated = applyCelebrationToQuests(base, {
      kind: "activity-complete",
      unitId: 1,
      activityIndex: 0,
      at: NOW,
    });
    expect(updated.entries.find((e) => e.questId === "weekly-active-days")?.progress).toBe(1);
  });

  it("does not double-count active days when activity-complete and unit-complete fire together", () => {
    let current = rollForToday(undefined);
    current = applyCelebrationToQuests(current, {
      kind: "activity-complete",
      unitId: 1,
      activityIndex: 1,
      at: NOW,
    });
    current = applyCelebrationToQuests(current, {
      kind: "unit-complete",
      unitId: 1,
      unitIndex: 0,
      at: NOW,
    });
    expect(current.entries.find((e) => e.questId === "weekly-active-days")?.progress).toBe(1);
    const finishUnit = current.entries.find((e) => e.questId === "daily-finish-unit");
    const weeklyUnits = current.entries.find((e) => e.questId === "weekly-units-2");
    expect(finishUnit?.progress).toBe(1);
    expect(weeklyUnits?.progress).toBe(1);
  });

  it("does not count unit-finish quests from activity-complete alone", () => {
    const base = rollForToday(undefined);
    const updated = applyCelebrationToQuests(base, {
      kind: "activity-complete",
      unitId: 1,
      activityIndex: 0,
      at: NOW,
    });
    expect(updated.entries.find((e) => e.questId === "daily-finish-unit")?.progress).toBe(0);
    expect(updated.entries.find((e) => e.questId === "weekly-units-2")?.progress).toBe(0);
  });

  it("counts at most one active day per calendar day for weekly consistency quests", () => {
    let current = rollForToday(undefined);
    current = applyCelebrationToQuests(current, {
      kind: "review-complete",
      cardCount: 3,
      xpEarned: 30,
      leveledUp: false,
      at: NOW,
    });
    current = applyCelebrationToQuests(current, {
      kind: "unit-complete",
      unitId: 1,
      unitIndex: 0,
      at: NOW,
    });
    expect(current.entries.find((e) => e.questId === "weekly-active-days")?.progress).toBe(1);
  });

  it("accumulates active days across different calendar days in the same week", () => {
    let current = rollForToday(undefined);
    current = applyCelebrationToQuests(current, {
      kind: "review-complete",
      cardCount: 2,
      xpEarned: 20,
      leveledUp: false,
      at: NOW,
    });
    current = applyCelebrationToQuests(current, {
      kind: "review-complete",
      cardCount: 2,
      xpEarned: 20,
      leveledUp: false,
      at: TOMORROW,
    });
    expect(current.entries.find((e) => e.questId === "weekly-active-days")?.progress).toBe(2);
  });
});
