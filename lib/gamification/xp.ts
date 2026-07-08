/** XP awarded per card reviewed, regardless of rating. */
export const XP_PER_CARD = 10;

/**
 * XP required to reach each level (1-indexed: index 0 = level 1 at 0 XP).
 * Non-linear so later levels feel harder to reach.
 */
export const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000];

/** Maps a cumulative XP total to the current level (1-based). */
export function xpToLevel(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= (LEVEL_THRESHOLDS[i] as number)) level = i + 1;
    else break;
  }
  return level;
}

/** XP earned for reviewing `cardCount` cards. */
export function earnXp(cardCount: number): number {
  return cardCount * XP_PER_CARD;
}

/** Bounds for a level progress ring: XP span from current level floor to next threshold. */
export function xpLevelRingBounds(xp: number): { min: number; max: number } {
  const level = xpToLevel(xp);
  const min = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const next = LEVEL_THRESHOLDS[level];
  return { min, max: next ?? min + 1 };
}
