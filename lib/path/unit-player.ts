/**
 * Unit player orchestration (ADR 0015, issue #59 — unit player tracer).
 *
 * Wires the pure state machine (`lib/path/unit-progress.ts`) to the repository and the
 * completion event (`lib/path/unit-events.ts`). Called from the embedded review/reading
 * experiences when the learner finishes an activity inside a unit.
 *
 * Chapter mastery-gate hold (ADR 0043, issue #114): completing the last pre-A1 unit in
 * strict mode does not unlock A1 until the chapter gate is marked passed.
 */
import type { ContentRepository, Unit } from "@/lib/db";
import { recordCelebration } from "@/lib/gamification";

import {
  effectiveProgressionMode,
  isPreA1ChapterComplete,
  isPreA1ToA1Boundary,
  PRE_A1_CHAPTER_TIER,
  resolveChapterGateStatus,
  shouldHoldUnlockForChapterGate,
} from "./chapter-gate";
import { replenishPathBuffer } from "./replenish";
import { emitUnitCompleted } from "./unit-events";
import { completeActivity, nextUnitToUnlock } from "./unit-progress";

/** Injectable so tests can observe/stub the unit-completion replenishment trigger. */
export type ReplenishPathBufferFn = typeof replenishPathBuffer;

/**
 * Marks activity @activityIndex of unit @unitId done, persists the unit's new
 * activities/status, and — if that completes the unit — emits the completion event and
 * unlocks the next locked unit on the path (unless a strict chapter gate holds the
 * unlock). Idempotent: re-completing an already-done activity, or an unknown unit id, is
 * a silent no-op so a duplicate callback (e.g. a remounted embedded view) never
 * double-unlocks or double-emits.
 *
 * On completion, also fires the path-buffer replenishment trigger (ADR 0015, issue #61) —
 * deliberately **not** awaited: replenishment is a background, best-effort pass that must
 * never delay the caller's post-completion navigation.
 *
 * @param units the caller's already-loaded unit list (avoids a redundant fetch); must
 *   include @unitId for this to do anything.
 */
export async function completeUnitActivity(
  repo: ContentRepository,
  units: readonly Unit[],
  unitId: number,
  activityIndex: number,
  replenish: ReplenishPathBufferFn = replenishPathBuffer,
): Promise<void> {
  const unit = units.find((u) => u.id === unitId);
  if (!unit || unit.activities[activityIndex]?.done) return;

  const { activities, status } = completeActivity(unit, activityIndex);
  await repo.updateUnit(unitId, { activities, status });

  const completedAt = new Date();
  await recordCelebration(repo, {
    kind: "activity-complete",
    unitId: unit.id,
    activityIndex,
    at: completedAt,
  });

  if (status !== "completed") return;

  emitUnitCompleted({ unitId: unit.id, unitIndex: unit.index, completedAt });

  await recordCelebration(repo, {
    kind: "unit-complete",
    unitId: unit.id,
    unitIndex: unit.index,
    at: completedAt,
  });

  // Reflect this completion in the in-memory snapshot so chapter-complete checks see it.
  const unitsAfter = units.map((u) =>
    u.id === unitId ? { ...u, activities, status: "completed" as const } : u,
  );

  if (isPreA1ChapterComplete(unitsAfter)) {
    const existing = await repo.getChapterGate(PRE_A1_CHAPTER_TIER);
    // Only seed a pending gate when none exists — never overwrite fail/review/retake state.
    if (!existing) {
      await repo.saveChapterGate({
        tier: PRE_A1_CHAPTER_TIER,
        status: "pending",
        updatedAt: completedAt,
        reviewAssignment: null,
      });
    }
  }

  const next = nextUnitToUnlock(unitsAfter, { ...unit, activities, status: "completed" });
  if (next) {
    let hold = false;
    if (isPreA1ToA1Boundary(unit, next)) {
      const profile = await repo.getProfile();
      const gate = await repo.getChapterGate(PRE_A1_CHAPTER_TIER);
      hold = shouldHoldUnlockForChapterGate({
        completedUnit: unit,
        nextUnit: next,
        progressionMode: effectiveProgressionMode(
          profile ?? { experienceMode: undefined, settings: {} },
        ),
        gateStatus: resolveChapterGateStatus(gate),
      });
    }
    if (!hold) {
      await repo.updateUnit(next.id, { status: "available" });
    }
  }

  void replenish(repo);
}
