import { describe, expect, it } from "vitest";

import type { GamificationState } from "@/lib/db";
import {
  ACHIEVEMENT_DEFS,
  XP_PER_CARD,
  applyReview,
  earnXp,
  localDateString,
  updateStreak,
  xpLevelRingBounds,
  xpToLevel,
} from "@/lib/gamification";

const BLANK: GamificationState = {
  xp: 0,
  level: 1,
  streakCount: 0,
  lastActivityDate: null,
  achievements: [],
};

const NOW = new Date("2025-06-01T12:00:00Z");
const TODAY = "2025-06-01";
const YESTERDAY = "2025-05-31";

// ---------------------------------------------------------------------------
// xpToLevel
// ---------------------------------------------------------------------------
describe("xpToLevel", () => {
  it("level 1 at 0 XP", () => expect(xpToLevel(0)).toBe(1));
  it("level 1 at 99 XP", () => expect(xpToLevel(99)).toBe(1));
  it("level 2 at 100 XP", () => expect(xpToLevel(100)).toBe(2));
  it("level 3 at 300 XP", () => expect(xpToLevel(300)).toBe(3));
  it("monotonically non-decreasing", () =>
    expect(xpToLevel(300)).toBeGreaterThanOrEqual(xpToLevel(299)));
});

// ---------------------------------------------------------------------------
// xpLevelRingBounds
// ---------------------------------------------------------------------------
describe("xpLevelRingBounds", () => {
  it("level 1 spans 0–100 XP", () => expect(xpLevelRingBounds(50)).toEqual({ min: 0, max: 100 }));
  it("level 3 spans 300–600 XP", () =>
    expect(xpLevelRingBounds(450)).toEqual({ min: 300, max: 600 }));
  it("max level shows a full ring", () =>
    expect(xpLevelRingBounds(12_000)).toEqual({ min: 10_000, max: 10_001 }));
});

// ---------------------------------------------------------------------------
// earnXp
// ---------------------------------------------------------------------------
describe("earnXp", () => {
  it("0 cards = 0 XP", () => expect(earnXp(0)).toBe(0));
  it("5 cards = 5 × XP_PER_CARD", () => expect(earnXp(5)).toBe(5 * XP_PER_CARD));
});

// ---------------------------------------------------------------------------
// updateStreak
// ---------------------------------------------------------------------------
describe("updateStreak", () => {
  it("first activity starts streak at 1", () => {
    const r = updateStreak(null, TODAY, 0);
    expect(r.streakCount).toBe(1);
    expect(r.lastActivityDate).toBe(TODAY);
  });

  it("same-day repeat does not increment", () => {
    const r = updateStreak(TODAY, TODAY, 3);
    expect(r.streakCount).toBe(3);
    expect(r.lastActivityDate).toBe(TODAY);
  });

  it("consecutive day increments streak", () => {
    const r = updateStreak(YESTERDAY, TODAY, 2);
    expect(r.streakCount).toBe(3);
  });

  it("two-day gap resets streak to 1", () => {
    const r = updateStreak("2025-05-29", TODAY, 5);
    expect(r.streakCount).toBe(1);
  });

  it("updates lastActivityDate", () => {
    const r = updateStreak(YESTERDAY, TODAY, 1);
    expect(r.lastActivityDate).toBe(TODAY);
  });
});

// ---------------------------------------------------------------------------
// applyReview
// ---------------------------------------------------------------------------
describe("applyReview", () => {
  it("grants XP proportional to cards reviewed", () => {
    const { xpEarned, newState } = applyReview(undefined, { cardCount: 3, today: TODAY, now: NOW });
    expect(xpEarned).toBe(3 * XP_PER_CARD);
    expect(newState.xp).toBe(3 * XP_PER_CARD);
  });

  it("starts streak on first review", () => {
    const { newState } = applyReview(undefined, { cardCount: 1, today: TODAY, now: NOW });
    expect(newState.streakCount).toBe(1);
  });

  it("same-day repeat does not increment streak", () => {
    const state = { ...BLANK, streakCount: 2, lastActivityDate: TODAY };
    const { newState } = applyReview(state, { cardCount: 1, today: TODAY, now: NOW });
    expect(newState.streakCount).toBe(2);
  });

  it("consecutive day increments streak", () => {
    const state = { ...BLANK, streakCount: 1, lastActivityDate: YESTERDAY };
    const { newState } = applyReview(state, { cardCount: 1, today: TODAY, now: NOW });
    expect(newState.streakCount).toBe(2);
  });

  it("unlocks first_review achievement on first review", () => {
    const { newAchievements } = applyReview(undefined, { cardCount: 1, today: TODAY, now: NOW });
    expect(newAchievements.some((a) => a.id === "first_review")).toBe(true);
  });

  it("unlocks xp_50 when 50 XP threshold is crossed", () => {
    // 5 cards × 10 XP = 50 XP from 0
    const { newAchievements } = applyReview(undefined, { cardCount: 5, today: TODAY, now: NOW });
    expect(newAchievements.some((a) => a.id === "xp_50")).toBe(true);
  });

  it("does not re-unlock already unlocked achievements", () => {
    const state: GamificationState = {
      ...BLANK,
      xp: 50,
      achievements: [{ id: "xp_50", unlockedAt: NOW }],
    };
    const { newAchievements } = applyReview(state, { cardCount: 1, today: TODAY, now: NOW });
    expect(newAchievements.some((a) => a.id === "xp_50")).toBe(false);
  });

  it("levels up when XP threshold is crossed", () => {
    // 10 cards × 10 XP = 100 XP → level 2
    const { leveledUp, newState } = applyReview(undefined, {
      cardCount: 10,
      today: TODAY,
      now: NOW,
    });
    expect(leveledUp).toBe(true);
    expect(newState.level).toBe(2);
  });

  it("no level-up when staying in same level", () => {
    // 1 card = 10 XP, still level 1
    const { leveledUp } = applyReview(undefined, { cardCount: 1, today: TODAY, now: NOW });
    expect(leveledUp).toBe(false);
  });

  it("sets achievement unlockedAt to the injected now", () => {
    const { newAchievements } = applyReview(undefined, { cardCount: 1, today: TODAY, now: NOW });
    expect(newAchievements[0]?.unlockedAt).toEqual(NOW);
  });
});

// ---------------------------------------------------------------------------
// ACHIEVEMENT_DEFS catalogue
// ---------------------------------------------------------------------------
describe("ACHIEVEMENT_DEFS", () => {
  it("has at least 5 achievements", () =>
    expect(ACHIEVEMENT_DEFS.length).toBeGreaterThanOrEqual(5));

  it("all ids are unique", () => {
    const ids = ACHIEVEMENT_DEFS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all have non-empty labels", () => {
    ACHIEVEMENT_DEFS.forEach((a) => expect(a.label.length).toBeGreaterThan(0));
  });

  it("all have non-empty icons", () => {
    ACHIEVEMENT_DEFS.forEach((a) => expect(a.icon.length).toBeGreaterThan(0));
  });
});

// ---------------------------------------------------------------------------
// localDateString — timezone-safe local date formatting
// ---------------------------------------------------------------------------
describe("localDateString", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    // Use multi-arg constructor so the Date is interpreted in local time.
    const d = new Date(2025, 5, 1); // June 1, 2025 local
    expect(localDateString(d)).toBe("2025-06-01");
  });

  it("pads single-digit month and day with zeros", () => {
    const d = new Date(2025, 0, 9); // Jan 9, 2025 local
    expect(localDateString(d)).toBe("2025-01-09");
  });

  it("handles year boundary (Dec 31)", () => {
    const d = new Date(2024, 11, 31); // Dec 31, 2024 local
    expect(localDateString(d)).toBe("2024-12-31");
  });

  it("handles Jan 1", () => {
    const d = new Date(2025, 0, 1); // Jan 1, 2025 local
    expect(localDateString(d)).toBe("2025-01-01");
  });
});

// ---------------------------------------------------------------------------
// updateStreak — date-edge cases (month/year/leap-year boundaries)
// ---------------------------------------------------------------------------
describe("updateStreak — date-edge cases", () => {
  it("year boundary: Dec 31 → Jan 1 counts as consecutive day", () => {
    const r = updateStreak("2024-12-31", "2025-01-01", 5);
    expect(r.streakCount).toBe(6);
  });

  it("month boundary: Feb 28 → Mar 1 in a non-leap year counts as consecutive", () => {
    const r = updateStreak("2025-02-28", "2025-03-01", 3);
    expect(r.streakCount).toBe(4);
  });

  it("leap year: Feb 29 → Mar 1 counts as consecutive", () => {
    const r = updateStreak("2024-02-29", "2024-03-01", 2);
    expect(r.streakCount).toBe(3);
  });

  it("gap of exactly 2 days resets streak to 1", () => {
    const r = updateStreak("2025-01-01", "2025-01-03", 10);
    expect(r.streakCount).toBe(1);
  });

  it("gap spanning a month boundary resets streak", () => {
    const r = updateStreak("2025-01-31", "2025-02-02", 4);
    expect(r.streakCount).toBe(1);
  });

  it("gap spanning a year boundary resets streak", () => {
    const r = updateStreak("2024-12-30", "2025-01-01", 7);
    expect(r.streakCount).toBe(1);
  });
});
