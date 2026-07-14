/**
 * Pure listen-and-tap session logic (issue #73). Choice/scoring and round
 * progression only — media resolution and rendering live in the UI layer.
 */
import {
  LISTEN_TAP_OPTION_WORDS,
  LISTEN_TAP_ROUNDS,
  type ListenTapRoundDef,
} from "./vocab";

export const LISTEN_TAP_CHOICE_COUNT = 4;

/** Optional vocab-driven rounds + distractor pool (shared-path densification). */
export type ListenTapSessionConfig = {
  rounds: readonly ListenTapRoundDef[];
  optionPool: readonly string[];
};

export const DEFAULT_LISTEN_TAP_CONFIG: ListenTapSessionConfig = {
  rounds: LISTEN_TAP_ROUNDS,
  optionPool: LISTEN_TAP_OPTION_WORDS,
};

function resolveConfig(config?: ListenTapSessionConfig): ListenTapSessionConfig {
  return config ?? DEFAULT_LISTEN_TAP_CONFIG;
}

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

/** Round count for the active config (bundled or vocab-driven). */
export function listenTapRoundCount(config?: ListenTapSessionConfig): number {
  return resolveConfig(config).rounds.length;
}

/** The round at @index, or undefined when out of range. */
export function listenTapRoundAt(
  index: number,
  config?: ListenTapSessionConfig,
): ListenTapRound | undefined {
  const def = resolveConfig(config).rounds[index];
  if (!def) return undefined;
  return { index, def };
}

/** Whether @choiceWord matches the target picture for round @roundIndex. */
export function scoreListenTapTap(
  choiceWord: string,
  roundIndex: number,
  config?: ListenTapSessionConfig,
): ListenTapTapResult {
  const round = listenTapRoundAt(roundIndex, config);
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
  config?: ListenTapSessionConfig,
): ListenTapChoice[] {
  const resolved = resolveConfig(config);
  const round = listenTapRoundAt(roundIndex, resolved);
  if (!round) return [];

  const pool = resolved.optionPool;
  const count = Math.max(2, Math.min(choiceCount, pool.length));
  const distractorWords = pickDistractorWords(
    round.def.targetWord,
    roundIndex,
    count - 1,
    pool,
  );
  const words = shuffleWords([round.def.targetWord, ...distractorWords], roundIndex);

  return words.map((word) => ({ word }));
}

/** Whether @index points at the final listen-and-tap round. */
export function isLastListenTapRound(index: number, config?: ListenTapSessionConfig): boolean {
  return index === listenTapRoundCount(config) - 1;
}

/** Next round index after @index, or `null` when @index is the last round. */
export function nextListenTapRoundIndex(
  index: number,
  config?: ListenTapSessionConfig,
): number | null {
  const last = listenTapRoundCount(config) - 1;
  if (index < 0 || index >= last) return null;
  return index + 1;
}

/** True when finishing from @index completes the whole listen-and-tap session. */
export function isListenTapComplete(index: number, config?: ListenTapSessionConfig): boolean {
  return index === listenTapRoundCount(config) - 1;
}

/** Clamps a resume index into the valid round range. */
export function clampListenTapRoundIndex(
  index: number,
  config?: ListenTapSessionConfig,
): number {
  if (!Number.isFinite(index)) return 0;
  const last = Math.max(0, listenTapRoundCount(config) - 1);
  return Math.max(0, Math.min(Math.floor(index), last));
}

function pickDistractorWords(
  targetWord: string,
  roundIndex: number,
  count: number,
  optionPool: readonly string[],
): string[] {
  const pool = optionPool.filter((w) => w !== targetWord);
  if (pool.length === 0) return [];
  const picked: string[] = [];
  let step = 5 + (roundIndex % 7);
  let guard = 0;
  while (picked.length < count && guard < pool.length * 4) {
    const idx = (roundIndex + step) % pool.length;
    const word = pool[idx]!;
    if (!picked.includes(word)) {
      picked.push(word);
    }
    step += 3;
    guard += 1;
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
