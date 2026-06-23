import { describe, expect, it } from "vitest";

import { CorrectionSchema, FeedbackSchema, buildFeedbackMessages } from "@/lib/content/feedback";

describe("FeedbackSchema", () => {
  const validFeedback = {
    overallScore: 7,
    structuralGrade: "Good",
    corrections: [
      {
        original: "She go to school",
        corrected: "She goes to school",
        category: "subject-verb agreement",
        explanation: "Third-person singular verbs take an -s ending.",
      },
      {
        original: "He runs very fastly",
        corrected: "He runs very fast",
        category: "adverb placement",
        explanation: '"Fast" is already an adverb; "fastly" is not a standard English word.',
      },
    ],
  };

  it("parses a valid feedback object", () => {
    const result = FeedbackSchema.parse(validFeedback);
    expect(result.overallScore).toBe(7);
    expect(result.structuralGrade).toBe("Good");
    expect(result.corrections).toHaveLength(2);
  });

  it("accepts an empty corrections array (no errors)", () => {
    const result = FeedbackSchema.parse({
      overallScore: 10,
      structuralGrade: "Excellent",
      corrections: [],
    });
    expect(result.corrections).toHaveLength(0);
    expect(result.overallScore).toBe(10);
  });

  it("rejects overallScore outside 0–10", () => {
    expect(() => FeedbackSchema.parse({ ...validFeedback, overallScore: 11 })).toThrow();
    expect(() => FeedbackSchema.parse({ ...validFeedback, overallScore: -1 })).toThrow();
  });

  it("rejects non-integer overallScore", () => {
    expect(() => FeedbackSchema.parse({ ...validFeedback, overallScore: 7.5 })).toThrow();
  });

  it("rejects empty structuralGrade", () => {
    expect(() => FeedbackSchema.parse({ ...validFeedback, structuralGrade: "" })).toThrow();
  });

  it("rejects a correction missing a required field", () => {
    const badCorrection = { original: "She go", corrected: "She goes", category: "grammar" };
    expect(() =>
      FeedbackSchema.parse({ ...validFeedback, corrections: [badCorrection] }),
    ).toThrow();
  });

  it("rejects a correction with an empty original", () => {
    const badCorrection = {
      original: "",
      corrected: "She goes",
      category: "grammar",
      explanation: "reason",
    };
    expect(() =>
      FeedbackSchema.parse({ ...validFeedback, corrections: [badCorrection] }),
    ).toThrow();
  });
});

describe("CorrectionSchema", () => {
  it("parses a full correction object", () => {
    const result = CorrectionSchema.parse({
      original: "I buyed a car",
      corrected: "I bought a car",
      category: "irregular past tense",
      explanation: '"Buy" has an irregular past tense: "bought".',
    });
    expect(result.category).toBe("irregular past tense");
  });
});

describe("buildFeedbackMessages", () => {
  it("returns exactly two messages (system + user)", () => {
    const msgs = buildFeedbackMessages("I writed a letter yesterday.", "A2");
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].role).toBe("user");
  });

  it("includes the draft text in the user message", () => {
    const draft = "She go to the store every day.";
    const msgs = buildFeedbackMessages(draft, "B1");
    expect(msgs[1].content).toContain(draft);
  });

  it("includes the CEFR level in both messages", () => {
    const msgs = buildFeedbackMessages("test", "C1");
    expect(msgs[0].content).toContain("C1");
    expect(msgs[1].content).toContain("C1");
  });
});
