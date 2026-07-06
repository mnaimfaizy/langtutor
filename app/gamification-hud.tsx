"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import type { GamificationState } from "@/lib/db";
import { getContentRepository } from "@/lib/registry";
import { Badge } from "@/ui";

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

  return (
    <div data-testid="gamification-hud" className="flex items-center gap-1.5 tabular-nums">
      <Badge variant="warning" size="sm" data-testid="hud-streak" title="Day streak">
        {state.streakCount}d
      </Badge>
      <Badge variant="accent" size="sm" data-testid="hud-level" title="Level">
        Lv {state.level}
      </Badge>
      <Badge variant="gradient" size="sm" data-testid="hud-xp" title="Total XP">
        {state.xp} XP
      </Badge>
    </div>
  );
}
