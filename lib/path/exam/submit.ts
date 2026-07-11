/**
 * Submit a scored pre-A1 chapter exam: persist attempt, mark gate, unlock A1 on pass.
 * (ADR 0038–0039 / 0043, issue #115)
 *
 * Partial / abandoned attempts must not call this — or if they do with incomplete
 * answers, scoring treats blanks as wrong so pass/unlock won't fire unless thresholds
 * still hold (they won't for a real abandon). Already-passed gates are left alone.
 */
import type { ContentRepository } from "@/lib/db";

import { PRE_A1_CHAPTER_TIER, resolveChapterGateStatus } from "../chapter-gate";
import type { PreA1ExamFill } from "./schemas";
import { scorePreA1Exam, type ExamAnswerSelection, type ExamScoreBreakdown } from "./scoring";
import { PRE_A1_EXAM_TOPIC } from "./shape";

export interface SubmitPreA1ExamResult {
  breakdown: ExamScoreBreakdown;
  /** True when this submit newly marked the gate passed and unlocked unit 0. */
  unlockedA1: boolean;
  /** True when the gate was already passed before this submit. */
  alreadyPassed: boolean;
  contentId: number;
}

/**
 * Score answers, persist the attempt as quiz content, and on pass mark the pre-A1
 * gate passed and set unit 0 to available. Fail / already-passed never unlocks again
 * (idempotent if already available).
 */
export async function submitPreA1ChapterExam(
  repo: ContentRepository,
  fill: PreA1ExamFill,
  answers: ExamAnswerSelection,
  now: Date = new Date(),
): Promise<SubmitPreA1ExamResult> {
  const breakdown = scorePreA1Exam(fill, answers);

  const existingGate = await repo.getChapterGate(PRE_A1_CHAPTER_TIER);
  const alreadyPassed = resolveChapterGateStatus(existingGate) === "passed";

  const contentId = await repo.putContent({
    type: "quiz",
    level: "A1",
    topic: PRE_A1_EXAM_TOPIC,
    payload: {
      tier: PRE_A1_CHAPTER_TIER,
      items: fill.items,
      answers: [...answers],
      breakdown: {
        overallCorrect: breakdown.overallCorrect,
        overallTotal: breakdown.overallTotal,
        overallRatio: breakdown.overallRatio,
        passed: breakdown.passed,
        bySkill: breakdown.bySkill.map((s) => ({
          skill: s.skill,
          correct: s.correct,
          total: s.total,
          ratio: s.ratio,
          metFloor: s.metFloor,
        })),
      },
      submittedAt: now.toISOString(),
    },
    source: "generated",
    validatedAt: now,
  });

  if (alreadyPassed) {
    return { breakdown, unlockedA1: false, alreadyPassed: true, contentId };
  }

  if (!breakdown.passed) {
    await repo.saveChapterGate({
      tier: PRE_A1_CHAPTER_TIER,
      status: "pending",
      updatedAt: now,
    });
    return { breakdown, unlockedA1: false, alreadyPassed: false, contentId };
  }

  await repo.saveChapterGate({
    tier: PRE_A1_CHAPTER_TIER,
    status: "passed",
    updatedAt: now,
  });

  const units = await repo.getUnits();
  const unit0 = units.find((u) => u.index === 0);
  if (unit0 && unit0.status === "locked") {
    await repo.updateUnit(unit0.id, { status: "available" });
  }

  return { breakdown, unlockedA1: true, alreadyPassed: false, contentId };
}
