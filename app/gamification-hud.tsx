"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import type { GamificationState } from "@/lib/db";
import { getContentRepository } from "@/lib/registry";

export function GamificationHud() {
  const [state, setState] = useState<GamificationState | null>(null);
  const pathname = usePathname();

  // Re-fetch whenever the user navigates to a new route so the HUD reflects
  // XP/level/streak updated by a completed review session.
  useEffect(() => {
    if (pathname.startsWith("/login") || pathname.startsWith("/sign-up")) return;
    void getContentRepository()
      .getGamification()
      .then((g) => {
        if (g) setState(g);
      });
  }, [pathname]);

  if (!state) return null;

  return (
    <div
      data-testid="gamification-hud"
      className="text-muted flex items-center gap-3 text-xs tabular-nums"
    >
      <span data-testid="hud-streak" title="Day streak">
        {state.streakCount}d streak
      </span>
      <span data-testid="hud-level" title="Level">
        Lv {state.level}
      </span>
      <span data-testid="hud-xp" title="Total XP">
        {state.xp} XP
      </span>
    </div>
  );
}
