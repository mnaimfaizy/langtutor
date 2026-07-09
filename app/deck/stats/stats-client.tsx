"use client";

import Link from "next/link";
import { useMemo } from "react";

import { computeDueForecast, formatForecastDayLabel, FORECAST_DAYS } from "@/lib/deck/due-forecast";
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
      </div>
    </main>
  );
}
