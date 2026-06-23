import type { PartOfSpeech, WordRelations, WordSense } from "./types";

/** Compact wire format stored in data/wordnet.json */
export interface RawSense {
  p: PartOfSpeech;
  d: string; // definition
  e: string[]; // examples
  s: string[]; // synonyms (other lemmas in the same synset)
  up: string[]; // hypernyms
  dn: string[]; // hyponyms
}

/** Shape of the generated data/wordnet.json */
export type WordnetData = Readonly<Record<string, readonly RawSense[]>>;

/** All senses of @word across all parts of speech. Returns [] if unknown. */
export function define(word: string, data: WordnetData): WordSense[] {
  const senses = data[word.toLowerCase()];
  if (!senses?.length) return [];
  return senses.map((s) => ({
    pos: s.p,
    definition: s.d,
    examples: s.e,
    synonyms: s.s,
    hypernyms: s.up,
    hyponyms: s.dn,
  }));
}

/** Union of synonyms / hypernyms / hyponyms across all senses of @word. */
export function relations(word: string, data: WordnetData): WordRelations {
  const senses = define(word, data);
  if (!senses.length) return { synonyms: [], hypernyms: [], hyponyms: [] };

  const synonyms = new Set<string>();
  const hypernyms = new Set<string>();
  const hyponyms = new Set<string>();
  for (const s of senses) {
    s.synonyms.forEach((w) => synonyms.add(w));
    s.hypernyms.forEach((w) => hypernyms.add(w));
    s.hyponyms.forEach((w) => hyponyms.add(w));
  }
  return {
    synonyms: [...synonyms],
    hypernyms: [...hypernyms],
    hyponyms: [...hyponyms],
  };
}
