/**
 * Pure phonics-activity session logic (issue #72). Choice/scoring and round
 * progression only — media resolution and rendering live in the UI layer.
 */
import { ALPHABET_ENTRIES, ALPHABET_LENGTH, type AlphabetEntry } from "@/lib/alphabet/vocab";

export const PHONICS_CHOICE_COUNT = 4;

/** One densified phonics round anchored on a vocab word (initial-sound practice). */
export type PhonicsWordRoundDef = {
  word: string;
  alphabetIndex: number;
};

/**
 * Optional densification config:
 * - `wordRounds` → one round per vocab word (picture + word audio + first letter)
 * - `letterIndices` → letter-only densification (no word anchors)
 * - omitted → full A–Z runway
 */
export type PhonicsSessionConfig = {
  letterIndices?: readonly number[];
  wordRounds?: readonly PhonicsWordRoundDef[];
};

type ResolvedPhonicsSlot = {
  alphabetIndex: number;
  anchorWord?: string;
};

function resolveSlots(config?: PhonicsSessionConfig): readonly ResolvedPhonicsSlot[] {
  if (config?.wordRounds && config.wordRounds.length > 0) {
    return config.wordRounds.map((r) => ({
      alphabetIndex: r.alphabetIndex,
      anchorWord: r.word,
    }));
  }
  if (config?.letterIndices && config.letterIndices.length > 0) {
    return config.letterIndices.map((alphabetIndex) => ({ alphabetIndex }));
  }
  return Array.from({ length: ALPHABET_LENGTH }, (_, alphabetIndex) => ({ alphabetIndex }));
}

/** One sound-to-letter matching round. */
export interface PhonicsRound {
  index: number;
  /** Alphabet entry index used for the target letter. */
  alphabetIndex: number;
  target: AlphabetEntry;
  /**
   * When set, UI shows this word's picture and plays word audio — initial-sound
   * practice for densified phonics units (not bare A–Z letter phonemes).
   */
  anchorWord?: string;
}

/** A letter shown as a tap target. */
export interface PhonicsChoice {
  letter: string;
}

export type PhonicsTapResult = "correct" | "incorrect";

export function phonicsRoundCount(config?: PhonicsSessionConfig): number {
  return resolveSlots(config).length;
}

/** The round at @index, or undefined when out of range. */
export function phonicsRoundAt(
  index: number,
  config?: PhonicsSessionConfig,
): PhonicsRound | undefined {
  const slots = resolveSlots(config);
  const slot = slots[index];
  if (!slot) return undefined;
  const target = ALPHABET_ENTRIES[slot.alphabetIndex];
  if (!target) return undefined;
  return {
    index,
    alphabetIndex: slot.alphabetIndex,
    target,
    ...(slot.anchorWord ? { anchorWord: slot.anchorWord } : {}),
  };
}

/** Whether @choiceLetter matches the target letter for round @roundIndex. */
export function scorePhonicsTap(
  choiceLetter: string,
  roundIndex: number,
  config?: PhonicsSessionConfig,
): PhonicsTapResult {
  const round = phonicsRoundAt(roundIndex, config);
  if (!round) return "incorrect";
  return choiceLetter.toLowerCase() === round.target.letter ? "correct" : "incorrect";
}

/**
 * Builds @choiceCount letter choices for @roundIndex, including the correct answer.
 * Order is deterministic per round so tests stay stable.
 */
export function buildPhonicsChoices(
  roundIndex: number,
  choiceCount: number = PHONICS_CHOICE_COUNT,
  config?: PhonicsSessionConfig,
): PhonicsChoice[] {
  const round = phonicsRoundAt(roundIndex, config);
  if (!round) return [];

  const count = Math.max(2, Math.min(choiceCount, ALPHABET_LENGTH));
  const distractorIndices = pickDistractorIndices(round.alphabetIndex, count - 1);
  const indices = shuffleIndices([round.alphabetIndex, ...distractorIndices], roundIndex);

  return indices.map((i) => ({ letter: ALPHABET_ENTRIES[i]!.letter }));
}

/** Whether @index points at the final phonics round. */
export function isLastPhonicsRound(index: number, config?: PhonicsSessionConfig): boolean {
  return index === phonicsRoundCount(config) - 1;
}

/** Next round index after @index, or `null` when @index is the last round. */
export function nextPhonicsRoundIndex(
  index: number,
  config?: PhonicsSessionConfig,
): number | null {
  const last = phonicsRoundCount(config) - 1;
  if (index < 0 || index >= last) return null;
  return index + 1;
}

/** True when finishing from @index completes the whole phonics session. */
export function isPhonicsComplete(index: number, config?: PhonicsSessionConfig): boolean {
  return index === phonicsRoundCount(config) - 1;
}

/** Clamps a resume index into the valid round range. */
export function clampPhonicsRoundIndex(index: number, config?: PhonicsSessionConfig): number {
  if (!Number.isFinite(index)) return 0;
  const last = Math.max(0, phonicsRoundCount(config) - 1);
  return Math.max(0, Math.min(Math.floor(index), last));
}

function pickDistractorIndices(targetIndex: number, count: number): number[] {
  const picked: number[] = [];
  let step = 7;
  while (picked.length < count) {
    const idx = (targetIndex + step) % ALPHABET_LENGTH;
    if (idx !== targetIndex && !picked.includes(idx)) {
      picked.push(idx);
    }
    step += 5;
  }
  return picked;
}

function shuffleIndices(indices: number[], seed: number): number[] {
  const out = indices.slice();
  let state = seed + 1;
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
