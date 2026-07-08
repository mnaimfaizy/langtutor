/**
 * Pure picture-match session logic (issue #74). Choice/scoring and round progression only —
 * media resolution and rendering live in the UI layer.
 */
import {
  PICTURE_MATCH_OPTION_WORDS,
  PICTURE_MATCH_ROUND_COUNT,
  PICTURE_MATCH_ROUNDS,
  type PictureMatchDirection,
  type PictureMatchRoundDef,
} from "./vocab";

export const PICTURE_MATCH_CHOICE_COUNT = 4;

/** One picture-match round. */
export interface PictureMatchRound {
  index: number;
  def: PictureMatchRoundDef;
}

/** A tap target — word label for picture→word, picture id for word→picture. */
export interface PictureMatchChoice {
  word: string;
}

export type PictureMatchTapResult = "correct" | "incorrect";

/** The round at @index, or undefined when out of range. */
export function pictureMatchRoundAt(index: number): PictureMatchRound | undefined {
  const def = PICTURE_MATCH_ROUNDS[index];
  if (!def) return undefined;
  return { index, def };
}

/** Direction for round @roundIndex. */
export function pictureMatchDirectionAt(roundIndex: number): PictureMatchDirection | undefined {
  return pictureMatchRoundAt(roundIndex)?.def.direction;
}

/** Audio key for a word→picture round; undefined for picture→word rounds. */
export function pictureMatchAudioKeyAt(roundIndex: number): string | undefined {
  const round = pictureMatchRoundAt(roundIndex);
  if (!round || round.def.direction !== "word-to-picture") return undefined;
  return round.def.audioKey ?? round.def.targetWord;
}

/** Whether @choiceWord matches the target for round @roundIndex. */
export function scorePictureMatchTap(
  choiceWord: string,
  roundIndex: number,
): PictureMatchTapResult {
  const round = pictureMatchRoundAt(roundIndex);
  if (!round) return "incorrect";
  return choiceWord === round.def.targetWord ? "correct" : "incorrect";
}

/**
 * Builds @choiceCount tap targets for @roundIndex, including the correct answer.
 * Order is deterministic per round so tests stay stable.
 */
export function buildPictureMatchChoices(
  roundIndex: number,
  choiceCount: number = PICTURE_MATCH_CHOICE_COUNT,
): PictureMatchChoice[] {
  const round = pictureMatchRoundAt(roundIndex);
  if (!round) return [];

  const count = Math.max(2, Math.min(choiceCount, PICTURE_MATCH_OPTION_WORDS.length));
  const distractorWords = pickDistractorWords(round.def.targetWord, roundIndex, count - 1);
  const words = shuffleWords([round.def.targetWord, ...distractorWords], roundIndex);

  return words.map((word) => ({ word }));
}

/** Whether @index points at the final picture-match round. */
export function isLastPictureMatchRound(index: number): boolean {
  return index === PICTURE_MATCH_ROUND_COUNT - 1;
}

/** Next round index after @index, or `null` when @index is the last round. */
export function nextPictureMatchRoundIndex(index: number): number | null {
  if (index < 0 || index >= PICTURE_MATCH_ROUND_COUNT - 1) return null;
  return index + 1;
}

/** True when finishing from @index completes the whole picture-match session. */
export function isPictureMatchComplete(index: number): boolean {
  return index === PICTURE_MATCH_ROUND_COUNT - 1;
}

/** Clamps a resume index into the valid round range. */
export function clampPictureMatchRoundIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(Math.floor(index), PICTURE_MATCH_ROUND_COUNT - 1));
}

function pickDistractorWords(targetWord: string, roundIndex: number, count: number): string[] {
  const pool = PICTURE_MATCH_OPTION_WORDS.filter((w) => w !== targetWord);
  const picked: string[] = [];
  let step = 3 + (roundIndex % 11);
  while (picked.length < count) {
    const idx = (roundIndex + step) % pool.length;
    const word = pool[idx]!;
    if (!picked.includes(word)) {
      picked.push(word);
    }
    step += 4;
  }
  return picked;
}

function shuffleWords(words: string[], seed: number): string[] {
  const out = words.slice();
  let state = seed + 17;
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
