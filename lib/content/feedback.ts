import { z } from "zod";

import type { Cefr } from "@/lib/db";
import type { ChatMessage } from "@/lib/llm/types";

export const CorrectionSchema = z.object({
  original: z.string().min(1),
  corrected: z.string().min(1),
  category: z.string().min(1),
  explanation: z.string().min(1),
});

export const FeedbackSchema = z.object({
  overallScore: z.number().int().min(0).max(10),
  structuralGrade: z.string().min(1),
  corrections: z.array(CorrectionSchema),
});

export type FeedbackPayload = z.infer<typeof FeedbackSchema>;
export type Correction = z.infer<typeof CorrectionSchema>;

export function buildFeedbackMessages(draft: string, level: Cefr): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        `You are an expert English writing coach giving structured feedback to a CEFR ${level} learner. ` +
        `Focus on errors relevant to this level: A1–A2 (basic grammar, word order, simple tenses); ` +
        `B1–B2 (tense consistency, articles, prepositions, connectors); ` +
        `C1–C2 (register, cohesion, nuance, complex syntax). ` +
        `Be encouraging and pedagogically clear. Return JSON only.`,
    },
    {
      role: "user",
      content:
        `Review this writing from a CEFR ${level} learner and return structured feedback.\n\n` +
        `Text to review:\n"""\n${draft}\n"""\n\n` +
        `Return a JSON object with exactly these fields:\n` +
        `- overallScore: integer 0–10 (10 = flawless)\n` +
        `- structuralGrade: one of "Excellent", "Good", "Developing", or "Needs Work"\n` +
        `- corrections: array of objects (empty array if no errors), each with:\n` +
        `  - original: the exact phrase from the text that contains the error\n` +
        `  - corrected: the improved version\n` +
        `  - category: error type, e.g. "subject-verb agreement", "article usage", "adverb placement", "tense", "word choice"\n` +
        `  - explanation: a short clear explanation suitable for a ${level} learner`,
    },
  ];
}
