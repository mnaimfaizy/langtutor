"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { resolveMotionPreset } from "@/lib/motion";
import { cn } from "./cn";

// Hand-built: a toggle-style pill/tile button for single-choice pickers (CEFR level, topic,
// quiz option). Not a Base UI wrapper — Base UI has no radio-button-group primitive that
// matches this look — but it shares the same token vocabulary, focus ring, and press motion
// as Button so pickers built from it feel identical to the rest of the elevated ui/ layer.

const MotionButton = motion.create("button");

export type SelectPillProps = Omit<React.ComponentProps<typeof MotionButton>, "className"> & {
  selected?: boolean;
  className?: string;
};

export function SelectPill({ selected = false, className, ...props }: SelectPillProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const press = resolveMotionPreset("press", reducedMotion);

  return (
    <MotionButton
      type="button"
      aria-pressed={selected}
      whileTap={press.whileTap}
      transition={press.transition}
      className={cn(
        "relative cursor-default rounded-xl border px-3 py-2.5 text-left text-sm transition-[colors,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "focus-visible:ring-accent focus-visible:ring-offset-background",
        selected
          ? "border-accent bg-accent/10 text-foreground shadow-glow font-medium"
          : "border-border bg-card text-muted hover:text-foreground hover:border-foreground/30",
        className,
      )}
      {...props}
    />
  );
}
