"use client";

import { useEffect, useState } from "react";

import type { GamificationState } from "@/lib/db";
import { getContentRepository } from "@/lib/registry";

export function GamificationHud() {
  const [state, setState] = useState<GamificationState | null>(null);

  useEffect(() => {
    void getContentRepository()
      .getGamification()
      .then((g) => {
        if (g) setState(g);
      });
  }, []);

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
