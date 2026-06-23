import type { Cefr } from "@/lib/db";

/** Representative words per CEFR level used in the placement quiz. */
export const WORDS_PER_LEVEL: Record<Cefr, readonly string[]> = {
  A1: ["house", "book", "food", "walk", "small", "happy", "door", "water"],
  A2: ["travel", "weather", "usually", "station", "prepare", "receive", "describe", "celebrate"],
  B1: [
    "meanwhile",
    "consequence",
    "negotiate",
    "efficient",
    "approximately",
    "maintain",
    "despite",
    "interpret",
  ],
  B2: [
    "albeit",
    "scrutiny",
    "rhetoric",
    "pragmatic",
    "subsequent",
    "forthcoming",
    "elaborate",
    "deduce",
  ],
  C1: [
    "exacerbate",
    "corroborate",
    "ameliorate",
    "ubiquitous",
    "ostensible",
    "elicit",
    "predisposed",
    "inherent",
  ],
  C2: [
    "perspicacious",
    "mellifluous",
    "loquacious",
    "insouciant",
    "laconic",
    "recondite",
    "tendentious",
    "pellucid",
  ],
};

/** Plausible-sounding but non-existent English words used to detect over-claiming. */
export const PSEUDOWORDS: readonly string[] = [
  "flurment",
  "brantive",
  "yortive",
  "glorpal",
  "trondulate",
  "skivvance",
];
