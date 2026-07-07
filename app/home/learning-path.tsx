"use client";

import { useEffect, useState } from "react";

import type { Unit, UnitStatus } from "@/lib/db";
import { loadPathIfEmpty } from "@/lib/path/seed";
import { getContentRepository } from "@/lib/registry";
import { Badge, Card } from "@/ui";

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

/**
 * Minimal path-skeleton rendering (issue #57): the ordered unit list with locked/available
 * status styling. Seeds the backbone path from the learner's profile on first visit —
 * deterministic, offline, no LLM call (ADR 0015). Renders nothing until units are loaded
 * so it never flashes an empty state on a fresh account.
 */
export function LearningPath() {
  const [units, setUnits] = useState<Unit[] | null>(null);

  useEffect(() => {
    let active = true;
    const repo = getContentRepository();

    void (async () => {
      const profile = await repo.getProfile();
      const anchorLevel = profile?.cefrLevel ?? "A1";
      await loadPathIfEmpty(repo, anchorLevel);
      const loaded = await repo.getUnits();
      if (active) setUnits(loaded);
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!units || units.length === 0) return null;

  return (
    <section data-testid="learning-path" className="mt-10 w-full">
      <h2 className="text-foreground text-lg font-semibold tracking-tight">Your learning path</h2>
      <ol className="mt-4 flex flex-col gap-2">
        {units.map((unit) => (
          <li key={unit.id}>
            <Card
              data-testid={`unit-${unit.index}`}
              data-status={unit.status}
              className={unit.status === "locked" ? "opacity-60" : undefined}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-foreground text-sm font-semibold">{unit.title}</p>
                  <p className="text-muted mt-1 text-xs leading-5">{unit.teacherNote}</p>
                </div>
                <Badge variant={STATUS_BADGE_VARIANT[unit.status]} size="sm">
                  {STATUS_LABEL[unit.status]}
                </Badge>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
