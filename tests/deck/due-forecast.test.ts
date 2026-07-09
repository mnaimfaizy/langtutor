import { describe, expect, it } from "vitest";

import { computeDueForecast, formatForecastDayLabel, FORECAST_DAYS } from "@/lib/deck/due-forecast";

/** Local noon — avoids timezone edge cases around midnight. */
const NOW = new Date(2025, 5, 1, 12, 0, 0);

function localIso(year: number, month: number, day: number, hour = 9): string {
  return new Date(year, month, day, hour, 0, 0).toISOString();
}

function card(dueIso: string, suspended = false) {
  return { dueIso, suspended };
}

describe("computeDueForecast", () => {
  it("returns zero counts for an empty deck", () => {
    const forecast = computeDueForecast([], { days: 7, now: NOW });
    expect(forecast).toHaveLength(7);
    expect(forecast.every((d) => d.count === 0)).toBe(true);
  });

  it("defaults to FORECAST_DAYS buckets", () => {
    expect(computeDueForecast([], { now: NOW })).toHaveLength(FORECAST_DAYS);
  });

  it("counts a card due today on day 0", () => {
    const dueToday = localIso(2025, 5, 1, 18);
    const forecast = computeDueForecast([card(dueToday)], { days: 3, now: NOW });
    expect(forecast[0].count).toBe(1);
    expect(forecast[1].count).toBe(0);
  });

  it("counts overdue cards on day 0 (today)", () => {
    const overdue = localIso(2025, 4, 28);
    const forecast = computeDueForecast([card(overdue)], { days: 3, now: NOW });
    expect(forecast[0].count).toBe(1);
  });

  it("counts a card due tomorrow on day 1", () => {
    const dueTomorrow = localIso(2025, 5, 2);
    const forecast = computeDueForecast([card(dueTomorrow)], { days: 3, now: NOW });
    expect(forecast[0].count).toBe(0);
    expect(forecast[1].count).toBe(1);
  });

  it("excludes suspended cards", () => {
    const dueToday = localIso(2025, 5, 1);
    const forecast = computeDueForecast([card(dueToday, true)], { days: 3, now: NOW });
    expect(forecast[0].count).toBe(0);
  });

  it("excludes cards due beyond the forecast window", () => {
    const farFuture = localIso(2025, 5, 20);
    const forecast = computeDueForecast([card(farFuture)], { days: 7, now: NOW });
    expect(forecast.reduce((sum, d) => sum + d.count, 0)).toBe(0);
  });

  it("groups multiple cards on the same day", () => {
    const dueTomorrow = localIso(2025, 5, 2);
    const forecast = computeDueForecast(
      [card(dueTomorrow), card(dueTomorrow), card(localIso(2025, 5, 1))],
      { days: 3, now: NOW },
    );
    expect(forecast[0].count).toBe(1);
    expect(forecast[1].count).toBe(2);
  });
});

describe("formatForecastDayLabel", () => {
  it('returns "Today" for day offset 0', () => {
    expect(formatForecastDayLabel(NOW, 0, NOW)).toBe("Today");
  });

  it('returns "Tomorrow" for day offset 1', () => {
    const tomorrow = new Date(2025, 5, 2, 0, 0, 0);
    expect(formatForecastDayLabel(tomorrow, 1, NOW)).toBe("Tomorrow");
  });
});
