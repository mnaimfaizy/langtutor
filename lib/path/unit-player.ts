/**
 * Unit player orchestration (ADR 0015, issue #59 — unit player tracer).
 *
 * Wires the pure state machine (`lib/path/unit-progress.ts`) to the repository and the
 * completion event (`lib/path/unit-events.ts`). Called from the embedded review/reading
 * experiences when the learner finishes an activity inside a unit.
 */
import type { ContentRepository, Unit } from "@/lib/db";
import { recordCelebration } from "@/lib/gamification";

import { replenishPathBuffer } from "./replenish";
import { emitUnitCompleted } from "./unit-events";
import { completeActivity, nextUnitToUnlock } from "./unit-progress";

/** Injectable so tests can observe/stub the unit-completion replenishment trigger. */
export type ReplenishPathBufferFn = typeof replenishPathBuffer;

/**
 * Marks activity @activityIndex of unit @unitId done, persists the unit's new
 * activities/status, and — if that completes the unit — emits the completion event and
 * unlocks the next locked unit on the path. Idempotent: re-completing an already-done
 * activity, or an unknown unit id, is a silent no-op so a duplicate callback (e.g. a
 * remounted embedded view) never double-unlocks or double-emits.
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

  if (status !== "completed") return;

  const completedAt = new Date();
  emitUnitCompleted({ unitId: unit.id, unitIndex: unit.index, completedAt });

  await recordCelebration(repo, {
    kind: "unit-complete",
    unitId: unit.id,
    unitIndex: unit.index,
    at: completedAt,
  });

  const next = nextUnitToUnlock(units, unit);
  if (next) {
    await repo.updateUnit(next.id, { status: "available" });
  }

  void replenish(repo);
}
