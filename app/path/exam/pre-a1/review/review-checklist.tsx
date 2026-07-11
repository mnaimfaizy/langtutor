"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { ChapterGate, ChapterReviewAssignment, Unit } from "@/lib/db";
import { PRE_A1_CHAPTER_TIER, resolveChapterGateStatus } from "@/lib/path/chapter-gate";
import {
  isPreA1ExamStartAllowed,
  isReviewAssignmentComplete,
  markPreA1ReviewItemDone,
  PRE_A1_REVIEW_SKILL_LABEL,
  type PreA1ExamSkill,
} from "@/lib/path/exam";
import { getContentRepository } from "@/lib/registry";
import { BackLink, Button, Card } from "@/ui";

type Phase = "loading" | "ready" | "ready-retake" | "no-assignment" | "passed";

/**
 * Strict-mode review checklist after a failed pre-A1 chapter exam (issue #117).
 * Links into assigned pre-A1 units; retake stays blocked until every item is done.
 */
export function PreA1ReviewChecklist() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [assignment, setAssignment] = useState<ChapterReviewAssignment | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    const repo = getContentRepository();
    const [gate, loadedUnits] = await Promise.all([
      repo.getChapterGate(PRE_A1_CHAPTER_TIER),
      repo.getUnits(),
    ]);
    setUnits(loadedUnits);
    applyGate(gate);
  }

  function applyGate(gate: ChapterGate | undefined) {
    const status = resolveChapterGateStatus(gate);
    if (status === "passed") {
      setPhase("passed");
      setAssignment(null);
      return;
    }
    if (status === "ready_retake" && gate?.reviewAssignment) {
      setAssignment(gate.reviewAssignment);
      setPhase("ready-retake");
      return;
    }
    if (status === "failed_review" && gate?.reviewAssignment) {
      setAssignment(gate.reviewAssignment);
      setPhase("ready");
      return;
    }
    if (isPreA1ExamStartAllowed(status)) {
      setPhase("no-assignment");
      setAssignment(null);
      return;
    }
    setPhase("no-assignment");
    setAssignment(null);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const repo = getContentRepository();
        const [gate, loadedUnits] = await Promise.all([
          repo.getChapterGate(PRE_A1_CHAPTER_TIER),
          repo.getUnits(),
        ]);
        if (!active) return;
        setUnits(loadedUnits);
        applyGate(gate);
      } catch {
        if (active) setPhase("no-assignment");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleMarkDone(itemId: string) {
    if (busyId) return;
    setBusyId(itemId);
    try {
      const next = await markPreA1ReviewItemDone(getContentRepository(), itemId);
      applyGate(next);
      if (!next) await reload();
    } finally {
      setBusyId(null);
    }
  }

  function unitHref(unitIndex: number): string | null {
    const unit = units.find((u) => u.index === unitIndex);
    return unit ? `/path/${unit.id}` : null;
  }

  if (phase === "loading") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8" data-testid="pre-a1-review-loading">
        <BackLink href="/home" label="Home" className="mb-6" />
        <p className="text-muted text-sm">Loading your review assignment…</p>
      </main>
    );
  }

  if (phase === "passed") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8" data-testid="pre-a1-review-passed">
        <BackLink href="/home" label="Home" className="mb-6" />
        <Card>
          <h1 className="text-foreground text-xl font-semibold">Chapter already cleared</h1>
          <p className="text-muted mt-2 text-sm">
            You passed the Pre-A1 exam. Continue into A1 on your path.
          </p>
          <Link href="/home" className="mt-6 inline-block">
            <Button variant="primary">Back to home</Button>
          </Link>
        </Card>
      </main>
    );
  }

  if (phase === "no-assignment") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8" data-testid="pre-a1-review-none">
        <BackLink href="/home" label="Home" className="mb-6" />
        <Card>
          <h1 className="text-foreground text-xl font-semibold">No review waiting</h1>
          <p className="text-muted mt-2 text-sm">
            Take the chapter exam when you are ready. Review appears only after a strict-mode fail.
          </p>
          <Link href="/path/exam/pre-a1" className="mt-6 inline-block">
            <Button variant="primary">Go to chapter exam</Button>
          </Link>
        </Card>
      </main>
    );
  }

  const complete = assignment ? isReviewAssignmentComplete(assignment) : false;
  const canRetake = phase === "ready-retake" || complete;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8" data-testid="pre-a1-review-checklist">
      <BackLink href="/home" label="Home" className="mb-6" />
      <h1 className="text-foreground text-xl font-semibold">Teacher review assignment</h1>
      <p className="text-muted mt-1 text-sm">
        Practice each assigned skill, then mark it done. The retake unlocks only when every item is
        complete — passing the exam is still required to unlock A1.
      </p>

      <ul className="mt-6 flex flex-col gap-3" data-testid="pre-a1-review-items">
        {assignment?.items.map((item) => {
          const href = unitHref(item.unitIndex);
          const skill = item.skill as PreA1ExamSkill;
          return (
            <li key={item.id}>
              <Card
                data-testid={`pre-a1-review-item-${item.id}`}
                data-done={item.done || undefined}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-foreground text-sm font-semibold">{item.label}</p>
                    <p className="text-muted mt-0.5 text-xs">
                      {PRE_A1_REVIEW_SKILL_LABEL[skill] ?? item.skill} · unit {item.unitIndex}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {href && (
                      <Link href={href}>
                        <Button variant="secondary" size="sm">
                          Practice
                        </Button>
                      </Link>
                    )}
                    {item.done ? (
                      <span className="text-success text-xs font-medium">Done</span>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => void handleMarkDone(item.id)}
                        data-testid={`pre-a1-review-done-${item.id}`}
                      >
                        {busyId === item.id ? "Saving…" : "Mark done"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {canRetake ? (
          <Link href="/path/exam/pre-a1" data-testid="pre-a1-review-retake">
            <Button variant="primary">Retake chapter exam</Button>
          </Link>
        ) : (
          <Button variant="primary" disabled data-testid="pre-a1-review-retake-blocked">
            Retake locked until review is done
          </Button>
        )}
        <Link href="/home">
          <Button variant="ghost">Back to home</Button>
        </Link>
      </div>
    </main>
  );
}
