"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { Unit, UnitStatus } from "@/lib/db";
import { replenishPathBuffer } from "@/lib/path/replenish";
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
 * Minimal path rendering (issue #57): the ordered unit list with locked/available status
 * styling. Seeds the backbone path from the learner's profile on first visit — deterministic,
 * offline, no LLM call (ADR 0015). Renders nothing until units are loaded so it never flashes
 * an empty state on a fresh account. Once the backbone is visible, kicks off a best-effort
 * path-buffer replenishment pass (session-start trigger, ADR 0015, issue #61 — plans unplanned
 * future units, issue #58, and pre-generates their activity content, issue #61) and re-renders
 * with whatever it managed to fill in.
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

      await replenishPathBuffer(repo);
      if (active) setUnits(await repo.getUnits());
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
        {units.map((unit) => {
          const locked = unit.status === "locked";
          const card = (
            <Card
              data-testid={`unit-${unit.index}`}
              data-status={unit.status}
              data-unit-id={unit.id}
              className={
                locked
                  ? "opacity-60"
                  : "hover:border-accent/40 hover:shadow-glow transition-[colors,box-shadow]"
              }
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
          );

          return (
            <li key={unit.id}>
              {locked ? (
                card
              ) : (
                <Link
                  href={`/path/${unit.id}`}
                  className="focus-visible:ring-accent focus-visible:ring-offset-background block rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {card}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
