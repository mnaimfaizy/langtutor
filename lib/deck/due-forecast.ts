/** Default forecast window — two weeks of review planning. */
export const FORECAST_DAYS = 14;

/** Minimal card shape for client-side forecast derivation. */
export interface DueForecastCard {
  dueIso: string;
  suspended?: boolean;
}

export interface DueForecastDay {
  /** 0 = today, 1 = tomorrow, … */
  dayOffset: number;
  /** Start of the calendar day (local timezone). */
  date: Date;
  count: number;
}

function startOfLocalDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dayOffsetFromNow(due: Date, now: Date): number {
  const today = startOfLocalDay(now);
  const dueDay = startOfLocalDay(due);
  const offset = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  return offset < 0 ? 0 : offset;
}

/**
 * Groups non-suspended cards by due calendar day over the next `days` days (inclusive of
 * today). Overdue cards count toward today (day 0).
 */
export function computeDueForecast(
  cards: DueForecastCard[],
  options: { days?: number; now?: Date } = {},
): DueForecastDay[] {
  const days = options.days ?? FORECAST_DAYS;
  const now = options.now ?? new Date();
  const today = startOfLocalDay(now);

  const buckets: DueForecastDay[] = Array.from({ length: days }, (_, dayOffset) => ({
    dayOffset,
    date: new Date(today.getTime() + dayOffset * 86_400_000),
    count: 0,
  }));

  for (const card of cards) {
    if (card.suspended) continue;
    const offset = dayOffsetFromNow(new Date(card.dueIso), now);
    if (offset >= days) continue;
    buckets[offset].count += 1;
  }

  return buckets;
}

/** Learner-facing label for a forecast day bucket. */
export function formatForecastDayLabel(date: Date, dayOffset: number, now = new Date()): string {
  if (dayOffset === 0) return "Today";
  if (dayOffset === 1) return "Tomorrow";
  const today = startOfLocalDay(now);
  const dueDay = startOfLocalDay(date);
  const withinWeek = dueDay.getTime() - today.getTime() < 7 * 86_400_000;
  return date.toLocaleDateString(undefined, {
    weekday: withinWeek ? "short" : undefined,
    month: "short",
    day: "numeric",
  });
}
