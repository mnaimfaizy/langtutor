/**
 * Pre-A1 chapter exam shape constants (ADR 0037–0039, issue #115).
 *
 * Curriculum-fixed: skill sections, item counts, and pass thresholds. The AI fills
 * item prompts/options only — it never changes these numbers or the pass rule.
 */

/** Skill sections aligned to the four pre-A1 units. */
export const PRE_A1_EXAM_SKILLS = ["alphabet", "phonics", "picture-words", "listen-tap"] as const;

export type PreA1ExamSkill = (typeof PRE_A1_EXAM_SKILLS)[number];

/** Items the AI must fill per skill section. */
export const PRE_A1_EXAM_ITEMS_PER_SKILL = 3;

/** Overall score must be ≥ this to pass (ADR 0039). */
export const PRE_A1_EXAM_OVERALL_THRESHOLD = 0.7;

/** Every skill section must be ≥ this to pass (ADR 0039). */
export const PRE_A1_EXAM_SKILL_FLOOR = 0.5;

export const PRE_A1_EXAM_TOPIC = "chapter-exam:pre-A1";

export function preA1ExamItemCount(): number {
  return PRE_A1_EXAM_SKILLS.length * PRE_A1_EXAM_ITEMS_PER_SKILL;
}
