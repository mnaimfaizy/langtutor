import { describe, expect, it } from "vitest";

import type { Correction } from "@/lib/content/feedback";
import { createWritingErrorEvents } from "@/lib/diagnostics/writing";

const now = new Date("2024-03-10T12:00:00Z");

const corrections: Correction[] = [
  {
    original: "She go to school",
    corrected: "She goes to school",
    category: "subject-verb agreement",
    explanation: "Third-person singular verbs take an -s ending.",
  },
  {
    original: "He runs very fastly",
    corrected: "He runs very fast",
    category: "adverb usage",
    explanation: '"Fastly" is not a standard English word.',
  },
];

describe("createWritingErrorEvents", () => {
  it("returns an empty array when corrections is empty", () => {
    expect(createWritingErrorEvents([], "B1", now)).toHaveLength(0);
  });

  it("returns one event per correction", () => {
    expect(createWritingErrorEvents(corrections, "B1", now)).toHaveLength(2);
  });

  it("tags every event with skill = writing", () => {
    const events = createWritingErrorEvents(corrections, "B1", now);
    expect(events.every((e) => e.skill === "writing")).toBe(true);
  });

  it("uses the correction's category", () => {
    const events = createWritingErrorEvents(corrections, "B1", now);
    expect(events[0]!.category).toBe("subject-verb agreement");
    expect(events[1]!.category).toBe("adverb usage");
  });

  it("uses the supplied CEFR level", () => {
    const events = createWritingErrorEvents(corrections, "C1", now);
    expect(events.every((e) => e.cefr === "C1")).toBe(true);
  });

  it("uses correction.original as context", () => {
    const events = createWritingErrorEvents(corrections, "A2", now);
    expect(events[0]!.context).toBe("She go to school");
    expect(events[1]!.context).toBe("He runs very fastly");
  });

  it("uses the provided timestamp", () => {
    const ts = new Date("2025-01-01T00:00:00Z");
    const events = createWritingErrorEvents(corrections, "B2", ts);
    expect(events.every((e) => e.createdAt.getTime() === ts.getTime())).toBe(true);
  });

  it("uses a current timestamp when now is omitted", () => {
    const before = Date.now();
    const events = createWritingErrorEvents(corrections, "B1");
    const after = Date.now();
    for (const e of events) {
      expect(e.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(e.createdAt.getTime()).toBeLessThanOrEqual(after);
    }
  });

  it("shares the same timestamp across all events in one call", () => {
    const events = createWritingErrorEvents(corrections, "B1", now);
    expect(events[0]!.createdAt).toEqual(events[1]!.createdAt);
  });

  it("produces the full NewErrorEvent shape", () => {
    const [e] = createWritingErrorEvents([corrections[0]!], "B2", now);
    expect(e).toMatchObject({
      skill: "writing",
      category: "subject-verb agreement",
      cefr: "B2",
      context: "She go to school",
      createdAt: now,
    });
  });
});
