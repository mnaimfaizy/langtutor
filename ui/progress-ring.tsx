"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { resolveMotionPreset } from "@/lib/motion";
import { cn } from "./cn";

// Hand-built: Base UI's Progress primitive is linear-only. Renders the same progressbar
// semantics (role, aria-value*) over an SVG ring, so it slots in anywhere Progress does.

export type ProgressRingSize = "sm" | "md" | "lg";

const DIMENSIONS: Record<ProgressRingSize, { box: number; stroke: number }> = {
  sm: { box: 40, stroke: 4 },
  md: { box: 64, stroke: 6 },
  lg: { box: 96, stroke: 8 },
};

export type ProgressRingProps = Omit<React.ComponentProps<"div">, "children"> & {
  value: number;
  min?: number;
  max?: number;
  size?: ProgressRingSize;
  trackClassName?: string;
  indicatorClassName?: string;
  /** Content rendered in the center of the ring, e.g. a level number. */
  children?: React.ReactNode;
};

export function ProgressRing({
  value,
  min = 0,
  max = 100,
  size = "md",
  className,
  trackClassName,
  indicatorClassName,
  children,
  "aria-label": ariaLabel = "Progress",
  ...props
}: ProgressRingProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const fill = resolveMotionPreset("path-fill", reducedMotion);
  const { box, stroke } = DIMENSIONS[size];
  const radius = (box - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(max, Math.max(min, value));
  const ratio = max > min ? (clamped - min) / (max - min) : 0;

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={clamped}
      aria-valuemin={min}
      aria-valuemax={max}
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: box, height: box }}
      {...props}
    >
      <svg width={box} height={box} className="-rotate-90">
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          className={cn("stroke-foreground/10", trackClassName)}
        />
        <motion.circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          className={cn("stroke-accent", indicatorClassName)}
          style={{ strokeDasharray: circumference }}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - ratio) }}
          transition={fill.transition}
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      ) : null}
    </div>
  );
}
