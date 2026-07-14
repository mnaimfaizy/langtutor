/**
 * Pure picture-match session logic (issue #74). Choice/scoring and round progression only —
 * media resolution and rendering live in the UI layer.
 */
import {
  PICTURE_MATCH_OPTION_WORDS,
  PICTURE_MATCH_ROUNDS,
  type PictureMatchDirection,
  type PictureMatchRoundDef,
} from "./vocab";

export const PICTURE_MATCH_CHOICE_COUNT = 4;

/** Optional vocab-driven rounds + distractor pool (shared-path densification). */
export type PictureMatchSessionConfig = {
  rounds: readonly PictureMatchRoundDef[];
  optionPool: readonly string[];
};

export const DEFAULT_PICTURE_MATCH_CONFIG: PictureMatchSessionConfig = {
  rounds: PICTURE_MATCH_ROUNDS,
  optionPool: PICTURE_MATCH_OPTION_WORDS,
};

function resolveConfig(config?: PictureMatchSessionConfig): PictureMatchSessionConfig {
  return config ?? DEFAULT_PICTURE_MATCH_CONFIG;
}

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

/** Round count for the active config (bundled or vocab-driven). */
export function pictureMatchRoundCount(config?: PictureMatchSessionConfig): number {
  return resolveConfig(config).rounds.length;
}

/** The round at @index, or undefined when out of range. */
export function pictureMatchRoundAt(
  index: number,
  config?: PictureMatchSessionConfig,
): PictureMatchRound | undefined {
  const def = resolveConfig(config).rounds[index];
  if (!def) return undefined;
  return { index, def };
}

/** Direction for round @roundIndex. */
export function pictureMatchDirectionAt(
  roundIndex: number,
  config?: PictureMatchSessionConfig,
): PictureMatchDirection | undefined {
  return pictureMatchRoundAt(roundIndex, config)?.def.direction;
}

/** Audio key for a word→picture round; undefined for picture→word rounds. */
export function pictureMatchAudioKeyAt(
  roundIndex: number,
  config?: PictureMatchSessionConfig,
): string | undefined {
  const round = pictureMatchRoundAt(roundIndex, config);
  if (!round || round.def.direction !== "word-to-picture") return undefined;
  return round.def.audioKey ?? round.def.targetWord;
}

/** Whether @choiceWord matches the target for round @roundIndex. */
export function scorePictureMatchTap(
  choiceWord: string,
  roundIndex: number,
  config?: PictureMatchSessionConfig,
): PictureMatchTapResult {
  const round = pictureMatchRoundAt(roundIndex, config);
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
  config?: PictureMatchSessionConfig,
): PictureMatchChoice[] {
  const resolved = resolveConfig(config);
  const round = pictureMatchRoundAt(roundIndex, resolved);
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

/** Whether @index points at the final picture-match round. */
export function isLastPictureMatchRound(
  index: number,
  config?: PictureMatchSessionConfig,
): boolean {
  return index === pictureMatchRoundCount(config) - 1;
}

/** Next round index after @index, or `null` when @index is the last round. */
export function nextPictureMatchRoundIndex(
  index: number,
  config?: PictureMatchSessionConfig,
): number | null {
  const last = pictureMatchRoundCount(config) - 1;
  if (index < 0 || index >= last) return null;
  return index + 1;
}

/** True when finishing from @index completes the whole picture-match session. */
export function isPictureMatchComplete(
  index: number,
  config?: PictureMatchSessionConfig,
): boolean {
  return index === pictureMatchRoundCount(config) - 1;
}

/** Clamps a resume index into the valid round range. */
export function clampPictureMatchRoundIndex(
  index: number,
  config?: PictureMatchSessionConfig,
): number {
  if (!Number.isFinite(index)) return 0;
  const last = Math.max(0, pictureMatchRoundCount(config) - 1);
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
  let step = 3 + (roundIndex % 11);
  let guard = 0;
  while (picked.length < count && guard < pool.length * 4) {
    const idx = (roundIndex + step) % pool.length;
    const word = pool[idx]!;
    if (!picked.includes(word)) {
      picked.push(word);
    }
    step += 4;
    guard += 1;
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
