"use client";

import Link from "next/link";
import { useMemo } from "react";

import { computeDueForecast, formatForecastDayLabel, FORECAST_DAYS } from "@/lib/deck/due-forecast";
import {
  activityHeatmapTier,
  ACTIVITY_HEATMAP_WEEKS,
  computeReviewActivityHeatmap,
  formatActivityDayLabel,
} from "@/lib/deck/review-activity-heatmap";
import { BackLink, Card, cn } from "@/ui";

import type { StatsCardItem } from "./stats-loader";

export function StatsClient({ initialCards }: { initialCards: StatsCardItem[] }) {
  const now = useMemo(() => new Date(), []);
  const forecast = useMemo(
    () => computeDueForecast(initialCards, { days: FORECAST_DAYS, now }),
    [initialCards, now],
  );

  const maxCount = useMemo(() => Math.max(1, ...forecast.map((d) => d.count)), [forecast]);
  const totalDue = useMemo(() => forecast.reduce((sum, d) => sum + d.count, 0), [forecast]);

  const heatmapDays = useMemo(
    () => computeReviewActivityHeatmap(initialCards, { weeks: ACTIVITY_HEATMAP_WEEKS, now }),
    [initialCards, now],
  );
  const heatmapWeeks = useMemo(() => {
    const weeks: (typeof heatmapDays)[] = [];
    for (const day of heatmapDays) {
      if (!weeks[day.weekIndex]) weeks[day.weekIndex] = [];
      weeks[day.weekIndex].push(day);
    }
    return weeks;
  }, [heatmapDays]);
  const maxActivity = useMemo(
    () => Math.max(1, ...heatmapDays.filter((d) => !d.isFuture).map((d) => d.count)),
    [heatmapDays],
  );
  const totalReviews = useMemo(
    () => heatmapDays.filter((d) => !d.isFuture).reduce((sum, d) => sum + d.count, 0),
    [heatmapDays],
  );

  const TIER_STYLE: Record<ReturnType<typeof activityHeatmapTier>, string> = {
    0: "border-border border opacity-30",
    1: "bg-success/20 border-success/30 border",
    2: "bg-success/35 border-success/40 border",
    3: "bg-success/50 border-success/50 border",
    4: "bg-success/70 border-success/60 border",
  };

  return (
    <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <section>
          <BackLink href="/deck" label="Deck" className="mb-4" />
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Deck stats</h1>
          <p className="text-muted mt-1 text-sm leading-6">
            Plan review time with a forecast of cards coming due over the next {FORECAST_DAYS} days.
          </p>
        </section>

        <section data-testid="deck-stats-forecast">
          <Card className="space-y-5 p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-foreground text-sm font-medium">Due forecast</h2>
                <p className="text-muted mt-0.5 text-xs">
                  {totalDue === 0
                    ? "No reviews scheduled in this window."
                    : `${totalDue} card${totalDue === 1 ? "" : "s"} due in the next ${FORECAST_DAYS} days`}
                </p>
              </div>
              <Link
                href="/review"
                data-testid="link-start-review"
                className="text-accent text-xs font-medium underline underline-offset-4"
              >
                Start review
              </Link>
            </div>

            {initialCards.length === 0 ? (
              <p className="text-muted text-sm" data-testid="deck-stats-empty">
                No words in your deck yet.{" "}
                <Link href="/deck" className="text-accent underline underline-offset-4">
                  Add words
                </Link>{" "}
                to see your forecast.
              </p>
            ) : (
              <ul className="space-y-2" aria-label="Due forecast by day">
                {forecast.map((day) => {
                  const barWidth = day.count === 0 ? 0 : Math.max(8, (day.count / maxCount) * 100);
                  return (
                    <li
                      key={day.dayOffset}
                      className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-3"
                    >
                      <span className="text-muted text-xs tabular-nums">
                        {formatForecastDayLabel(day.date, day.dayOffset, now)}
                      </span>
                      <div className="bg-muted/30 h-6 overflow-hidden rounded-md">
                        <div
                          className={cn(
                            "bg-accent h-full rounded-md transition-[width]",
                            day.count === 0 && "opacity-0",
                          )}
                          style={{ width: `${barWidth}%` }}
                          role="presentation"
                        />
                      </div>
                      <span
                        className="text-foreground text-right text-xs font-medium tabular-nums"
                        data-testid={`forecast-count-day-${day.dayOffset}`}
                      >
                        {day.count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        <section data-testid="deck-stats-heatmap">
          <Card className="space-y-5 p-4 sm:p-5">
            <div>
              <h2 className="text-foreground text-sm font-medium">Review activity</h2>
              <p className="text-muted mt-0.5 text-xs">
                {totalReviews === 0
                  ? `No reviews in the last ${ACTIVITY_HEATMAP_WEEKS} weeks.`
                  : `${totalReviews} card review${totalReviews === 1 ? "" : "s"} over the last ${ACTIVITY_HEATMAP_WEEKS} weeks`}
              </p>
            </div>

            {initialCards.length === 0 ? (
              <p className="text-muted text-sm">
                Add words and complete reviews to build your activity history.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <div
                    className="inline-flex gap-1"
                    role="img"
                    aria-label={`Review activity heatmap for the last ${ACTIVITY_HEATMAP_WEEKS} weeks`}
                  >
                    {heatmapWeeks.map((week, weekIndex) => (
                      <div key={weekIndex} className="flex flex-col gap-1">
                        {week.map((day) => {
                          const tier = day.isFuture
                            ? 0
                            : activityHeatmapTier(day.count, maxActivity);
                          const label = formatActivityDayLabel(day.date, day.count, day.isFuture);
                          return (
                            <div
                              key={day.date.toISOString()}
                              title={label || undefined}
                              aria-label={label || undefined}
                              className={cn(
                                "h-3.5 w-3.5 rounded-sm",
                                day.isFuture ? "opacity-0" : TIER_STYLE[tier],
                              )}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span className="text-muted">Less</span>
                  {([0, 1, 2, 3, 4] as const).map((tier) => (
                    <span
                      key={tier}
                      className={cn("inline-block h-3 w-3 rounded-sm", TIER_STYLE[tier])}
                      aria-hidden
                    />
                  ))}
                  <span className="text-muted">More</span>
                </div>
              </>
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}
