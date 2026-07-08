"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

import type { ExperienceMode } from "@/lib/db";
import { MOTION_DURATIONS, resolveMotionPreset } from "@/lib/motion";
import type { PathTier } from "@/lib/path/pre-a1";
import { Card, cn } from "@/ui";
import { TrophyIcon } from "../icons";

// The "chapter-complete moment" rendered on the path once every unit of a level tier is
// done (issue #62) — so moving e.g. pre-A1 → A1 or A1 → A2 feels like an achievement, not
// just the next row in a list. Colors in with the shared `path-fill` preset when triggered
// by a fresh unit-completion signal (issue #84).

const MODE_COPY: Record<ExperienceMode, (tier: PathTier, nextTier?: PathTier) => string> = {
  kid: (tier, nextTier) =>
    nextTier
      ? `You finished ${tierLabel(tier)}! Onward to ${tierLabel(nextTier)}!`
      : `You finished ${tierLabel(tier)}!`,
  adult: (tier, nextTier) =>
    nextTier
      ? `${tierLabel(tier)} complete — moving on to ${tierLabel(nextTier)}.`
      : `${tierLabel(tier)} complete.`,
};

function tierLabel(tier: PathTier): string {
  return tier === "pre-A1" ? "the basics" : `level ${tier}`;
}

export function PathChapterMilestone({
  tier,
  nextTier,
  mode,
  animateIn = false,
  onAnimationEnd,
}: {
  tier: PathTier;
  nextTier?: PathTier;
  mode: ExperienceMode;
  animateIn?: boolean;
  onAnimationEnd?: () => void;
}) {
  const kid = mode === "kid";
  const reducedMotion = useReducedMotion() ?? false;
  const fill = resolveMotionPreset("path-fill", reducedMotion);

  useEffect(() => {
    if (!animateIn) return;
    const fillMs = reducedMotion
      ? MOTION_DURATIONS.pathFillReduced * 1000
      : MOTION_DURATIONS.pathFill * 1000;
    const timer = window.setTimeout(() => onAnimationEnd?.(), fillMs);
    return () => window.clearTimeout(timer);
  }, [animateIn, reducedMotion, onAnimationEnd]);

  return (
    <motion.div
      initial={animateIn ? { opacity: 0.5, scale: 0.98 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={fill.transition}
    >
      <Card
        data-testid={`chapter-complete-${tier}`}
        data-animating={animateIn || undefined}
        variant="glass"
        className={cn(
          "from-gradient-from/15 via-gradient-via/15 to-gradient-to/15 border-accent/30 flex items-center gap-3 bg-gradient-to-r",
          kid && "rounded-2xl",
          animateIn && "border-success/40 from-success/10 via-gradient-via/15 to-gradient-to/15",
        )}
      >
        <motion.span
          initial={animateIn ? { scale: 0.85, opacity: 0.6 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={fill.transition}
          className={cn(
            "from-gradient-from via-gradient-via to-gradient-to text-gradient-foreground shadow-glow flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br",
            kid ? "size-12" : "size-9",
          )}
        >
          <TrophyIcon className={kid ? "size-6" : "size-5"} />
        </motion.span>
        <p className={cn("text-foreground font-semibold", kid ? "text-base" : "text-sm")}>
          {MODE_COPY[mode](tier, nextTier)}
        </p>
      </Card>
    </motion.div>
  );
}
