import type { Cefr } from "@/lib/db";

import { PSEUDOWORDS, WORDS_PER_LEVEL } from "./word-list";

export const CEFR_ORDER: readonly Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** Real words shown per CEFR level in a single batch. */
export const WORDS_PER_BATCH = 5;

/** Real-word hit rate required to advance to the next CEFR level. */
export const ADVANCE_THRESHOLD = 0.6;

/** Pseudoword false-positive rate above which the level estimate is penalised. */
export const PSEUDO_PENALTY_THRESHOLD = 0.3;

export interface QuizItem {
  word: string;
  /** CEFR level this word belongs to, or null for pseudowords. */
  level: Cefr | null;
  isPseudo: boolean;
}

export interface QuizAnswer extends QuizItem {
  known: boolean;
}

export interface QuizResult {
  estimatedLevel: Cefr;
  confidence: "high" | "medium" | "low";
  pseudoFalsePositiveRate: number;
}

/**
 * Build one quiz batch for a CEFR level: WORDS_PER_BATCH real words plus one
 * pseudoword inserted at a deterministic position that varies by level so the
 * pseudoword never appears in the same slot across consecutive batches.
 */
export function buildQuizBatch(level: Cefr): QuizItem[] {
  const levelIndex = CEFR_ORDER.indexOf(level);
  const words = WORDS_PER_LEVEL[level].slice(0, WORDS_PER_BATCH);
  const pseudo = PSEUDOWORDS[levelIndex % PSEUDOWORDS.length];

  const items: QuizItem[] = words.map((w) => ({ word: w, level, isPseudo: false }));
  const insertAt = (levelIndex + 2) % (WORDS_PER_BATCH + 1);
  items.splice(insertAt, 0, { word: pseudo, level: null, isPseudo: true });
  return items;
}

/**
 * Given all answers in a completed batch, decide whether the learner knows
 * enough to advance to the next CEFR level. Pseudoword answers are excluded.
 */
export function shouldAdvance(batchAnswers: QuizAnswer[]): boolean {
  const real = batchAnswers.filter((a) => !a.isPseudo);
  if (real.length === 0) return false;
  return real.filter((a) => a.known).length / real.length >= ADVANCE_THRESHOLD;
}

/**
 * Score the complete set of quiz answers and return an estimated CEFR level.
 *
 * Algorithm:
 * 1. Find the highest level where the real-word hit rate ≥ ADVANCE_THRESHOLD
 *    (defaults to A1 if none passes).
 * 2. If the pseudoword false-positive rate exceeds PSEUDO_PENALTY_THRESHOLD,
 *    drop the estimate by one level (minimum A1) — the learner over-claimed.
 * 3. Confidence reflects the pseudoword FPR: high < 10%, medium < 30%, low ≥ 30%.
 */
export function scoreQuiz(answers: QuizAnswer[]): QuizResult {
  const pseudoAnswers = answers.filter((a) => a.isPseudo);
  const pseudoFalsePositiveRate =
    pseudoAnswers.length > 0
      ? pseudoAnswers.filter((a) => a.known).length / pseudoAnswers.length
      : 0;

  let estimatedLevel: Cefr = "A1";
  for (const level of CEFR_ORDER) {
    const levelAnswers = answers.filter((a) => !a.isPseudo && a.level === level);
    if (levelAnswers.length === 0) continue;
    const hitRate = levelAnswers.filter((a) => a.known).length / levelAnswers.length;
    if (hitRate >= ADVANCE_THRESHOLD) estimatedLevel = level;
  }

  if (pseudoFalsePositiveRate > PSEUDO_PENALTY_THRESHOLD) {
    const idx = CEFR_ORDER.indexOf(estimatedLevel);
    if (idx > 0) estimatedLevel = CEFR_ORDER[idx - 1];
  }

  const confidence: "high" | "medium" | "low" =
    pseudoFalsePositiveRate < 0.1
      ? "high"
      : pseudoFalsePositiveRate < PSEUDO_PENALTY_THRESHOLD
        ? "medium"
        : "low";

  return { estimatedLevel, confidence, pseudoFalsePositiveRate };
}
