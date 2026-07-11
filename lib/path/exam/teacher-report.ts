/**
 * AI teacher report after a pre-A1 chapter exam (ADR 0037–0038 / 0041 / 0043, issue #116).
 *
 * Motivational, register-aware (kid vs adult), grounded in the attempt score breakdown.
 * Pass/fail is never invented here — the prompt receives the deterministic score.
 * Uses the content pipeline with skipValidation (teacher-voice metadata).
 */
import { z } from "zod";

import { NoopContentSink } from "@/lib/content/null-adapters";
import { generateContent } from "@/lib/content/pipeline";
import type { ExperienceMode } from "@/lib/db";
import type { LLMClient } from "@/lib/llm/llm-client";
import type { ChatMessage } from "@/lib/llm/types";

import { PRE_A1_CURRICULUM_GUIDE_STUB } from "./guide-stub";
import { PreA1ExamSkillSchema } from "./schemas";
import type { ExamScoreBreakdown } from "./scoring";
import { PRE_A1_EXAM_SKILLS } from "./shape";

export const PRE_A1_EXAM_REPORT_TOPIC = "chapter-exam-report:pre-A1";

export const TeacherReportSchema = z.object({
  headline: z.string().min(1).max(120),
  body: z.string().min(1).max(1200),
  encouragement: z.string().min(1).max(300),
  /** Skills the learner should practice next (may be empty on a strong pass). */
  focusSkills: z.array(PreA1ExamSkillSchema).max(PRE_A1_EXAM_SKILLS.length),
});

export type TeacherReport = z.infer<typeof TeacherReportSchema>;

export interface TeacherReportContext {
  experienceMode: ExperienceMode;
  breakdown: ExamScoreBreakdown;
}

const ADULT_PERSONA =
  "You are an experienced, professional English teacher writing a short coaching report " +
  "after a Pre-A1 chapter mastery exam for an adult beginner. Be clear, encouraging, and " +
  "precise. Treat the learner as a capable adult — never talk down. Motivate without " +
  "flattery; name concrete skills to practice.";

const KID_PERSONA =
  "You are a warm, cheerful kindergarten English teacher writing a short coaching note " +
  "after a Pre-A1 chapter exam for a young child. Use very simple, playful, encouraging " +
  "words a five-year-old can understand. Celebrate effort. Never use technical jargon.";

function personaFor(mode: ExperienceMode): string {
  return mode === "kid" ? KID_PERSONA : ADULT_PERSONA;
}

function taskFor(mode: ExperienceMode): string {
  if (mode === "kid") {
    return (
      `- headline: a short, happy title (max 8 words)\n` +
      `- body: 2–4 very short sentences about what went well and what to practice, ` +
      `using simple words only\n` +
      `- encouragement: one warm cheer-up sentence\n` +
      `- focusSkills: zero to four skill ids from the exam that need more practice ` +
      `(use the exact skill strings from the score)`
    );
  }
  return (
    `- headline: a short, clear coaching title (max 10 words)\n` +
    `- body: 2–4 sentences summarizing strengths and the weakest skill sections, ` +
    `with concrete next practice pointers\n` +
    `- encouragement: one sincere motivational sentence\n` +
    `- focusSkills: zero to four skill ids that need more practice ` +
    `(use the exact skill strings from the score)`
  );
}

function formatBreakdown(breakdown: ExamScoreBreakdown): string {
  const skillLines = breakdown.bySkill
    .map(
      (s) =>
        `- ${s.skill}: ${s.correct}/${s.total} (${Math.round(s.ratio * 100)}%)` +
        `${s.metFloor ? "" : " — below floor"}`,
    )
    .join("\n");
  return (
    `Outcome: ${breakdown.passed ? "PASSED" : "NOT PASSED"} ` +
    `(do not contradict this — you do not decide pass/fail).\n` +
    `Overall: ${breakdown.overallCorrect}/${breakdown.overallTotal} ` +
    `(${Math.round(breakdown.overallRatio * 100)}%).\n` +
    `By skill:\n${skillLines}`
  );
}

/**
 * Builds chat messages for the teacher report. Curriculum guide stub is injected
 * as fundamental orientation (ADR 0041); experience mode only changes register.
 */
export function buildPreA1TeacherReportMessages(ctx: TeacherReportContext): ChatMessage[] {
  const { experienceMode, breakdown } = ctx;

  return [
    {
      role: "system",
      content:
        `${personaFor(experienceMode)}\n\n` +
        `Curriculum guide (follow as fundamental orientation; you may adapt with your ` +
        `knowledge but do not contradict this guide or invent a conflicting pass/fail):\n` +
        PRE_A1_CURRICULUM_GUIDE_STUB,
    },
    {
      role: "user",
      content:
        `Here is the learner's scored Pre-A1 chapter exam attempt:\n\n` +
        `${formatBreakdown(breakdown)}\n\n` +
        `Write a motivational teacher report grounded in these scores.\n` +
        `Highlight weak sections when present; celebrate strong ones.\n\n` +
        `Return a JSON object with exactly these fields:\n${taskFor(experienceMode)}`,
    },
  ];
}

/**
 * Generate a Zod-validated teacher report via LLMClient + corrective retry on
 * schema parse failure. Does not touch gate unlock — callers score/unlock first.
 */
export async function generatePreA1TeacherReport(
  llm: LLMClient,
  ctx: TeacherReportContext,
): Promise<TeacherReport> {
  const result = await generateContent(
    {
      messages: buildPreA1TeacherReportMessages(ctx),
      level: "A1",
      schema: TeacherReportSchema,
      textField: "body",
      type: "lesson",
      topic: PRE_A1_EXAM_REPORT_TOPIC,
      skipValidation: true,
    },
    llm,
    null,
    new NoopContentSink(),
  );
  return result.parsed;
}
