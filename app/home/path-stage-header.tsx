"use client";

import type { ExperienceMode } from "@/lib/db";
import { PLACEHOLDER_STAGE_BLURB, RICH_STAGE_BLURB, type PathStageGroup } from "@/lib/path/stages";
import { Badge, Card, cn } from "@/ui";

/**
 * Stage band on the learning path (issue #127) — groups many small pre-A1 units under one
 * skill-family header so the path reads as four shores, not a flat checklist. Placeholder
 * stages use intentional "preview / growing" copy so thin content does not look broken.
 */
export function PathStageHeader({ stage, mode }: { stage: PathStageGroup; mode: ExperienceMode }) {
  const kid = mode === "kid";
  const placeholder = stage.richness === "placeholder";
  const done = stage.units.filter((u) => u.status === "completed").length;
  const total = stage.units.length;

  return (
    <Card
      data-testid={`path-stage-${stage.stageId}`}
      data-richness={stage.richness}
      data-complete={stage.isComplete || undefined}
      className={cn(
        "flex flex-col gap-1.5 p-4",
        kid && "rounded-2xl",
        placeholder && "border-border/80 bg-foreground/[0.03] border-dashed",
        !placeholder && "border-accent/25 bg-accent/[0.06]",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className={cn("text-foreground font-semibold", kid ? "text-base" : "text-sm")}>
          {kid ? stage.islandLabel : stage.title}
        </p>
        <Badge variant={placeholder ? "warning" : "accent"} size="sm" className="shrink-0">
          {placeholder ? (kid ? "Preview trail" : "Growing") : kid ? "Adventure ready" : "Ready"}
        </Badge>
        <span className="text-muted ml-auto text-xs tabular-nums">
          {done}/{total}
        </span>
      </div>
      <p className={cn("text-muted leading-5", kid ? "text-sm" : "text-xs")}>
        {placeholder ? PLACEHOLDER_STAGE_BLURB : RICH_STAGE_BLURB}
      </p>
    </Card>
  );
}
