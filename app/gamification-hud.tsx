"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { FlameIcon, TrophyIcon } from "@/app/icons";
import type { GamificationState } from "@/lib/db";
import { isStreakAtRisk, xpLevelRingBounds } from "@/lib/gamification";
import { getContentRepository } from "@/lib/registry";
import { ProgressRing, buttonClassName, cn } from "@/ui";

export function GamificationHud() {
  const [state, setState] = useState<GamificationState | null>(null);
  const pathname = usePathname();

  // Re-fetch whenever the user navigates to a new route so the HUD reflects
  // XP/level/streak updated by a completed review session.
  useEffect(() => {
    if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/sign-up"))
      return;
    void getContentRepository()
      .getGamification()
      .then((g) => {
        if (g) setState(g);
      });
  }, [pathname]);

  if (!state) return null;

  const { min: levelMin, max: levelMax } = xpLevelRingBounds(state.xp);
  const streakAtRisk = isStreakAtRisk(new Date(), state.lastActivityDate, state.streakCount);

  return (
    <div
      data-testid="gamification-hud"
      className="border-glass-border bg-glass/60 flex items-center gap-2 rounded-full border px-2 py-1 tabular-nums backdrop-blur-sm"
    >
      <div
        data-testid="hud-streak"
        data-streak-at-risk={streakAtRisk ? "true" : undefined}
        title={streakAtRisk ? "Streak at risk — practice today to keep it" : "Day streak"}
        aria-label={
          streakAtRisk
            ? `${state.streakCount} day streak at risk`
            : `${state.streakCount} day streak`
        }
        className={cn(
          "border-warning/30 bg-warning/10 text-warning flex items-center gap-1 rounded-full border px-2 py-0.5",
          state.streakCount > 0 &&
            !streakAtRisk &&
            "motion-safe:shadow-warning/40 motion-safe:shadow-[0_0_10px_-2px]",
          streakAtRisk && "border-warning/20 bg-warning/5 text-warning/55 opacity-75",
        )}
      >
        <FlameIcon className="size-3.5 shrink-0" />
        <span className="text-xs font-semibold">{state.streakCount}</span>
      </div>

      <ProgressRing
        data-testid="hud-level"
        title="Level"
        value={state.xp}
        min={levelMin}
        max={levelMax}
        size="sm"
        aria-label={`Level ${state.level}`}
        className="shrink-0"
        indicatorClassName="stroke-accent"
      >
        <span className="text-foreground text-[10px] leading-none font-bold">{state.level}</span>
      </ProgressRing>

      <div
        data-testid="hud-xp"
        title="Total XP"
        aria-label={`${state.xp} experience points`}
        className="from-gradient-from via-gradient-via to-gradient-to text-gradient-foreground shadow-glow flex items-center rounded-full bg-gradient-to-r px-2 py-0.5 text-xs font-semibold"
      >
        {state.xp} XP
      </div>

      <Link
        href="/collection"
        data-testid="hud-collection"
        aria-label="View collection"
        title="Collection"
        className={buttonClassName({
          variant: "ghost",
          size: "sm",
          className: "text-muted hover:text-foreground size-7 shrink-0 p-0",
        })}
      >
        <TrophyIcon className="size-4" />
      </Link>
    </div>
  );
}
