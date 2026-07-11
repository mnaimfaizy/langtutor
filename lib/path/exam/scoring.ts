/**
 * Deterministic pre-A1 chapter exam scoring (ADR 0038–0039, issue #115).
 *
 * Pass iff overall ≥ 70% and every skill section ≥ 50%. The AI never overrides this.
 */
import type { PreA1ExamFill, PreA1ExamItem } from "./schemas";
import type { PreA1ExamSkill } from "./shape";
import {
  PRE_A1_EXAM_OVERALL_THRESHOLD,
  PRE_A1_EXAM_SKILL_FLOOR,
  PRE_A1_EXAM_SKILLS,
} from "./shape";

export interface SkillScore {
  skill: PreA1ExamSkill;
  correct: number;
  total: number;
  /** Ratio in [0, 1]; 0 when total is 0. */
  ratio: number;
  /** True when ratio ≥ skill floor (or section has no items). */
  metFloor: boolean;
}

export interface ExamScoreBreakdown {
  overallCorrect: number;
  overallTotal: number;
  overallRatio: number;
  bySkill: SkillScore[];
  /** True iff overall ≥ threshold AND every skill met its floor. */
  passed: boolean;
}

/** Selected option index per item; `null` / missing = incorrect. */
export type ExamAnswerSelection = ReadonlyArray<number | null | undefined>;

function isCorrect(item: PreA1ExamItem, selected: number | null | undefined): boolean {
  return selected === item.answerIndex;
}

/**
 * Score a completed (or partial) attempt. Unanswered items count as wrong.
 * Partial/abandoned attempts never pass unless the remaining blanks still leave
 * both thresholds met — which they won't if anything is unanswered below the bar.
 */
export function scorePreA1Exam(
  fill: Pick<PreA1ExamFill, "items">,
  answers: ExamAnswerSelection,
): ExamScoreBreakdown {
  const bySkill: SkillScore[] = PRE_A1_EXAM_SKILLS.map((skill) => {
    const items = fill.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.skill === skill);
    const correct = items.filter(({ item, index }) => isCorrect(item, answers[index])).length;
    const total = items.length;
    const ratio = total === 0 ? 0 : correct / total;
    return {
      skill,
      correct,
      total,
      ratio,
      metFloor: total === 0 || ratio >= PRE_A1_EXAM_SKILL_FLOOR,
    };
  });

  const overallCorrect = fill.items.filter((item, index) => isCorrect(item, answers[index])).length;
  const overallTotal = fill.items.length;
  const overallRatio = overallTotal === 0 ? 0 : overallCorrect / overallTotal;
  const passed = overallRatio >= PRE_A1_EXAM_OVERALL_THRESHOLD && bySkill.every((s) => s.metFloor);

  return {
    overallCorrect,
    overallTotal,
    overallRatio,
    bySkill,
    passed,
  };
}
