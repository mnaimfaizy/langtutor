/**
 * Unit player orchestration (ADR 0015, issue #59 — unit player tracer).
 *
 * Wires the pure state machine (`lib/path/unit-progress.ts`) to the repository and the
 * completion event (`lib/path/unit-events.ts`). Called from the embedded review/reading
 * experiences when the learner finishes an activity inside a unit.
 */
import type { ContentRepository, Unit } from "@/lib/db";

import { emitUnitCompleted } from "./unit-events";
import { completeActivity, nextUnitToUnlock } from "./unit-progress";

/**
 * Marks activity @activityIndex of unit @unitId done, persists the unit's new
 * activities/status, and — if that completes the unit — emits the completion event and
 * unlocks the next locked unit on the path. Idempotent: re-completing an already-done
 * activity, or an unknown unit id, is a silent no-op so a duplicate callback (e.g. a
 * remounted embedded view) never double-unlocks or double-emits.
 *
 * @param units the caller's already-loaded unit list (avoids a redundant fetch); must
 *   include @unitId for this to do anything.
 */
export async function completeUnitActivity(
  repo: ContentRepository,
  units: readonly Unit[],
  unitId: number,
  activityIndex: number,
): Promise<void> {
  const unit = units.find((u) => u.id === unitId);
  if (!unit || unit.activities[activityIndex]?.done) return;

  const { activities, status } = completeActivity(unit, activityIndex);
  await repo.updateUnit(unitId, { activities, status });

  if (status !== "completed") return;

  emitUnitCompleted({ unitId: unit.id, unitIndex: unit.index, completedAt: new Date() });

  const next = nextUnitToUnlock(units, unit);
  if (next) {
    await repo.updateUnit(next.id, { status: "available" });
  }
}
