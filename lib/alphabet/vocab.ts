/**
 * Pre-A1 alphabet vocabulary (ADR 0016, issue #71). Letter → phonics anchor noun,
 * matching `scripts/build-illustration-pack.mjs` and the bundled illustration pack.
 */
export interface AlphabetEntry {
  /** Lowercase letter shown to the learner. */
  letter: string;
  /** Anchor noun whose approved illustration accompanies the letter. */
  pictureWord: string;
}

/** All 26 letters in order — the alphabet activity walks this list once. */
export const ALPHABET_ENTRIES: readonly AlphabetEntry[] = [
  { letter: "a", pictureWord: "apple" },
  { letter: "b", pictureWord: "ball" },
  { letter: "c", pictureWord: "cat" },
  { letter: "d", pictureWord: "dog" },
  { letter: "e", pictureWord: "egg" },
  { letter: "f", pictureWord: "fish" },
  { letter: "g", pictureWord: "goat" },
  { letter: "h", pictureWord: "hat" },
  { letter: "i", pictureWord: "ice" },
  { letter: "j", pictureWord: "jam" },
  { letter: "k", pictureWord: "kite" },
  { letter: "l", pictureWord: "lion" },
  { letter: "m", pictureWord: "moon" },
  { letter: "n", pictureWord: "nest" },
  { letter: "o", pictureWord: "orange" },
  { letter: "p", pictureWord: "pig" },
  { letter: "q", pictureWord: "queen" },
  { letter: "r", pictureWord: "rabbit" },
  { letter: "s", pictureWord: "sun" },
  { letter: "t", pictureWord: "tree" },
  { letter: "u", pictureWord: "umbrella" },
  { letter: "v", pictureWord: "van" },
  { letter: "w", pictureWord: "whale" },
  { letter: "x", pictureWord: "box" },
  { letter: "y", pictureWord: "yarn" },
  { letter: "z", pictureWord: "zebra" },
] as const;

export const ALPHABET_LENGTH = ALPHABET_ENTRIES.length;
