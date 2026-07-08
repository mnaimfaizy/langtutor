"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { Unit } from "@/lib/db";
import { resolveUnitResumeTarget } from "@/lib/path/resume";
import { firstPendingActivityIndex } from "@/lib/path/unit-progress";
import { getContentRepository } from "@/lib/registry";
import { CEFR_BADGE_VARIANT } from "@/lib/cefr";
import { Badge, BackLink, Button, Card } from "@/ui";
import { ACTIVITY_ICON, ACTIVITY_LABEL } from "../activity-display";

type Phase = "loading" | "ready" | "notFound" | "generating" | "error" | "paused";

export function UnitView({ id }: { id: number }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(() => (isNaN(id) || id <= 0 ? "notFound" : "loading"));
  const [unit, setUnit] = useState<Unit | null>(null);

  useEffect(() => {
    if (isNaN(id) || id <= 0) return;

    let active = true;
    void getContentRepository()
      .getUnits()
      .then((units) => {
        if (!active) return;
        const found = units.find((u) => u.id === id);
        if (!found) {
          setPhase("notFound");
        } else {
          setUnit(found);
          setPhase("ready");
        }
      })
      .catch(() => {
        if (active) setPhase("error");
      });

    return () => {
      active = false;
    };
  }, [id]);

  /**
   * Resolves and navigates to the unit's first pending activity via the shared
   * `resolveUnitResumeTarget` (issue #62) — review goes straight to the SRS deck, a
   * buffer-generated activity deep-links straight to its cached content, and anything else
   * is lazily generated-then-cached first (issue #59, extended to all module types by issue
   * #60). If generation is needed and fails (unreachable provider), falls back to the
   * graceful-pause state instead of an inline error (ADR 0015, issue #61).
   */
  async function startActivity() {
    if (!unit) return;

    setPhase("generating");
    try {
      const target = await resolveUnitResumeTarget(getContentRepository(), unit);
      if (target) router.push(target.href);
    } catch {
      // The generation call itself is the authoritative reachability signal — a failure here
      // always means the graceful-pause state (ADR 0015, issue #61), not just an inline error.
      setPhase("paused");
    }
  }

  /** Returns from the graceful-pause state to the activity list, e.g. once back online. */
  function retryFromPause() {
    setPhase("ready");
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-muted text-sm">Loading…</p>
      </div>
    );
  }

  if (phase === "notFound" || !unit) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <p className="text-foreground text-base font-semibold">Unit not found</p>
        <p className="text-muted mt-2 text-sm">It may have been removed or the link is invalid.</p>
        <Link href="/home" className="mt-8">
          <Button variant="secondary" size="lg">
            Back to home
          </Button>
        </Link>
      </div>
    );
  }

  if (unit.status === "locked") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <p className="text-foreground text-base font-semibold">This unit is still locked</p>
        <p className="text-muted mt-2 text-sm">
          Complete the units before it on your learning path first.
        </p>
        <Link href="/home" className="mt-8">
          <Button variant="secondary" size="lg">
            Back to home
          </Button>
        </Link>
      </div>
    );
  }

  if (phase === "paused") {
    return (
      <div
        data-testid="path-paused"
        className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center"
      >
        <p className="text-foreground text-base font-semibold">You&apos;re all caught up for now</p>
        <p className="text-muted mt-2 max-w-sm text-sm">
          This unit&apos;s next activity needs the Mac, and it isn&apos;t reachable right now. Your
          progress is saved — in the meantime, you can still review your vocabulary or read
          something you&apos;ve already downloaded.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/review">
            <Button data-testid="btn-review-instead" variant="gradient" size="lg">
              Review vocabulary
            </Button>
          </Link>
          <Link href="/reading">
            <Button data-testid="btn-browse-cached" variant="secondary" size="lg">
              Browse cached reading
            </Button>
          </Link>
        </div>
        <Button
          data-testid="btn-retry-unit"
          variant="ghost"
          size="sm"
          className="mt-6"
          onClick={retryFromPause}
        >
          Back to this unit
        </Button>
      </div>
    );
  }

  const nextIndex = firstPendingActivityIndex(unit);

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <BackLink href="/home" label="Home" className="mb-6" />

        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Badge variant={CEFR_BADGE_VARIANT[unit.targetCefr]}>{unit.targetCefr}</Badge>
          {unit.status === "completed" && (
            <Badge variant="success" size="sm">
              Completed
            </Badge>
          )}
        </div>

        <h1
          data-testid="unit-title"
          className="text-foreground mt-2 text-2xl leading-snug font-semibold tracking-tight"
        >
          {unit.title}
        </h1>
        <p data-testid="unit-teacher-note" className="text-muted mt-3 text-base leading-7">
          {unit.teacherNote}
        </p>

        {phase === "error" && (
          <p className="text-danger mt-4 text-sm">Could not load this unit. Try again.</p>
        )}

        <ol data-testid="unit-activities" className="mt-8 flex flex-col gap-2">
          {unit.activities.map((activity, i) => {
            const Icon = ACTIVITY_ICON[activity.skill];
            const isNext = i === nextIndex;
            const isDone = Boolean(activity.done);
            const isDisabled = i > nextIndex;

            return (
              <li key={i}>
                <Card
                  data-testid={`unit-activity-${i}`}
                  data-done={isDone}
                  className={isDone ? "opacity-70" : undefined}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          isDone
                            ? "bg-success/15 text-success flex size-9 shrink-0 items-center justify-center rounded-lg"
                            : "bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-lg"
                        }
                      >
                        <Icon className="size-5" />
                      </span>
                      <div>
                        <p className="text-foreground text-sm font-semibold">
                          {ACTIVITY_LABEL[activity.skill]}
                        </p>
                        <p className="text-muted mt-0.5 text-xs">
                          {isDone ? "Done" : isNext ? "Up next" : "Not started"}
                        </p>
                      </div>
                    </div>

                    {isNext && !isDone && (
                      <Button
                        data-testid={`btn-start-activity-${i}`}
                        variant="gradient"
                        size="sm"
                        disabled={phase === "generating" || isDisabled}
                        onClick={() => void startActivity()}
                      >
                        {phase === "generating"
                          ? "Preparing…"
                          : unit.status === "in-progress"
                            ? "Continue"
                            : "Start"}
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>

        {unit.status === "completed" && (
          <p data-testid="unit-complete-message" className="text-success mt-6 text-sm font-medium">
            Unit complete — nice work! The next unit is now available.
          </p>
        )}
      </div>
    </div>
  );
}
