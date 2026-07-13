"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import type { ExperienceMode, SharedPathUnitRichness, Unit, UnitStatus } from "@/lib/db";
import { MOTION_DURATIONS, resolveMotionPreset } from "@/lib/motion";
import { firstPendingActivityIndex } from "@/lib/path/unit-progress";
import { isPreA1Unit } from "@/lib/path/pre-a1";
import { shortUnitTitle } from "@/lib/path/stages";
import { Badge, Card, ProgressRing, cn } from "@/ui";
import { ACTIVITY_ICON } from "../path/activity-display";
import { CheckIcon, FlagIcon, LockIcon } from "../icons";

// One node on the visual journey (ADR 0015/0017, issue #62). "Two renders, one system": the
// same markup renders an adventure-map register in kid mode (bigger marker, bolder ring) and
// a premium register in adult mode (smaller marker, glass card) — driven entirely by @mode
// and the palette tokens it resolves to (`lib/theme`), never a separate component tree.

const STATUS_LABEL: Record<UnitStatus, string> = {
  locked: "Locked",
  available: "Start",
  "in-progress": "Continue",
  completed: "Completed",
};

const STATUS_BADGE_VARIANT: Record<UnitStatus, "neutral" | "accent" | "success"> = {
  locked: "neutral",
  available: "accent",
  "in-progress": "accent",
  completed: "success",
};

export function PathNode({
  unit,
  mode,
  isCurrent,
  playFillAnimation = false,
  onFillAnimationEnd,
  richness,
}: {
  unit: Unit;
  mode: ExperienceMode;
  isCurrent: boolean;
  playFillAnimation?: boolean;
  onFillAnimationEnd?: () => void;
  /** Catalog richness when known — placeholder units get intentional preview chrome. */
  richness?: SharedPathUnitRichness;
}) {
  const locked = unit.status === "locked";
  const kid = mode === "kid";
  const placeholder = richness === "placeholder";
  const reducedMotion = useReducedMotion() ?? false;
  const fill = resolveMotionPreset("path-fill", reducedMotion);
  const title = isPreA1Unit(unit) ? shortUnitTitle(unit.title) : unit.title;
  const note = placeholder
    ? kid
      ? "A quick preview stop — more fun grows here soon."
      : unit.teacherNote.replace(/\s*Placeholder — richer content comes later\.?/i, "").trim() ||
        "Light preview — richer content lands here for everyone later."
    : unit.teacherNote;

  const card = (
    <Card
      data-testid={`unit-${unit.index}`}
      data-status={unit.status}
      data-unit-id={unit.id}
      data-current={isCurrent || undefined}
      data-filling={playFillAnimation || undefined}
      data-richness={richness}
      className={cn(
        "flex items-center gap-4",
        kid && "rounded-2xl",
        locked
          ? "opacity-60"
          : "hover:border-accent/40 hover:shadow-glow transition-[colors,box-shadow]",
        isCurrent && !locked && "border-accent/50 shadow-glow",
        unit.status === "completed" && "border-success/30",
        placeholder && "border-dashed",
      )}
    >
      <NodeMarker
        unit={unit}
        kid={kid}
        testId={`unit-${unit.index}-marker`}
        playFillAnimation={playFillAnimation}
        onFillAnimationEnd={onFillAnimationEnd}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {isPreA1Unit(unit) && !richness && (
            <Badge variant="neutral" size="sm" className="shrink-0">
              Pre-A1
            </Badge>
          )}
          {placeholder && (
            <Badge variant="warning" size="sm" className="shrink-0">
              {kid ? "Preview" : "Growing"}
            </Badge>
          )}
          <p className={cn("text-foreground font-semibold", kid ? "text-base" : "text-sm")}>
            {title}
          </p>
        </div>
        <p className={cn("text-muted mt-1 leading-5", kid ? "text-sm" : "text-xs")}>{note}</p>
      </div>

      <Badge variant={STATUS_BADGE_VARIANT[unit.status]} size="sm" className="shrink-0">
        {STATUS_LABEL[unit.status]}
      </Badge>
    </Card>
  );

  const wrappedCard =
    playFillAnimation && unit.status === "completed" ? (
      <motion.div
        initial={{ opacity: 0.92 }}
        animate={{ opacity: 1 }}
        transition={fill.transition}
        className="rounded-xl"
      >
        {card}
      </motion.div>
    ) : (
      card
    );

  if (locked) return wrappedCard;

  return (
    <Link
      href={`/path/${unit.id}`}
      className="focus-visible:ring-accent focus-visible:ring-offset-background block rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {wrappedCard}
    </Link>
  );
}

/** The node's marker: dormant lock, ready-to-start flag, filling ring, or a completed check. */
function NodeMarker({
  unit,
  kid,
  testId,
  playFillAnimation,
  onFillAnimationEnd,
}: {
  unit: Unit;
  kid: boolean;
  testId: string;
  playFillAnimation: boolean;
  onFillAnimationEnd?: () => void;
}) {
  const size = kid ? "md" : "sm";
  const iconSize = kid ? "size-6" : "size-4";

  if (unit.status === "locked") {
    return (
      <span
        data-testid={testId}
        className={cn(
          "bg-foreground/[0.06] text-muted flex shrink-0 items-center justify-center rounded-full",
          kid ? "size-16" : "size-11",
        )}
      >
        <LockIcon className={iconSize} />
      </span>
    );
  }

  if (unit.status === "completed") {
    if (playFillAnimation) {
      return (
        <AnimatingCompletedMarker
          kid={kid}
          iconSize={iconSize}
          testId={testId}
          total={unit.activities.length}
          onFillAnimationEnd={onFillAnimationEnd}
        />
      );
    }

    return <StaticCompletedMarker kid={kid} iconSize={iconSize} testId={testId} />;
  }

  if (unit.status === "in-progress") {
    const done = unit.activities.filter((a) => a.done).length;
    const total = unit.activities.length;
    const nextIndex = firstPendingActivityIndex(unit);
    const NextIcon = ACTIVITY_ICON[unit.activities[nextIndex]?.skill ?? "review"];

    return (
      <ProgressRing
        data-testid={testId}
        value={done}
        max={total}
        size={size}
        aria-label={`${unit.title}: ${done} of ${total} activities complete`}
        className="shrink-0"
      >
        <NextIcon className={cn(iconSize, "text-accent")} />
      </ProgressRing>
    );
  }

  // available
  return (
    <span
      data-testid={testId}
      className={cn(
        "border-accent bg-accent/10 text-accent flex shrink-0 items-center justify-center rounded-full border-2",
        kid ? "size-16" : "size-11",
      )}
    >
      <FlagIcon className={iconSize} />
    </span>
  );
}

/** Completed check shown for units that were already done before this render. */
function StaticCompletedMarker({
  kid,
  iconSize,
  testId,
}: {
  kid: boolean;
  iconSize: string;
  testId: string;
}) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "from-gradient-from via-gradient-via to-gradient-to text-gradient-foreground shadow-glow flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br",
        kid ? "size-16" : "size-11",
      )}
    >
      <CheckIcon className={iconSize} />
    </span>
  );
}

/** Plays ring-to-check fill once on mount (issue #84). */
function AnimatingCompletedMarker({
  kid,
  iconSize,
  testId,
  total,
  onFillAnimationEnd,
}: {
  kid: boolean;
  iconSize: string;
  testId: string;
  total: number;
  onFillAnimationEnd?: () => void;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const fill = resolveMotionPreset("path-fill", reducedMotion);
  const size = kid ? "md" : "sm";
  const ringStart = Math.max(0, total - 1);
  const [ringValue, setRingValue] = useState(ringStart);
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setRingValue(total));

    const fillMs = reducedMotion
      ? MOTION_DURATIONS.pathFillReduced * 1000
      : MOTION_DURATIONS.pathFill * 1000;

    const checkTimer = window.setTimeout(() => {
      setShowCheck(true);
      onFillAnimationEnd?.();
    }, fillMs);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(checkTimer);
    };
  }, [reducedMotion, onFillAnimationEnd, total]);

  if (!showCheck) {
    return (
      <ProgressRing
        data-testid={testId}
        value={ringValue}
        max={total}
        size={size}
        aria-label={`${total} of ${total} activities complete`}
        className="shrink-0"
        indicatorClassName="stroke-success"
      >
        <CheckIcon className={cn(iconSize, "text-success")} />
      </ProgressRing>
    );
  }

  return (
    <motion.span
      data-testid={testId}
      initial={{ scale: 0.9, opacity: 0.7 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={fill.transition}
      className={cn(
        "from-gradient-from via-gradient-via to-gradient-to text-gradient-foreground shadow-glow flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br",
        kid ? "size-16" : "size-11",
      )}
    >
      <CheckIcon className={iconSize} />
    </motion.span>
  );
}
