import { z } from "zod";

import type { Cefr } from "@/lib/db";
import type { ChatMessage } from "@/lib/llm/types";

import type { PassagePayload } from "./passage";

export const ComprehensionQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  answerIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  category: z.string(),
});

export type ComprehensionQuestion = z.infer<typeof ComprehensionQuestionSchema>;

export const ComprehensionQsSchema = z.object({
  questions: z.array(ComprehensionQuestionSchema).min(1).max(5),
});

export type ComprehensionQs = z.infer<typeof ComprehensionQsSchema>;

export function buildQuestionsMessages(passage: PassagePayload, level: Cefr): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        `You are an expert English language teacher writing comprehension questions for CEFR ${level} learners. ` +
        `Questions must be answerable directly from the passage text.`,
    },
    {
      role: "user",
      content:
        `Create 3 multiple-choice comprehension questions for this ${level} passage.\n\n` +
        `Title: ${passage.title}\n` +
        `Text: ${passage.body}\n\n` +
        `Return a JSON object with a "questions" array. Each item must have:\n` +
        `- question: question text\n` +
        `- options: array of exactly 4 answer strings\n` +
        `- answerIndex: 0–3 (index of the correct option)\n` +
        `- category: one of "main idea", "detail", "inference", "vocabulary"`,
    },
  ];
}
