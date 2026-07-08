/**
 * Pure phonics-activity session logic (issue #72). Choice/scoring and round
 * progression only — media resolution and rendering live in the UI layer.
 */
import { ALPHABET_ENTRIES, ALPHABET_LENGTH, type AlphabetEntry } from "@/lib/alphabet/vocab";

export const PHONICS_CHOICE_COUNT = 4;

/** One sound-to-letter matching round. */
export interface PhonicsRound {
  index: number;
  target: AlphabetEntry;
}

/** A letter shown as a tap target. */
export interface PhonicsChoice {
  letter: string;
}

export type PhonicsTapResult = "correct" | "incorrect";

/** The round at @index, or undefined when out of range. */
export function phonicsRoundAt(index: number): PhonicsRound | undefined {
  const target = ALPHABET_ENTRIES[index];
  if (!target) return undefined;
  return { index, target };
}

/** Whether @choiceLetter matches the target letter for round @roundIndex. */
export function scorePhonicsTap(choiceLetter: string, roundIndex: number): PhonicsTapResult {
  const round = phonicsRoundAt(roundIndex);
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
): PhonicsChoice[] {
  const round = phonicsRoundAt(roundIndex);
  if (!round) return [];

  const count = Math.max(2, Math.min(choiceCount, ALPHABET_LENGTH));
  const distractorIndices = pickDistractorIndices(roundIndex, count - 1);
  const indices = shuffleIndices([roundIndex, ...distractorIndices], roundIndex);

  return indices.map((i) => ({ letter: ALPHABET_ENTRIES[i]!.letter }));
}

/** Whether @index points at the final phonics round. */
export function isLastPhonicsRound(index: number): boolean {
  return index === ALPHABET_LENGTH - 1;
}

/** Next round index after @index, or `null` when @index is the last round. */
export function nextPhonicsRoundIndex(index: number): number | null {
  if (index < 0 || index >= ALPHABET_LENGTH - 1) return null;
  return index + 1;
}

/** True when finishing from @index completes the whole phonics session. */
export function isPhonicsComplete(index: number): boolean {
  return index === ALPHABET_LENGTH - 1;
}

/** Clamps a resume index into the valid round range. */
export function clampPhonicsRoundIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(Math.floor(index), ALPHABET_LENGTH - 1));
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
