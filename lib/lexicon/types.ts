export type PartOfSpeech = "n" | "v" | "a" | "r";

/** Shape of the generated data/words-cefr.json */
export type CefrData = Readonly<Record<string, import("@/lib/db").Cefr>>;

export interface WordSense {
  pos: PartOfSpeech;
  definition: string;
  examples: string[];
  synonyms: string[];
  hypernyms: string[];
  hyponyms: string[];
}

export interface WordRelations {
  synonyms: string[];
  hypernyms: string[];
  hyponyms: string[];
}
