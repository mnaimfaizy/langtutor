import { describe, expect, it } from "vitest";

import type { WerAlignment } from "@/lib/diagnostics/wer";
import { createSpeakingErrorEvents } from "@/lib/diagnostics/speaking";

const now = new Date("2025-01-15T10:00:00Z");

const alignment: WerAlignment[] = [
  { ref: "hello", hyp: "hello", type: "correct" },
  { ref: "world", hyp: "word", type: "substitution" },
  { ref: "again", hyp: null, type: "deletion" },
  { ref: null, hyp: "extra", type: "insertion" },
];

describe("createSpeakingErrorEvents", () => {
  it("returns empty array for empty alignment", () => {
    expect(createSpeakingErrorEvents([], "B1", now)).toHaveLength(0);
  });

  it("excludes correct tokens", () => {
    const onlyCorrect: WerAlignment[] = [
      { ref: "one", hyp: "one", type: "correct" },
      { ref: "two", hyp: "two", type: "correct" },
    ];
    expect(createSpeakingErrorEvents(onlyCorrect, "B1", now)).toHaveLength(0);
  });

  it("includes one event per non-correct token", () => {
    const events = createSpeakingErrorEvents(alignment, "B1", now);
    expect(events).toHaveLength(3);
  });

  it("tags every event with skill = speaking", () => {
    const events = createSpeakingErrorEvents(alignment, "A1", now);
    expect(events.every((e) => e.skill === "speaking")).toBe(true);
  });

  it("uses the alignment type as category", () => {
    const events = createSpeakingErrorEvents(alignment, "B1", now);
    const categories = events.map((e) => e.category);
    expect(categories).toContain("substitution");
    expect(categories).toContain("deletion");
    expect(categories).toContain("insertion");
  });

  it("uses ref word as context for substitutions and deletions", () => {
    const events = createSpeakingErrorEvents(alignment, "B1", now);
    const sub = events.find((e) => e.category === "substitution");
    const del = events.find((e) => e.category === "deletion");
    expect(sub?.context).toBe("world");
    expect(del?.context).toBe("again");
  });

  it("uses hyp word as context for insertions", () => {
    const events = createSpeakingErrorEvents(alignment, "B1", now);
    const ins = events.find((e) => e.category === "insertion");
    expect(ins?.context).toBe("extra");
  });

  it("propagates the supplied CEFR level", () => {
    const events = createSpeakingErrorEvents(alignment, "C2", now);
    expect(events.every((e) => e.cefr === "C2")).toBe(true);
  });

  it("uses the provided timestamp for all events", () => {
    const events = createSpeakingErrorEvents(alignment, "B2", now);
    expect(events.every((e) => e.createdAt.getTime() === now.getTime())).toBe(true);
  });

  it("uses a current timestamp when now is omitted", () => {
    const before = Date.now();
    const events = createSpeakingErrorEvents(alignment, "B1");
    const after = Date.now();
    for (const e of events) {
      expect(e.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(e.createdAt.getTime()).toBeLessThanOrEqual(after);
    }
  });

  it("produces the full NewErrorEvent shape for a substitution", () => {
    const [sub] = createSpeakingErrorEvents(alignment, "B2", now);
    expect(sub).toMatchObject({
      skill: "speaking",
      category: "substitution",
      cefr: "B2",
      context: "world",
      createdAt: now,
    });
  });
});
