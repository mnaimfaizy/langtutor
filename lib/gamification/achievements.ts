import type { Achievement, GamificationState } from "@/lib/db";

export interface AchievementDef {
  id: string;
  label: string;
  description: string;
  check: (state: GamificationState) => boolean;
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: "first_review",
    label: "First steps",
    description: "Complete your first review session.",
    check: (s) => s.xp >= 10,
  },
  {
    id: "xp_50",
    label: "On a roll",
    description: "Earn 50 XP.",
    check: (s) => s.xp >= 50,
  },
  {
    id: "xp_200",
    label: "Getting serious",
    description: "Earn 200 XP.",
    check: (s) => s.xp >= 200,
  },
  {
    id: "streak_3",
    label: "3-day streak",
    description: "Review cards 3 days in a row.",
    check: (s) => s.streakCount >= 3,
  },
  {
    id: "streak_7",
    label: "Week warrior",
    description: "Review cards 7 days in a row.",
    check: (s) => s.streakCount >= 7,
  },
];

/**
 * Returns achievements newly earned by the given state that weren't already unlocked.
 * `now` is injectable so callers can control the `unlockedAt` timestamp deterministically.
 */
export function checkNewAchievements(
  state: GamificationState,
  alreadyUnlocked: Set<string>,
  now: Date,
): Achievement[] {
  return ACHIEVEMENT_DEFS.filter((def) => !alreadyUnlocked.has(def.id) && def.check(state)).map(
    (def) => ({ id: def.id, unlockedAt: now }),
  );
}
