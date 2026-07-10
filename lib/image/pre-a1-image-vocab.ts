import { ALPHABET_ENTRIES } from "@/lib/alphabet/vocab";
import { LISTEN_TAP_OPTION_WORDS } from "@/lib/listen-tap/vocab";
import { PICTURE_MATCH_OPTION_WORDS } from "@/lib/picture-match/vocab";

/**
 * Known pre-A1 picture-word vocabulary for the curriculum gap helper (ADR 0026).
 * Union of alphabet anchors, picture-match options, and listen-tap options —
 * sorted, unique, lowercase. Pure data; no store I/O.
 */
export function listPreA1ImageVocabulary(): readonly string[] {
  const words = new Set<string>();
  for (const entry of ALPHABET_ENTRIES) {
    words.add(entry.pictureWord.toLowerCase().trim());
  }
  for (const word of PICTURE_MATCH_OPTION_WORDS) {
    words.add(word.toLowerCase().trim());
  }
  for (const word of LISTEN_TAP_OPTION_WORDS) {
    words.add(word.toLowerCase().trim());
  }
  return [...words].sort((a, b) => a.localeCompare(b));
}
