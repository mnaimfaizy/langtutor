/**
 * Pure alphabet-activity session logic (issue #71). Sequencing and completion
 * detection only — media resolution and rendering live in the UI layer.
 */
import { ALPHABET_ENTRIES, ALPHABET_LENGTH, type AlphabetEntry } from "./vocab";

/** The entry at @index, or undefined when out of range. */
export function alphabetEntryAt(index: number): AlphabetEntry | undefined {
  return ALPHABET_ENTRIES[index];
}

/** Whether @index points at the final letter in the alphabet. */
export function isLastAlphabetIndex(index: number): boolean {
  return index === ALPHABET_LENGTH - 1;
}

/** Whether the learner can advance to another letter from @index. */
export function canAdvanceAlphabet(index: number): boolean {
  return index >= 0 && index < ALPHABET_LENGTH - 1;
}

/**
 * Next letter index after @index, or `null` when @index is the last letter (the
 * caller should treat that as the completion moment).
 */
export function nextAlphabetIndex(index: number): number | null {
  if (!canAdvanceAlphabet(index)) return null;
  return index + 1;
}

/** True when finishing from @index completes the whole alphabet walk-through. */
export function isAlphabetComplete(index: number): boolean {
  return index === ALPHABET_LENGTH - 1;
}

/** Clamps a resume index into the valid letter range. */
export function clampAlphabetIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(Math.floor(index), ALPHABET_LENGTH - 1));
}
