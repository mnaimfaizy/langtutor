/**
 * Teacher-assigned chapter review after a failed pre-A1 gate (ADR 0036 / 0034, issue #117).
 *
 * Builds a Zod-validated assignment from the deterministic exam score breakdown (and optional
 * teacher focusSkills). Completing every item unlocks a retake; review alone never clears the
 * gate — re-pass is still required.
 */
import { z } from "zod";

import type {
  ChapterGate,
  ChapterReviewAssignment,
  ChapterReviewAssignmentItem,
  ContentRepository,
} from "@/lib/db";

import { PRE_A1_CHAPTER_TIER } from "../chapter-gate";
import { reviewPathIndexForStage } from "../shared-path-catalog";
import { PreA1ExamSkillSchema, type PreA1ExamSkill } from "./schemas";
import type { ExamScoreBreakdown } from "./scoring";
import { PRE_A1_EXAM_SKILLS } from "./shape";

export const PRE_A1_SKILL_TO_UNIT_INDEX: Record<PreA1ExamSkill, number> = {
  alphabet: reviewPathIndexForStage("alphabet"),
  phonics: reviewPathIndexForStage("phonics"),
  "picture-words": reviewPathIndexForStage("picture-words"),
  "listen-tap": reviewPathIndexForStage("listen-tap"),
};

export const PRE_A1_REVIEW_SKILL_LABEL: Record<PreA1ExamSkill, string> = {
  alphabet: "Alphabet",
  phonics: "Phonics",
  "picture-words": "Picture words",
  "listen-tap": "Listen & tap",
};

export const ReviewAssignmentItemSchema = z.object({
  id: z.string().min(1),
  unitIndex: z.number().int().max(-1),
  skill: PreA1ExamSkillSchema,
  label: z.string().min(1).max(120),
  done: z.boolean(),
});

export const ReviewAssignmentSchema = z.object({
  items: z.array(ReviewAssignmentItemSchema).min(1).max(PRE_A1_EXAM_SKILLS.length),
  createdAt: z.string().min(1),
  attemptContentId: z.number().int().positive().optional(),
});

export type ReviewAssignment = z.infer<typeof ReviewAssignmentSchema>;

export interface BuildReviewAssignmentArgs {
  breakdown: ExamScoreBreakdown;
  /** Optional teacher-report focus skills merged into the assignment. */
  focusSkills?: readonly PreA1ExamSkill[];
  attemptContentId?: number;
  now?: Date;
}

function uniqueSkills(skills: readonly PreA1ExamSkill[]): PreA1ExamSkill[] {
  const seen = new Set<PreA1ExamSkill>();
  const out: PreA1ExamSkill[] = [];
  for (const skill of skills) {
    if (seen.has(skill)) continue;
    seen.add(skill);
    out.push(skill);
  }
  return out;
}

/**
 * Prefer skills below the per-skill floor; if none (overall failed only), take the
 * weakest sections. Merge optional report focusSkills. Always ≥1 item on a fail.
 */
export function selectReviewSkills(
  breakdown: ExamScoreBreakdown,
  focusSkills: readonly PreA1ExamSkill[] = [],
): PreA1ExamSkill[] {
  const belowFloor = breakdown.bySkill.filter((s) => !s.metFloor).map((s) => s.skill);
  const weakest = [...breakdown.bySkill]
    .sort((a, b) => a.ratio - b.ratio || a.skill.localeCompare(b.skill))
    .slice(0, 2)
    .map((s) => s.skill);
  const primary = belowFloor.length > 0 ? belowFloor : weakest;
  const selected = uniqueSkills([...primary, ...focusSkills]);
  return selected.length > 0 ? selected : [PRE_A1_EXAM_SKILLS[0]];
}

/** Zod-structured review assignment from exam results (+ optional report focus). */
export function buildPreA1ReviewAssignment(args: BuildReviewAssignmentArgs): ReviewAssignment {
  const now = args.now ?? new Date();
  const skills = selectReviewSkills(args.breakdown, args.focusSkills ?? []);
  const items: ChapterReviewAssignmentItem[] = skills.map((skill) => ({
    id: skill,
    unitIndex: PRE_A1_SKILL_TO_UNIT_INDEX[skill],
    skill,
    label: `Practice ${PRE_A1_REVIEW_SKILL_LABEL[skill]}`,
    done: false,
  }));
  return ReviewAssignmentSchema.parse({
    items,
    createdAt: now.toISOString(),
    attemptContentId: args.attemptContentId,
  });
}

export function isReviewAssignmentComplete(
  assignment: Pick<ChapterReviewAssignment, "items"> | null | undefined,
): boolean {
  if (!assignment || assignment.items.length === 0) return false;
  return assignment.items.every((item) => item.done);
}

/** Mark one checklist item done; when all done, advance gate to ready_retake. */
export async function markPreA1ReviewItemDone(
  repo: ContentRepository,
  itemId: string,
  now: Date = new Date(),
): Promise<ChapterGate | undefined> {
  const gate = await repo.getChapterGate(PRE_A1_CHAPTER_TIER);
  if (!gate || gate.status !== "failed_review" || !gate.reviewAssignment) {
    return gate;
  }

  const items = gate.reviewAssignment.items.map((item) =>
    item.id === itemId ? { ...item, done: true } : item,
  );
  const reviewAssignment = ReviewAssignmentSchema.parse({
    ...gate.reviewAssignment,
    items,
  });
  const status = isReviewAssignmentComplete(reviewAssignment) ? "ready_retake" : "failed_review";

  const next: ChapterGate = {
    tier: PRE_A1_CHAPTER_TIER,
    status,
    updatedAt: now,
    reviewAssignment,
  };
  await repo.saveChapterGate(next);
  return next;
}

/** True when the chapter exam may be started (first attempt or post-review retake). */
export function isPreA1ExamStartAllowed(status: ChapterGate["status"] | undefined): boolean {
  const resolved = status ?? "pending";
  return resolved === "pending" || resolved === "ready_retake";
}
