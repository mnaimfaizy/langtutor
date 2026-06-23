import { describe, expect, it } from "vitest";

import { getDueCards, initCard, isDue, scheduleCard } from "@/lib/srs/fsrs-wrapper";

// Fixed reference times (deterministic; fuzz is disabled in the wrapper).
const T0 = new Date("2025-01-01T12:00:00Z");
const T_1MIN = new Date("2025-01-01T12:01:00Z"); // Again from New
const T_6MIN = new Date("2025-01-01T12:06:00Z"); // Hard from New
const T_10MIN = new Date("2025-01-01T12:10:00Z"); // Good from New
const T_8DAYS = new Date("2025-01-09T12:00:00Z"); // Easy from New (8 scheduled days)
const T_9DAYS = new Date("2025-01-10T12:00:00Z"); // one day after T_8DAYS

/** Returns a Review-state card by applying Easy at T0. */
function buildReviewCard() {
  return scheduleCard(initCard(T0), "easy", T0);
}

// ─── initCard ─────────────────────────────────────────────────────────────────

describe("initCard", () => {
  it("creates a New-state card due immediately", () => {
    const state = initCard(T0);
    expect(state.state).toBe(0); // New
    expect(state.due).toEqual(T0);
    expect(state.reps).toBe(0);
    expect(state.lapses).toBe(0);
  });
});

// ─── isDue ────────────────────────────────────────────────────────────────────

describe("isDue", () => {
  it("returns true for a new card at its creation time", () => {
    expect(isDue(initCard(T0), T0)).toBe(true);
  });

  it("returns false for a card due in the future", () => {
    const state = scheduleCard(initCard(T0), "easy", T0); // due = T_8DAYS
    expect(isDue(state, T0)).toBe(false);
  });

  it("returns true for a card whose due date has passed", () => {
    const state = scheduleCard(initCard(T0), "easy", T0); // due = T_8DAYS
    expect(isDue(state, T_9DAYS)).toBe(true);
  });
});

// ─── scheduleCard — ratings from New state ────────────────────────────────────

describe("scheduleCard — New state", () => {
  it("Again → Learning (state=1), due in 1 minute", () => {
    const next = scheduleCard(initCard(T0), "again", T0);
    expect(next.state).toBe(1);
    expect(next.reps).toBe(1);
    expect(next.due).toEqual(T_1MIN);
  });

  it("Hard → Learning (state=1), due in 6 minutes", () => {
    const next = scheduleCard(initCard(T0), "hard", T0);
    expect(next.state).toBe(1);
    expect(next.due).toEqual(T_6MIN);
  });

  it("Good → Learning (state=1), due in 10 minutes", () => {
    const next = scheduleCard(initCard(T0), "good", T0);
    expect(next.state).toBe(1);
    expect(next.due).toEqual(T_10MIN);
  });

  it("Easy → Review (state=2), scheduled 8 days out", () => {
    const next = scheduleCard(initCard(T0), "easy", T0);
    expect(next.state).toBe(2);
    expect(next.scheduledDays).toBe(8);
    expect(next.due).toEqual(T_8DAYS);
  });

  it("intervals are strictly ordered: again < hard < good << easy", () => {
    const base = initCard(T0);
    const again = scheduleCard(base, "again", T0);
    const hard = scheduleCard(base, "hard", T0);
    const good = scheduleCard(base, "good", T0);
    const easy = scheduleCard(base, "easy", T0);
    expect(again.due < hard.due).toBe(true);
    expect(hard.due < good.due).toBe(true);
    expect(good.due < easy.due).toBe(true);
  });
});

// ─── scheduleCard — ratings from Review state ─────────────────────────────────

describe("scheduleCard — Review state", () => {
  it("Good from Review keeps state=Review and advances the interval", () => {
    const review = buildReviewCard(); // scheduledDays=8
    const next = scheduleCard(review, "good", T_8DAYS);
    expect(next.state).toBe(2); // Review
    expect(next.scheduledDays).toBeGreaterThan(review.scheduledDays);
    expect(next.scheduledDays).toBe(39); // known deterministic value
  });

  it("Again from Review → Relearning (state=3), due the same day", () => {
    const review = buildReviewCard();
    const next = scheduleCard(review, "again", T_8DAYS);
    expect(next.state).toBe(3); // Relearning
    expect(next.scheduledDays).toBe(0);
    expect(next.due > T_8DAYS).toBe(true);
    expect(next.due < T_9DAYS).toBe(true); // within the same day (10 min later)
  });

  it("lapses increment on Again from Review", () => {
    const review = buildReviewCard();
    expect(review.lapses).toBe(0);
    const next = scheduleCard(review, "again", T_8DAYS);
    expect(next.lapses).toBe(1);
  });

  it("lapses do NOT increment on Good from Review", () => {
    const review = buildReviewCard();
    const next = scheduleCard(review, "good", T_8DAYS);
    expect(next.lapses).toBe(0);
  });
});

// ─── getDueCards ──────────────────────────────────────────────────────────────

describe("getDueCards", () => {
  it("returns only cards whose due date is at or before now", () => {
    const dueNow = { id: 1, fsrs: initCard(T0) }; // due = T0
    const dueInFuture = { id: 2, fsrs: scheduleCard(initCard(T0), "easy", T0) }; // due = T_8DAYS
    const result = getDueCards([dueNow, dueInFuture], T0);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("returns empty array when no cards are due", () => {
    const notDue = { id: 1, fsrs: scheduleCard(initCard(T0), "easy", T0) }; // due = T_8DAYS
    expect(getDueCards([notDue], T0)).toHaveLength(0);
  });

  it("returns all cards when all are due", () => {
    const cards = [
      { id: 1, fsrs: initCard(T0) },
      { id: 2, fsrs: initCard(T0) },
    ];
    expect(getDueCards(cards, T0)).toHaveLength(2);
  });

  it("returns empty array for an empty input", () => {
    expect(getDueCards([], T0)).toHaveLength(0);
  });

  it("returns overdue cards (due date in the past)", () => {
    const overdue = { id: 1, fsrs: initCard(T0) }; // due = T0, checking at T_8DAYS
    expect(getDueCards([overdue], T_8DAYS)).toHaveLength(1);
  });
});
