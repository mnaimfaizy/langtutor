import { describe, expect, it } from "vitest";

import {
  formatNextDue,
  masteryLabelDisplay,
  masteryLabelFromFsrs,
  masteryLabelFromState,
} from "@/lib/srs/mastery-label";

const NOW = new Date("2025-06-01T12:00:00Z");

describe("masteryLabelFromState", () => {
  it.each([
    [0, "new"],
    [1, "learning"],
    [2, "review"],
    [3, "relearning"],
  ] as const)("maps state %i to %s", (state, expected) => {
    expect(masteryLabelFromState(state)).toBe(expected);
  });

  it("falls back to new for unknown state values", () => {
    expect(masteryLabelFromState(99)).toBe("new");
  });
});

describe("masteryLabelFromFsrs", () => {
  it("reads state from an FsrsState snapshot", () => {
    expect(masteryLabelFromFsrs({ state: 2 })).toBe("review");
  });
});

describe("masteryLabelDisplay", () => {
  it.each([
    ["new", "New"],
    ["learning", "Learning"],
    ["review", "Review"],
    ["relearning", "Relearning"],
  ] as const)("capitalizes %s as %s", (label, expected) => {
    expect(masteryLabelDisplay(label)).toBe(expected);
  });
});

describe("formatNextDue", () => {
  it("returns Due now when the due date is in the past", () => {
    expect(formatNextDue(new Date("2025-06-01T11:00:00Z"), NOW)).toBe("Due now");
  });

  it("returns Due now when the due date equals now", () => {
    expect(formatNextDue(NOW, NOW)).toBe("Due now");
  });

  it("returns Due tomorrow for the next calendar day", () => {
    expect(formatNextDue(new Date("2025-06-02T09:00:00Z"), NOW)).toBe("Due tomorrow");
  });

  it("returns Due in N days for dates within the week", () => {
    expect(formatNextDue(new Date("2025-06-04T12:00:00Z"), NOW)).toBe("Due in 3 days");
  });

  it("returns a short calendar date for dates a week or more out", () => {
    expect(formatNextDue(new Date("2025-06-15T12:00:00Z"), NOW)).toBe("Jun 15, 2025");
  });
});
