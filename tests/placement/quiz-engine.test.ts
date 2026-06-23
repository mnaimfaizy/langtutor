import { describe, expect, it } from "vitest";

import type { Cefr } from "@/lib/db";
import {
  ADVANCE_THRESHOLD,
  CEFR_ORDER,
  PSEUDO_PENALTY_THRESHOLD,
  WORDS_PER_BATCH,
  buildQuizBatch,
  scoreQuiz,
  shouldAdvance,
} from "@/lib/placement/quiz-engine";
import type { QuizAnswer } from "@/lib/placement/quiz-engine";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeRealAnswers(level: Cefr, known: boolean): QuizAnswer[] {
  return Array.from({ length: WORDS_PER_BATCH }, (_, i) => ({
    word: `word_${level}_${i}`,
    level,
    isPseudo: false,
    known,
  }));
}

// ─── buildQuizBatch ───────────────────────────────────────────────────────────

describe("buildQuizBatch", () => {
  it("returns WORDS_PER_BATCH real words + 1 pseudoword for every level", () => {
    for (const level of CEFR_ORDER) {
      const batch = buildQuizBatch(level);
      expect(batch.filter((i) => !i.isPseudo)).toHaveLength(WORDS_PER_BATCH);
      expect(batch.filter((i) => i.isPseudo)).toHaveLength(1);
    }
  });

  it("tags real words with their level", () => {
    buildQuizBatch("B1")
      .filter((i) => !i.isPseudo)
      .forEach((i) => expect(i.level).toBe("B1"));
  });

  it("tags pseudoword with null level", () => {
    const pseudo = buildQuizBatch("A1").find((i) => i.isPseudo);
    expect(pseudo?.level).toBeNull();
  });

  it("inserts the pseudoword at a different position for each level", () => {
    const positions = CEFR_ORDER.map((level) => buildQuizBatch(level).findIndex((i) => i.isPseudo));
    expect(new Set(positions).size).toBeGreaterThan(1);
  });
});

// ─── shouldAdvance ────────────────────────────────────────────────────────────

describe("shouldAdvance", () => {
  it(`advances when real-word hit rate equals the threshold (${ADVANCE_THRESHOLD * 100}%)`, () => {
    const knownCount = Math.ceil(WORDS_PER_BATCH * ADVANCE_THRESHOLD);
    const batch: QuizAnswer[] = Array.from({ length: WORDS_PER_BATCH }, (_, i) => ({
      word: `w${i}`,
      level: "A1" as Cefr,
      isPseudo: false,
      known: i < knownCount,
    }));
    expect(shouldAdvance(batch)).toBe(true);
  });

  it("does not advance when real-word hit rate is below threshold", () => {
    const knownCount = Math.ceil(WORDS_PER_BATCH * ADVANCE_THRESHOLD) - 1;
    const batch: QuizAnswer[] = Array.from({ length: WORDS_PER_BATCH }, (_, i) => ({
      word: `w${i}`,
      level: "A2" as Cefr,
      isPseudo: false,
      known: i < knownCount,
    }));
    expect(shouldAdvance(batch)).toBe(false);
  });

  it("ignores pseudoword answers when deciding to advance", () => {
    const real = makeRealAnswers("A1", true); // 5/5 known → should advance
    const pseudo: QuizAnswer = { word: "flurment", level: null, isPseudo: true, known: false };
    expect(shouldAdvance([...real, pseudo])).toBe(true);
  });
});

// ─── scoreQuiz ────────────────────────────────────────────────────────────────

describe("scoreQuiz", () => {
  it("returns A1 as minimum level when everything is unknown", () => {
    expect(scoreQuiz(makeRealAnswers("A1", false)).estimatedLevel).toBe("A1");
  });

  it("returns the highest level whose hit rate meets the threshold", () => {
    const answers: QuizAnswer[] = [
      ...makeRealAnswers("A1", true),
      ...makeRealAnswers("A2", true),
      ...makeRealAnswers("B1", true),
      ...makeRealAnswers("B2", false),
    ];
    expect(scoreQuiz(answers).estimatedLevel).toBe("B1");
  });

  it("returns C2 when all levels pass", () => {
    const answers = CEFR_ORDER.flatMap((l) => makeRealAnswers(l, true));
    expect(scoreQuiz(answers).estimatedLevel).toBe("C2");
  });

  it(`drops estimate by one level when pseudoword FPR exceeds ${PSEUDO_PENALTY_THRESHOLD}`, () => {
    const answers: QuizAnswer[] = [
      ...makeRealAnswers("A1", true),
      ...makeRealAnswers("A2", true),
      ...makeRealAnswers("B1", true), // would give B1 without penalty
      { word: "flurment", level: null, isPseudo: true, known: true },
      { word: "brantive", level: null, isPseudo: true, known: true },
      { word: "yortive", level: null, isPseudo: true, known: false },
    ];
    const result = scoreQuiz(answers);
    expect(result.estimatedLevel).toBe("A2"); // dropped from B1
    expect(result.pseudoFalsePositiveRate).toBeCloseTo(2 / 3, 5);
    expect(result.confidence).toBe("low");
  });

  it("never drops below A1 even with maximum pseudoword FPR", () => {
    const answers: QuizAnswer[] = [
      ...makeRealAnswers("A1", false),
      { word: "flurment", level: null, isPseudo: true, known: true },
      { word: "brantive", level: null, isPseudo: true, known: true },
    ];
    expect(scoreQuiz(answers).estimatedLevel).toBe("A1");
  });

  it("reports high confidence when no pseudowords are claimed", () => {
    const answers: QuizAnswer[] = [
      ...makeRealAnswers("B1", true),
      { word: "flurment", level: null, isPseudo: true, known: false },
    ];
    expect(scoreQuiz(answers).confidence).toBe("high");
  });

  it("reports medium confidence when pseudoword FPR is between 0.1 and the penalty threshold", () => {
    // 1 out of 6 pseudowords claimed → FPR ≈ 0.167 (above 0.1, below 0.3)
    const answers: QuizAnswer[] = [
      ...makeRealAnswers("B1", true),
      ...Array.from({ length: 6 }, (_, i) => ({
        word: `p${i}`,
        level: null as Cefr | null,
        isPseudo: true,
        known: i === 0,
      })),
    ];
    expect(scoreQuiz(answers).confidence).toBe("medium");
  });
});
