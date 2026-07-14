/**
 * Build pre-A1 activity rounds from unit / shared-catalog `targetVocab`.
 * Empty vocab → callers keep the bundled hardcoded rounds.
 */
import { ALPHABET_ENTRIES } from "@/lib/alphabet/vocab";
import type { ListenTapRoundDef } from "@/lib/listen-tap/vocab";
import { LISTEN_TAP_OPTION_WORDS } from "@/lib/listen-tap/vocab";
import type { PictureMatchRoundDef } from "@/lib/picture-match/vocab";
import { PICTURE_MATCH_OPTION_WORDS } from "@/lib/picture-match/vocab";

import { normalizeSharedPathTargetVocab } from "./shared-path-media-readiness";

/** Merge unit vocab with the bundled option pool so small drafts still have distractors. */
export function optionPoolForTargetVocab(
  words: readonly string[],
  builtinPool: readonly string[],
): string[] {
  const normalized = normalizeSharedPathTargetVocab(words);
  const seen = new Set(normalized);
  const extras = builtinPool.filter((w) => {
    const n = w.toLowerCase().trim();
    if (!n || seen.has(n)) return false;
    seen.add(n);
    return true;
  });
  return [...normalized, ...extras];
}

/** One picture-match round per vocab word, alternating directions. */
export function buildPictureMatchRoundsFromVocab(
  words: readonly string[],
): PictureMatchRoundDef[] {
  const normalized = normalizeSharedPathTargetVocab(words);
  return normalized.map((targetWord, i) => {
    const wordToPicture = i % 2 === 1;
    if (wordToPicture) {
      return {
        direction: "word-to-picture" as const,
        prompt: "Tap the picture for this word!",
        targetWord,
        audioKey: targetWord,
      };
    }
    return {
      direction: "picture-to-word" as const,
      prompt: "Which word matches this picture?",
      targetWord,
    };
  });
}

/** One listen-and-tap round per vocab word (word prompts). */
export function buildListenTapRoundsFromVocab(words: readonly string[]): ListenTapRoundDef[] {
  const normalized = normalizeSharedPathTargetVocab(words);
  return normalized.map((targetWord) => ({
    promptKind: "word" as const,
    prompt: "Tap the picture for this word!",
    audioKey: targetWord,
    targetWord,
  }));
}

export type PictureMatchVocabSession = {
  rounds: PictureMatchRoundDef[];
  optionPool: string[];
};

export type ListenTapVocabSession = {
  rounds: ListenTapRoundDef[];
  optionPool: string[];
};

export function buildPictureMatchVocabSession(
  words: readonly string[],
): PictureMatchVocabSession | null {
  const rounds = buildPictureMatchRoundsFromVocab(words);
  if (rounds.length === 0) return null;
  return {
    rounds,
    optionPool: optionPoolForTargetVocab(words, PICTURE_MATCH_OPTION_WORDS),
  };
}

export function buildListenTapVocabSession(words: readonly string[]): ListenTapVocabSession | null {
  const rounds = buildListenTapRoundsFromVocab(words);
  if (rounds.length === 0) return null;
  return {
    rounds,
    optionPool: optionPoolForTargetVocab(words, LISTEN_TAP_OPTION_WORDS),
  };
}

/**
 * Alphabet indices for phonics densification: first letter of each vocab word that
 * maps onto {@link ALPHABET_ENTRIES}. Empty → caller keeps the full A–Z runway.
 *
 * @deprecated Prefer {@link phonicsWordRoundsFromVocab} — letter-only densification
 * drops the drafted words' images/audio. Kept for tests/callers that only need indices.
 */
export function phonicsLetterIndicesFromVocab(words: readonly string[]): number[] {
  return phonicsWordRoundsFromVocab(words).map((r) => r.alphabetIndex);
}

/**
 * One phonics round per vocab word: practice the word's initial letter while
 * anchoring on that word's picture + audio (not bare A–Z letter cards).
 */
export function phonicsWordRoundsFromVocab(
  words: readonly string[],
): { word: string; alphabetIndex: number }[] {
  const normalized = normalizeSharedPathTargetVocab(words);
  const rounds: { word: string; alphabetIndex: number }[] = [];
  for (const word of normalized) {
    const letter = word.charAt(0);
    const alphabetIndex = ALPHABET_ENTRIES.findIndex((e) => e.letter === letter);
    if (alphabetIndex < 0) continue;
    rounds.push({ word, alphabetIndex });
  }
  return rounds;
}

export function buildPhonicsVocabSession(
  words: readonly string[],
): { wordRounds: { word: string; alphabetIndex: number }[] } | null {
  const wordRounds = phonicsWordRoundsFromVocab(words);
  if (wordRounds.length === 0) return null;
  return { wordRounds };
}
