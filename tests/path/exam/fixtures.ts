/**
 * Shared fixture helpers for pre-A1 chapter exam tests.
 */
import type { PreA1ExamFill, PreA1ExamItem } from "@/lib/path/exam";
import { PRE_A1_EXAM_ITEMS_PER_SKILL, PRE_A1_EXAM_SKILLS } from "@/lib/path/exam";

export function makeExamItem(
  skill: PreA1ExamItem["skill"],
  answerIndex: 0 | 1 | 2 | 3 = 0,
  label = "A",
): PreA1ExamItem {
  return {
    skill,
    prompt: `${skill} question ${label}?`,
    options: ["A", "B", "C", "D"],
    answerIndex,
  };
}

/** Valid filled exam: 3 items per skill, all answerIndex 0. */
export function makeValidExamFill(): PreA1ExamFill {
  const items: PreA1ExamItem[] = [];
  for (const skill of PRE_A1_EXAM_SKILLS) {
    for (let i = 0; i < PRE_A1_EXAM_ITEMS_PER_SKILL; i++) {
      items.push(makeExamItem(skill, 0, String(i + 1)));
    }
  }
  return { items };
}

/** All-correct answers for {@link makeValidExamFill}. */
export function allCorrectAnswers(fill: PreA1ExamFill): number[] {
  return fill.items.map((item) => item.answerIndex);
}

/** All-wrong answers (always pick a non-correct option). */
export function allWrongAnswers(fill: PreA1ExamFill): number[] {
  return fill.items.map((item) => (item.answerIndex + 1) % 4);
}
