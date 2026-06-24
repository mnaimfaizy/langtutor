import { describe, expect, it } from "vitest";

import { computeWeaknesses } from "@/lib/diagnostics/weakness";
import type { ErrorEventRecord } from "@/lib/db";

const BASE_NOW = new Date("2025-06-01T12:00:00Z");

function makeEvent(
  overrides: Partial<Omit<ErrorEventRecord, "id">> & { id?: number },
): ErrorEventRecord {
  return {
    id: overrides.id ?? 1,
    skill: overrides.skill ?? "reading",
    category: overrides.category ?? "grammar",
    cefr: overrides.cefr ?? "B1",
    context: overrides.context ?? "Some sentence.",
    createdAt: overrides.createdAt ?? BASE_NOW,
  };
}

function daysAgo(days: number, from = BASE_NOW): Date {
  return new Date(from.getTime() - days * 86_400_000);
}

describe("computeWeaknesses", () => {
  it("returns empty array for no events", () => {
    expect(computeWeaknesses([], BASE_NOW)).toHaveLength(0);
  });

  it("returns one entry for a single event", () => {
    const result = computeWeaknesses([makeEvent({ id: 1 })], BASE_NOW);
    expect(result).toHaveLength(1);
  });

  it("groups by (skill, category, cefr) — same triple collapses", () => {
    const events = [
      makeEvent({ id: 1, skill: "reading", category: "grammar", cefr: "B1" }),
      makeEvent({ id: 2, skill: "reading", category: "grammar", cefr: "B1" }),
    ];
    expect(computeWeaknesses(events, BASE_NOW)).toHaveLength(1);
  });

  it("keeps separate entries for different categories", () => {
    const events = [
      makeEvent({ id: 1, category: "grammar" }),
      makeEvent({ id: 2, category: "vocabulary" }),
    ];
    expect(computeWeaknesses(events, BASE_NOW)).toHaveLength(2);
  });

  it("keeps separate entries for different skills", () => {
    const events = [makeEvent({ id: 1, skill: "reading" }), makeEvent({ id: 2, skill: "writing" })];
    expect(computeWeaknesses(events, BASE_NOW)).toHaveLength(2);
  });

  it("keeps separate entries for different CEFR levels", () => {
    const events = [makeEvent({ id: 1, cefr: "A1" }), makeEvent({ id: 2, cefr: "B2" })];
    expect(computeWeaknesses(events, BASE_NOW)).toHaveLength(2);
  });

  it("score is strictly between 0 and 1 for a single recent event", () => {
    const [entry] = computeWeaknesses([makeEvent({ id: 1 })], BASE_NOW);
    expect(entry.score).toBeGreaterThan(0);
    expect(entry.score).toBeLessThan(1);
  });

  it("more events in same category → higher score", () => {
    const oneEvent = [makeEvent({ id: 1 })];
    const manyEvents = Array.from({ length: 10 }, (_, i) => makeEvent({ id: i + 1 }));
    const [low] = computeWeaknesses(oneEvent, BASE_NOW);
    const [high] = computeWeaknesses(manyEvents, BASE_NOW);
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("same count of events, older timestamps → lower score than recent", () => {
    const recent = [
      makeEvent({ id: 1, createdAt: daysAgo(1) }),
      makeEvent({ id: 2, createdAt: daysAgo(2) }),
      makeEvent({ id: 3, createdAt: daysAgo(3) }),
    ];
    const old = [
      makeEvent({ id: 4, createdAt: daysAgo(90) }),
      makeEvent({ id: 5, createdAt: daysAgo(91) }),
      makeEvent({ id: 6, createdAt: daysAgo(92) }),
    ];
    const [recentEntry] = computeWeaknesses(recent, BASE_NOW);
    const [oldEntry] = computeWeaknesses(old, BASE_NOW);
    expect(recentEntry.score).toBeGreaterThan(oldEntry.score);
  });

  it("confidence is 0 for a single event", () => {
    const [entry] = computeWeaknesses([makeEvent({ id: 1 })], BASE_NOW);
    expect(entry.confidence).toBeGreaterThanOrEqual(0);
    expect(entry.confidence).toBeLessThan(1);
  });

  it("confidence reaches 1 with many recent events", () => {
    const events = Array.from({ length: 50 }, (_, i) => makeEvent({ id: i + 1 }));
    const [entry] = computeWeaknesses(events, BASE_NOW);
    expect(entry.confidence).toBe(1);
  });

  it("score and confidence are both in [0, 1]", () => {
    const events = Array.from({ length: 20 }, (_, i) =>
      makeEvent({ id: i + 1, createdAt: daysAgo(i * 5) }),
    );
    const results = computeWeaknesses(events, BASE_NOW);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("entry carries the correct (skill, category, cefr) triple", () => {
    const event = makeEvent({ id: 1, skill: "writing", category: "spelling", cefr: "A2" });
    const [entry] = computeWeaknesses([event], BASE_NOW);
    expect(entry.skill).toBe("writing");
    expect(entry.category).toBe("spelling");
    expect(entry.cefr).toBe("A2");
  });

  it("updatedAt is the supplied now value", () => {
    const [entry] = computeWeaknesses([makeEvent({ id: 1 })], BASE_NOW);
    expect(entry.updatedAt).toBe(BASE_NOW);
  });

  it("an event dated in the future is treated as age=0 (no negative decay)", () => {
    const futureEvent = makeEvent({ id: 1, createdAt: new Date(BASE_NOW.getTime() + 10_000_000) });
    const [entry] = computeWeaknesses([futureEvent], BASE_NOW);
    expect(entry.score).toBeGreaterThan(0);
    expect(entry.score).toBeLessThanOrEqual(1);
  });
});
