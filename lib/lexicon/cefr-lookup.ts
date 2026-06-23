import type { Cefr } from "@/lib/db";
import type { CefrData, PartOfSpeech } from "./types";

/**
 * Estimated CEFR level for @word, or null if the word is not in the dataset.
 *
 * @param pos - Optional POS hint; reserved for future sense disambiguation.
 *              The initial dataset is POS-agnostic, so this parameter is ignored
 *              until Phase 1.3 wires a POS-aware source.
 */
export function cefrLevel(word: string, data: CefrData, _pos?: PartOfSpeech): Cefr | null {
  return data[word.toLowerCase()] ?? null;
}
