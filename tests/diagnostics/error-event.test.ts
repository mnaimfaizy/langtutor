import { describe, expect, it } from "vitest";

import { createReadingErrorEvent } from "@/lib/diagnostics";

describe("createReadingErrorEvent", () => {
  const now = new Date("2024-01-15T10:00:00Z");

  it("tags skill as reading", () => {
    const event = createReadingErrorEvent({
      question: "What did Maria do?",
      category: "detail",
      cefr: "A2",
      now,
    });
    expect(event.skill).toBe("reading");
  });

  it("uses the supplied category", () => {
    const event = createReadingErrorEvent({
      question: "What is the main idea?",
      category: "main idea",
      cefr: "B1",
      now,
    });
    expect(event.category).toBe("main idea");
  });

  it("uses the supplied CEFR level", () => {
    const event = createReadingErrorEvent({
      question: "Q",
      category: "inference",
      cefr: "C1",
      now,
    });
    expect(event.cefr).toBe("C1");
  });

  it("stores question text as context", () => {
    const q = "Why did she go to the park?";
    const event = createReadingErrorEvent({ question: q, category: "inference", cefr: "A2", now });
    expect(event.context).toBe(q);
  });

  it("uses provided timestamp", () => {
    const ts = new Date("2024-06-01T08:00:00Z");
    const event = createReadingErrorEvent({
      question: "Q",
      category: "detail",
      cefr: "B2",
      now: ts,
    });
    expect(event.createdAt).toEqual(ts);
  });

  it("correct and wrong answers both produce the same shape (caller decides when to emit)", () => {
    const event = createReadingErrorEvent({
      question: "Where is the park?",
      category: "detail",
      cefr: "A1",
      now,
    });
    expect(event).toMatchObject({ skill: "reading", category: "detail", cefr: "A1" });
  });
});
