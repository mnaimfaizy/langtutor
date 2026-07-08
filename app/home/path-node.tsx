"use client";

import Link from "next/link";

import type { ExperienceMode, Unit, UnitStatus } from "@/lib/db";
import { firstPendingActivityIndex } from "@/lib/path/unit-progress";
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
}: {
  unit: Unit;
  mode: ExperienceMode;
  isCurrent: boolean;
}) {
  const locked = unit.status === "locked";
  const kid = mode === "kid";

  const card = (
    <Card
      data-testid={`unit-${unit.index}`}
      data-status={unit.status}
      data-unit-id={unit.id}
      data-current={isCurrent || undefined}
      className={cn(
        "flex items-center gap-4",
        kid && "rounded-2xl",
        locked
          ? "opacity-60"
          : "hover:border-accent/40 hover:shadow-glow transition-[colors,box-shadow]",
        isCurrent && !locked && "border-accent/50 shadow-glow",
      )}
    >
      <NodeMarker unit={unit} kid={kid} testId={`unit-${unit.index}-marker`} />

      <div className="min-w-0 flex-1">
        <p className={cn("text-foreground font-semibold", kid ? "text-base" : "text-sm")}>
          {unit.title}
        </p>
        <p className={cn("text-muted mt-1 leading-5", kid ? "text-sm" : "text-xs")}>
          {unit.teacherNote}
        </p>
      </div>

      <Badge variant={STATUS_BADGE_VARIANT[unit.status]} size="sm" className="shrink-0">
        {STATUS_LABEL[unit.status]}
      </Badge>
    </Card>
  );

  if (locked) return card;

  return (
    <Link
      href={`/path/${unit.id}`}
      className="focus-visible:ring-accent focus-visible:ring-offset-background block rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {card}
    </Link>
  );
}

/** The node's marker: dormant lock, ready-to-start flag, filling ring, or a completed check. */
function NodeMarker({ unit, kid, testId }: { unit: Unit; kid: boolean; testId: string }) {
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
