import { z } from "zod";

import type { Cefr } from "@/lib/db";
import type { ChatMessage } from "@/lib/llm/types";

export const PassageSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(50),
});

export type PassagePayload = z.infer<typeof PassageSchema>;

export const READING_TOPICS = [
  "daily routine",
  "travel",
  "food and cooking",
  "technology",
  "nature and animals",
  "health and exercise",
  "work and career",
  "hobbies",
  "city life",
  "environment",
] as const;

export type ReadingTopic = (typeof READING_TOPICS)[number];

export function buildPassageMessages(topic: string, level: Cefr): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        `You are an expert English language teacher writing reading passages for CEFR ${level} learners. ` +
        `Use only vocabulary and grammar appropriate for ${level}. ` +
        `Write natural, engaging prose that a real ${level} reader would find both accessible and interesting.`,
    },
    {
      role: "user",
      content:
        `Write a short English reading passage about "${topic}" for a CEFR ${level} learner.\n\n` +
        `Return a JSON object with exactly two fields:\n` +
        `- title: a short, engaging title (max 10 words)\n` +
        `- body: the passage text (80–180 words, strictly appropriate for ${level})`,
    },
  ];
}
