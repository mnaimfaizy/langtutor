/**
 * Pre-A1 picture-word matching round definitions (ADR 0016, issue #74). Each round is either
 * picture→word (see a picture, tap the matching word) or word→picture (hear a word, tap the
 * matching picture) — resolved from the media store (approved assets only).
 */
export type PictureMatchDirection = "picture-to-word" | "word-to-picture";

export interface PictureMatchRoundDef {
  direction: PictureMatchDirection;
  /** Learner-facing instruction for this round. */
  prompt: string;
  /** Picture-word id of the correct answer (illustration-pack noun). */
  targetWord: string;
  /** Word or phrase passed to `/api/audio/resolve` for word→picture rounds. */
  audioKey?: string;
}

/** Curated rounds alternating both matching directions. */
export const PICTURE_MATCH_ROUNDS: readonly PictureMatchRoundDef[] = [
  {
    direction: "picture-to-word",
    prompt: "Which word matches this picture?",
    targetWord: "cat",
  },
  {
    direction: "word-to-picture",
    prompt: "Tap the picture for this word!",
    targetWord: "dog",
    audioKey: "dog",
  },
  {
    direction: "picture-to-word",
    prompt: "What is this?",
    targetWord: "apple",
  },
  {
    direction: "word-to-picture",
    prompt: "Which picture matches this word?",
    targetWord: "ball",
    audioKey: "ball",
  },
  {
    direction: "picture-to-word",
    prompt: "Tap the word for this picture!",
    targetWord: "fish",
  },
  {
    direction: "word-to-picture",
    prompt: "Listen and tap the matching picture!",
    targetWord: "lion",
    audioKey: "lion",
  },
  {
    direction: "picture-to-word",
    prompt: "Which word matches this picture?",
    targetWord: "hat",
  },
  {
    direction: "word-to-picture",
    prompt: "Tap the picture you hear!",
    targetWord: "tree",
    audioKey: "tree",
  },
  {
    direction: "picture-to-word",
    prompt: "What is this?",
    targetWord: "sun",
  },
  {
    direction: "word-to-picture",
    prompt: "Which picture matches this word?",
    targetWord: "rabbit",
    audioKey: "rabbit",
  },
  {
    direction: "picture-to-word",
    prompt: "Tap the word for this picture!",
    targetWord: "kite",
  },
  {
    direction: "word-to-picture",
    prompt: "Listen and tap the matching picture!",
    targetWord: "whale",
    audioKey: "whale",
  },
] as const;

export const PICTURE_MATCH_ROUND_COUNT = PICTURE_MATCH_ROUNDS.length;

/** All picture words that can appear as targets or distractors. */
export const PICTURE_MATCH_OPTION_WORDS: readonly string[] = [
  "apple",
  "ball",
  "cat",
  "dog",
  "egg",
  "fish",
  "goat",
  "hat",
  "ice",
  "jam",
  "kite",
  "lion",
  "moon",
  "nest",
  "orange",
  "pig",
  "queen",
  "rabbit",
  "sun",
  "tree",
  "umbrella",
  "van",
  "whale",
  "box",
  "yarn",
  "zebra",
] as const;
