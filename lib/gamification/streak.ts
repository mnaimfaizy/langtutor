export interface StreakUpdate {
  streakCount: number;
  lastActivityDate: string;
}

/** Returns the ISO date string for the day before `date` (YYYY-MM-DD). */
function dayBefore(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Computes the new streak state given the last recorded activity date and today's date.
 *
 * Rules:
 * - First ever activity → streak = 1
 * - Same day as last activity → no change (prevents double-counting within a day)
 * - Yesterday was the last activity → streak + 1
 * - Gap of 2+ days → streak resets to 1
 */
export function updateStreak(
  lastActivityDate: string | null,
  today: string,
  currentStreak: number,
): StreakUpdate {
  if (lastActivityDate === null) {
    return { streakCount: 1, lastActivityDate: today };
  }
  if (lastActivityDate === today) {
    return { streakCount: currentStreak, lastActivityDate: today };
  }
  if (dayBefore(today) === lastActivityDate) {
    return { streakCount: currentStreak + 1, lastActivityDate: today };
  }
  return { streakCount: 1, lastActivityDate: today };
}
