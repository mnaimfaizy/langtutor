import type { Achievement, GamificationState } from "@/lib/db";

import { checkNewAchievements } from "./achievements";
import { updateStreak } from "./streak";
import { earnXp, xpToLevel } from "./xp";

export interface ReviewSummary {
  cardCount: number;
  /** ISO calendar date string `YYYY-MM-DD` for the local day the review occurred. */
  today: string;
  /** Wall-clock instant of session end; used as `unlockedAt` for newly earned achievements. */
  now: Date;
}

export interface ApplyReviewResult {
  newState: GamificationState;
  xpEarned: number;
  newAchievements: Achievement[];
  leveledUp: boolean;
}

const INITIAL_STATE: GamificationState = {
  xp: 0,
  level: 1,
  streakCount: 0,
  lastActivityDate: null,
  achievements: [],
};

/**
 * Pure function: applies a completed review session to the current gamification state
 * and returns the updated state together with a diff (XP earned, new achievements, level-up flag).
 *
 * Pass `undefined` for `state` on the very first review (bootstraps from zero).
 */
export function applyReview(
  state: GamificationState | undefined,
  summary: ReviewSummary,
): ApplyReviewResult {
  const current = state ?? INITIAL_STATE;

  const xpEarned = earnXp(summary.cardCount);
  const newXp = current.xp + xpEarned;
  const prevLevel = current.level;
  const newLevel = xpToLevel(newXp);

  const streakUpdate = updateStreak(current.lastActivityDate, summary.today, current.streakCount);

  const partialState: GamificationState = {
    ...current,
    xp: newXp,
    level: newLevel,
    streakCount: streakUpdate.streakCount,
    lastActivityDate: streakUpdate.lastActivityDate,
  };

  const alreadyUnlocked = new Set(current.achievements.map((a) => a.id));
  const newAchievements = checkNewAchievements(partialState, alreadyUnlocked, summary.now);

  const newState: GamificationState = {
    ...partialState,
    achievements: [...current.achievements, ...newAchievements],
  };

  return { newState, xpEarned, newAchievements, leveledUp: newLevel > prevLevel };
}
