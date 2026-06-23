import type { Cefr } from "@/lib/db";
import type { PartOfSpeech, WordRelations, WordSense } from "./types";

/**
 * Lexicon seam (PLAN §2.3). Feature code imports this interface; the concrete
 * {@link LocalLexiconProvider} is wired in `lib/lexicon/server.ts` and used only
 * from server contexts (API routes / RSC). Client-side access goes through API
 * routes — never imports the concrete or the server module directly.
 */
export interface LexiconProvider {
  /** All WordNet senses for @word across parts of speech. Empty if unknown. */
  define(word: string): Promise<WordSense[]>;
  /** Union of synonyms / hypernyms / hyponyms across all senses. */
  relations(word: string): Promise<WordRelations>;
  /** Estimated CEFR level, or null if unknown. POS hint reserved for future disambiguation. */
  cefrLevel(word: string, pos?: PartOfSpeech): Promise<Cefr | null>;
  /**
   * Pronunciation audio URL for @word.
   * Offline-first: lexiconCache → Free Dictionary API → cache result → return.
   * Returns null when neither cache nor network has audio.
   */
  audio(word: string): Promise<string | null>;
}
