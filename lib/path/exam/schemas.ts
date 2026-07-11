/**
 * Zod schemas for AI-filled pre-A1 chapter exam items (ADR 0037, issue #115)
 * and teacher-report request bodies (issue #116).
 */
import { z } from "zod";

import { PRE_A1_EXAM_ITEMS_PER_SKILL, PRE_A1_EXAM_SKILLS, type PreA1ExamSkill } from "./shape";

export const PreA1ExamSkillSchema = z.enum(PRE_A1_EXAM_SKILLS);

export type { PreA1ExamSkill };

export const PreA1ExamItemSchema = z.object({
  skill: PreA1ExamSkillSchema,
  prompt: z.string().min(1).max(280),
  options: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1)]),
  answerIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});

export type PreA1ExamItem = z.infer<typeof PreA1ExamItemSchema>;

/**
 * Full AI fill payload. Length is fixed by shape constants; refine checks that each
 * skill appears exactly `PRE_A1_EXAM_ITEMS_PER_SKILL` times.
 */
export const PreA1ExamFillSchema = z
  .object({
    items: z
      .array(PreA1ExamItemSchema)
      .length(PRE_A1_EXAM_SKILLS.length * PRE_A1_EXAM_ITEMS_PER_SKILL),
  })
  .superRefine((data, ctx) => {
    for (const skill of PRE_A1_EXAM_SKILLS) {
      const count = data.items.filter((item) => item.skill === skill).length;
      if (count !== PRE_A1_EXAM_ITEMS_PER_SKILL) {
        ctx.addIssue({
          code: "custom",
          message: `Expected ${PRE_A1_EXAM_ITEMS_PER_SKILL} items for skill "${skill}", got ${count}`,
          path: ["items"],
        });
      }
    }
  });

export type PreA1ExamFill = z.infer<typeof PreA1ExamFillSchema>;

/** Learner answers keyed by item index (null = unanswered). */
export const PreA1ExamAnswersSchema = z.array(
  z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.null()]),
);

export type PreA1ExamAnswers = z.infer<typeof PreA1ExamAnswersSchema>;

/** Score breakdown shape accepted by the teacher-report API (mirrors ExamScoreBreakdown). */
export const ExamScoreBreakdownSchema = z.object({
  overallCorrect: z.number().int().min(0),
  overallTotal: z.number().int().min(0),
  overallRatio: z.number().min(0).max(1),
  passed: z.boolean(),
  bySkill: z
    .array(
      z.object({
        skill: PreA1ExamSkillSchema,
        correct: z.number().int().min(0),
        total: z.number().int().min(0),
        ratio: z.number().min(0).max(1),
        metFloor: z.boolean(),
      }),
    )
    .length(PRE_A1_EXAM_SKILLS.length),
});

export const TeacherReportRequestSchema = z.object({
  experienceMode: z.enum(["adult", "kid"]),
  breakdown: ExamScoreBreakdownSchema,
});

export type TeacherReportRequest = z.infer<typeof TeacherReportRequestSchema>;
