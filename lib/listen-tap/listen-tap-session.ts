/**
 * Pure listen-and-tap session logic (issue #73). Choice/scoring and round
 * progression only — media resolution and rendering live in the UI layer.
 */
import {
  LISTEN_TAP_OPTION_WORDS,
  LISTEN_TAP_ROUND_COUNT,
  LISTEN_TAP_ROUNDS,
  type ListenTapRoundDef,
} from "./vocab";

export const LISTEN_TAP_CHOICE_COUNT = 4;

/** One listen-and-tap round. */
export interface ListenTapRound {
  index: number;
  def: ListenTapRoundDef;
}

/** A picture shown as a tap target. */
export interface ListenTapChoice {
  word: string;
}

export type ListenTapTapResult = "correct" | "incorrect";

/** The round at @index, or undefined when out of range. */
export function listenTapRoundAt(index: number): ListenTapRound | undefined {
  const def = LISTEN_TAP_ROUNDS[index];
  if (!def) return undefined;
  return { index, def };
}

/** Whether @choiceWord matches the target picture for round @roundIndex. */
export function scoreListenTapTap(choiceWord: string, roundIndex: number): ListenTapTapResult {
  const round = listenTapRoundAt(roundIndex);
  if (!round) return "incorrect";
  return choiceWord === round.def.targetWord ? "correct" : "incorrect";
}

/**
 * Builds @choiceCount picture choices for @roundIndex, including the correct answer.
 * Order is deterministic per round so tests stay stable.
 */
export function buildListenTapChoices(
  roundIndex: number,
  choiceCount: number = LISTEN_TAP_CHOICE_COUNT,
): ListenTapChoice[] {
  const round = listenTapRoundAt(roundIndex);
  if (!round) return [];

  const count = Math.max(2, Math.min(choiceCount, LISTEN_TAP_OPTION_WORDS.length));
  const distractorWords = pickDistractorWords(round.def.targetWord, roundIndex, count - 1);
  const words = shuffleWords([round.def.targetWord, ...distractorWords], roundIndex);

  return words.map((word) => ({ word }));
}

/** Whether @index points at the final listen-and-tap round. */
export function isLastListenTapRound(index: number): boolean {
  return index === LISTEN_TAP_ROUND_COUNT - 1;
}

/** Next round index after @index, or `null` when @index is the last round. */
export function nextListenTapRoundIndex(index: number): number | null {
  if (index < 0 || index >= LISTEN_TAP_ROUND_COUNT - 1) return null;
  return index + 1;
}

/** True when finishing from @index completes the whole listen-and-tap session. */
export function isListenTapComplete(index: number): boolean {
  return index === LISTEN_TAP_ROUND_COUNT - 1;
}

/** Clamps a resume index into the valid round range. */
export function clampListenTapRoundIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(Math.floor(index), LISTEN_TAP_ROUND_COUNT - 1));
}

function pickDistractorWords(targetWord: string, roundIndex: number, count: number): string[] {
  const pool = LISTEN_TAP_OPTION_WORDS.filter((w) => w !== targetWord);
  const picked: string[] = [];
  let step = 5 + (roundIndex % 7);
  while (picked.length < count) {
    const idx = (roundIndex + step) % pool.length;
    const word = pool[idx]!;
    if (!picked.includes(word)) {
      picked.push(word);
    }
    step += 3;
  }
  return picked;
}

function shuffleWords(words: string[], seed: number): string[] {
  const out = words.slice();
  let state = seed + 11;
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
