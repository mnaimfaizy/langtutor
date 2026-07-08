export interface StreakUpdate {
  streakCount: number;
  lastActivityDate: string;
}

/**
 * Returns a YYYY-MM-DD string for `date` in the **local** calendar timezone.
 * Use this instead of `date.toISOString().slice(0,10)` to avoid the streak
 * recording the wrong day for users in UTC− timezones (e.g. a review at
 * 11 PM EST is midnight UTC, so UTC gives the next calendar day).
 */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local hour (0–23) after which the streak flame enters the at-risk state. */
export const STREAK_AT_RISK_HOUR = 18;

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

/**
 * True when the learner still has a continuable streak but has not recorded activity
 * today and local time is past {@link STREAK_AT_RISK_HOUR}.
 */
export function isStreakAtRisk(
  now: Date,
  lastActivityDate: string | null,
  streakCount: number,
): boolean {
  if (streakCount <= 0 || lastActivityDate === null) return false;

  const today = localDateString(now);
  if (lastActivityDate === today) return false;
  if (lastActivityDate !== dayBefore(today)) return false;

  return now.getHours() >= STREAK_AT_RISK_HOUR;
}
