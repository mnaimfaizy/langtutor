import { localDateString } from "@/lib/gamification/streak";

/** Default window — three months of review consistency. */
export const ACTIVITY_HEATMAP_WEEKS = 12;

/** Minimal card shape for client-side activity derivation. */
export interface ReviewActivityCard {
  lastReviewIso?: string;
}

export interface ActivityHeatmapDay {
  /** Start of the local calendar day. */
  date: Date;
  /** 0 = leftmost week column in the grid. */
  weekIndex: number;
  /** 0 = Sunday … 6 = Saturday (local). */
  dayOfWeek: number;
  count: number;
  /** True when the day is after `now` (empty tail of the current week). */
  isFuture: boolean;
}

function startOfLocalDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function sundayOfWeek(d: Date): Date {
  const sunday = startOfLocalDay(d);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  return sunday;
}

/**
 * Buckets review activity into local calendar days over a fixed week grid (Sunday-start
 * columns). Each card's `lastReviewIso` counts once toward its review day.
 */
export function computeReviewActivityHeatmap(
  cards: ReviewActivityCard[],
  options: { weeks?: number; now?: Date } = {},
): ActivityHeatmapDay[] {
  const weeks = options.weeks ?? ACTIVITY_HEATMAP_WEEKS;
  const now = options.now ?? new Date();
  const today = startOfLocalDay(now);

  const currentWeekSunday = sundayOfWeek(today);
  const gridStart = new Date(currentWeekSunday);
  gridStart.setDate(gridStart.getDate() - (weeks - 1) * 7);

  const gridEnd = new Date(currentWeekSunday);
  gridEnd.setDate(gridEnd.getDate() + 6);

  const counts = new Map<string, number>();
  for (const card of cards) {
    if (!card.lastReviewIso) continue;
    const reviewDay = startOfLocalDay(new Date(card.lastReviewIso));
    if (reviewDay < gridStart || reviewDay > today) continue;
    const key = localDateString(reviewDay);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const days: ActivityHeatmapDay[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const key = localDateString(cursor);
    const weekIndex = Math.floor((cursor.getTime() - gridStart.getTime()) / (7 * 86_400_000));
    days.push({
      date: new Date(cursor),
      weekIndex,
      dayOfWeek: cursor.getDay(),
      count: counts.get(key) ?? 0,
      isFuture: cursor > today,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

/** Intensity bucket for heatmap cell styling (0 = none, 4 = highest). */
export function activityHeatmapTier(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (maxCount <= 1) return 4;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/** Tooltip / aria label for a heatmap cell. */
export function formatActivityDayLabel(date: Date, count: number, isFuture: boolean): string {
  if (isFuture) return "";
  const formatted = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (count === 0) return `${formatted}: no reviews`;
  return `${formatted}: ${count} review${count === 1 ? "" : "s"}`;
}
