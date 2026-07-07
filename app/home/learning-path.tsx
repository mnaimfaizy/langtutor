"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { ContentRepository, Unit, UnitStatus } from "@/lib/db";
import { loadPathIfEmpty } from "@/lib/path/seed";
import type { PlannedUnit } from "@/lib/path/teacher-planner";
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
 * Asks the server to plan any unplanned future units (LLM teacher, ADR 0015, issue #58)
 * and applies whatever it returns to the repository. Silent no-op on any failure — an
 * unreachable Mac must never surface an error here; units simply keep their backbone
 * placeholders. Persisting the (already Zod-validated) plan is a plain repository write,
 * not a Mac call — only `POST /api/path/plan` itself talks to the Mac (hard rule 1).
 */
async function planUnplannedUnits(repo: ContentRepository): Promise<boolean> {
  try {
    const res = await fetch("/api/path/plan", { method: "POST" });
    if (!res.ok) return false;

    const data = (await res.json()) as { plans?: PlannedUnit[] };
    const plans = data.plans ?? [];
    for (const plan of plans) {
      await repo.updateUnit(plan.unitId, {
        title: plan.title,
        teacherNote: plan.teacherNote,
        targetVocab: plan.targetVocab,
      });
    }
    return plans.length > 0;
  } catch {
    return false;
  }
}

/**
 * Minimal path rendering (issue #57): the ordered unit list with locked/available status
 * styling. Seeds the backbone path from the learner's profile on first visit — deterministic,
 * offline, no LLM call (ADR 0015). Renders nothing until units are loaded so it never flashes
 * an empty state on a fresh account. Once the backbone is visible, kicks off best-effort
 * server-side teacher planning (issue #58) and re-renders if any unit got planned.
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

      const planned = await planUnplannedUnits(repo);
      if (planned && active) setUnits(await repo.getUnits());
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
