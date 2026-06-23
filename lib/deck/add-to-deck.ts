import type { Cefr, NewCard } from "@/lib/db";
import { initCard } from "@/lib/srs";

export interface WordData {
  word: string;
  definition: string;
  examples: string[];
  cefr: Cefr;
  sense?: string;
}

/** Creates a NewCard from @data with FSRS state due immediately. */
export function buildNewCard(data: WordData, now = new Date()): NewCard {
  return {
    word: data.word.toLowerCase(),
    sense: data.sense,
    definition: data.definition,
    examples: data.examples,
    cefr: data.cefr,
    fsrs: initCard(now),
    createdAt: now,
  };
}

/** True if @word already exists in @existingWords (case-insensitive). */
export function isDuplicate(word: string, existingWords: string[]): boolean {
  const normalized = word.toLowerCase();
  return existingWords.some((w) => w.toLowerCase() === normalized);
}
