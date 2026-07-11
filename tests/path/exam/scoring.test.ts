import { describe, expect, it } from "vitest";

import {
  PRE_A1_EXAM_OVERALL_THRESHOLD,
  PRE_A1_EXAM_SKILL_FLOOR,
  PreA1ExamFillSchema,
  scorePreA1Exam,
} from "@/lib/path/exam";

import { allCorrectAnswers, allWrongAnswers, makeExamItem, makeValidExamFill } from "./fixtures";

describe("PreA1ExamFillSchema", () => {
  it("accepts a shape-compliant fill", () => {
    const parsed = PreA1ExamFillSchema.safeParse(makeValidExamFill());
    expect(parsed.success).toBe(true);
  });

  it("rejects wrong item count", () => {
    const fill = makeValidExamFill();
    const parsed = PreA1ExamFillSchema.safeParse({ items: fill.items.slice(0, 3) });
    expect(parsed.success).toBe(false);
  });

  it("rejects unbalanced skill quotas", () => {
    const fill = makeValidExamFill();
    // Six alphabet, zero phonics — same length but wrong quotas.
    const items = fill.items.map((item, i) =>
      i < 6 ? makeExamItem("alphabet", 0, `a${i}`) : item,
    );
    const parsed = PreA1ExamFillSchema.safeParse({ items });
    expect(parsed.success).toBe(false);
  });
});

describe("scorePreA1Exam", () => {
  it("passes when overall ≥ 70% and every skill ≥ 50%", () => {
    const fill = makeValidExamFill();
    // 9/12 = 75%; miss one per the last three skills → each still 2/3 ≈ 66%
    const answers = allCorrectAnswers(fill);
    answers[3] = 1; // phonics miss
    answers[6] = 1; // picture-words miss
    answers[9] = 1; // listen-tap miss
    const result = scorePreA1Exam(fill, answers);
    expect(result.overallRatio).toBeCloseTo(0.75);
    expect(result.overallRatio).toBeGreaterThanOrEqual(PRE_A1_EXAM_OVERALL_THRESHOLD);
    expect(result.bySkill.every((s) => s.metFloor)).toBe(true);
    expect(result.passed).toBe(true);
  });

  it("fails when overall is below 70% even if skills meet the floor", () => {
    const fill = makeValidExamFill();
    // 8/12 ≈ 66.7%; each skill 2/3 ≈ 66% ≥ 50%
    const answers = allCorrectAnswers(fill);
    answers[0] = 1;
    answers[3] = 1;
    answers[6] = 1;
    answers[9] = 1;
    const result = scorePreA1Exam(fill, answers);
    expect(result.overallRatio).toBeCloseTo(8 / 12);
    expect(result.overallRatio).toBeLessThan(PRE_A1_EXAM_OVERALL_THRESHOLD);
    expect(result.bySkill.every((s) => s.ratio >= PRE_A1_EXAM_SKILL_FLOOR)).toBe(true);
    expect(result.passed).toBe(false);
  });

  it("fails when one skill is below the 50% floor even if overall is high", () => {
    const fill = makeValidExamFill();
    // Miss all 3 alphabet (0%); keep others perfect → 9/12 = 75%
    const answers = allCorrectAnswers(fill);
    answers[0] = 1;
    answers[1] = 1;
    answers[2] = 1;
    const result = scorePreA1Exam(fill, answers);
    expect(result.overallRatio).toBeCloseTo(0.75);
    const alphabet = result.bySkill.find((s) => s.skill === "alphabet");
    expect(alphabet?.metFloor).toBe(false);
    expect(result.passed).toBe(false);
  });

  it("treats unanswered items as incorrect (abandon cannot pass)", () => {
    const fill = makeValidExamFill();
    const answers = new Array<number | null>(fill.items.length).fill(null);
    // Answer only first 8 correctly — remaining nulls are wrong → 8/12 < 70%
    for (let i = 0; i < 8; i++) answers[i] = fill.items[i]!.answerIndex;
    const result = scorePreA1Exam(fill, answers);
    expect(result.passed).toBe(false);
    expect(result.overallCorrect).toBe(8);
  });

  it("fails an all-wrong attempt", () => {
    const fill = makeValidExamFill();
    expect(scorePreA1Exam(fill, allWrongAnswers(fill)).passed).toBe(false);
  });

  it("passes an all-correct attempt", () => {
    const fill = makeValidExamFill();
    expect(scorePreA1Exam(fill, allCorrectAnswers(fill)).passed).toBe(true);
  });
});
