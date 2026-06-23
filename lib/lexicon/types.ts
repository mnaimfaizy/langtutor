export type PartOfSpeech = "n" | "v" | "a" | "r";

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
