/**
 * AI fill for the pre-A1 chapter exam (ADR 0037, issue #115).
 *
 * Calls LLMClient with a Zod schema; bad output never unlocks A1 — callers only
 * unlock after a scored pass of a successfully filled exam.
 */
import type { LLMClient } from "@/lib/llm/llm-client";
import type { ChatMessage } from "@/lib/llm/types";

import { PreA1ExamFillSchema, type PreA1ExamFill } from "./schemas";
import { PRE_A1_EXAM_ITEMS_PER_SKILL, PRE_A1_EXAM_SKILLS, preA1ExamItemCount } from "./shape";

export function buildPreA1ExamFillMessages(): ChatMessage[] {
  const skillList = PRE_A1_EXAM_SKILLS.map(
    (skill) => `- ${skill}: exactly ${PRE_A1_EXAM_ITEMS_PER_SKILL} items`,
  ).join("\n");

  return [
    {
      role: "system",
      content:
        "You are an English teacher writing a short Pre-A1 chapter mastery exam for young beginners. " +
        "Use very simple English. Every item is multiple-choice with exactly 4 options. " +
        "Questions must be answerable without pictures or audio — use clear text prompts " +
        "(e.g. letter order, letter sounds, everyday words, listening-style word recognition).",
    },
    {
      role: "user",
      content:
        `Create a Pre-A1 chapter exam with exactly ${preA1ExamItemCount()} multiple-choice items.\n\n` +
        `Skill quotas (must match exactly):\n${skillList}\n\n` +
        `Return JSON: { "items": [ ... ] }.\n` +
        `Each item must have:\n` +
        `- skill: one of ${PRE_A1_EXAM_SKILLS.map((s) => `"${s}"`).join(", ")}\n` +
        `- prompt: short question text\n` +
        `- options: exactly 4 short answer strings\n` +
        `- answerIndex: 0–3 (index of the correct option)\n\n` +
        `Keep distractors plausible for beginners. Order items by skill: alphabet, then phonics, ` +
        `then picture-words, then listen-tap.`,
    },
  ];
}

/**
 * Fill exam items via the LLM seam. Throws if the model output fails Zod validation
 * (including wrong skill counts). Does not touch gate status or unlocks.
 */
export async function fillPreA1Exam(llm: LLMClient): Promise<PreA1ExamFill> {
  return llm.chat(buildPreA1ExamFillMessages(), { schema: PreA1ExamFillSchema });
}
