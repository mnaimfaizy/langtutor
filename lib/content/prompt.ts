import { z } from "zod";

import type { Cefr } from "@/lib/db";
import type { ChatMessage } from "@/lib/llm/types";

export const PromptSchema = z.object({
  title: z.string().min(1).max(120),
  instruction: z.string().min(20).max(600),
  context: z.string().max(400).optional(),
});

export type PromptPayload = z.infer<typeof PromptSchema>;

export const WRITING_TOPICS = [
  "personal experience",
  "family and friends",
  "travel and places",
  "technology",
  "nature and environment",
  "health and lifestyle",
  "work and career",
  "education",
  "culture and society",
  "opinions and debates",
] as const;

export type WritingTopic = (typeof WRITING_TOPICS)[number];

const WORD_COUNT_GUIDE: Record<Cefr, string> = {
  A1: "30–50 words",
  A2: "50–80 words",
  B1: "80–120 words",
  B2: "120–180 words",
  C1: "180–250 words",
  C2: "250–350 words",
};

export function buildPromptMessages(topic: string, level: Cefr): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        `You are an expert English language teacher creating writing prompts for CEFR ${level} learners. ` +
        `The instruction itself must use vocabulary and grammar accessible to a ${level} learner so they can understand the task without difficulty.`,
    },
    {
      role: "user",
      content:
        `Create a writing prompt about "${topic}" for a CEFR ${level} learner.\n\n` +
        `Return a JSON object with these fields:\n` +
        `- title: a short title for the writing task (max 8 words)\n` +
        `- instruction: clear task instructions; guide the student to write ${WORD_COUNT_GUIDE[level]}\n` +
        `- context: a brief optional scenario or opening sentence to help the student begin (omit if not needed for ${level})`,
    },
  ];
}
