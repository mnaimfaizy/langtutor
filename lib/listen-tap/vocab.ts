/**
 * Pre-A1 listen-and-tap round definitions (ADR 0016, issue #73). Each round plays
 * audio from the media store and asks the learner to tap a matching picture among
 * options — broader prompts than phonics' letter-only matching.
 */
export type ListenTapPromptKind = "animal" | "word" | "sentence";

export interface ListenTapRoundDef {
  promptKind: ListenTapPromptKind;
  /** Learner-facing instruction for this round. */
  prompt: string;
  /** Word or phrase passed to `/api/audio/resolve` (media-store key). */
  audioKey: string;
  /** Picture-word id of the correct tap target (illustration-pack noun). */
  targetWord: string;
}

/** Curated rounds mixing animal, word, and sentence-style prompts. */
export const LISTEN_TAP_ROUNDS: readonly ListenTapRoundDef[] = [
  {
    promptKind: "animal",
    prompt: "Which animal is this?",
    audioKey: "cat",
    targetWord: "cat",
  },
  {
    promptKind: "animal",
    prompt: "Which animal makes this sound?",
    audioKey: "dog",
    targetWord: "dog",
  },
  {
    promptKind: "animal",
    prompt: "Tap the animal you hear!",
    audioKey: "lion",
    targetWord: "lion",
  },
  {
    promptKind: "word",
    prompt: "Tap the picture for this word!",
    audioKey: "apple",
    targetWord: "apple",
  },
  {
    promptKind: "word",
    prompt: "Which picture matches this word?",
    audioKey: "ball",
    targetWord: "ball",
  },
  {
    promptKind: "sentence",
    prompt: "Listen to the sentence. Which picture fits?",
    audioKey: "I see a fish.",
    targetWord: "fish",
  },
  {
    promptKind: "animal",
    prompt: "Which animal is this?",
    audioKey: "rabbit",
    targetWord: "rabbit",
  },
  {
    promptKind: "word",
    prompt: "Tap the picture for this word!",
    audioKey: "tree",
    targetWord: "tree",
  },
  {
    promptKind: "sentence",
    prompt: "Listen! Which picture matches?",
    audioKey: "The sun is bright.",
    targetWord: "sun",
  },
  {
    promptKind: "animal",
    prompt: "Tap the animal you hear!",
    audioKey: "whale",
    targetWord: "whale",
  },
  {
    promptKind: "word",
    prompt: "Which picture matches this word?",
    audioKey: "hat",
    targetWord: "hat",
  },
  {
    promptKind: "sentence",
    prompt: "Listen to the sentence. Which picture fits?",
    audioKey: "I like my red kite.",
    targetWord: "kite",
  },
] as const;

export const LISTEN_TAP_ROUND_COUNT = LISTEN_TAP_ROUNDS.length;

/** All picture words that can appear as tap targets or distractors. */
export const LISTEN_TAP_OPTION_WORDS: readonly string[] = [
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
