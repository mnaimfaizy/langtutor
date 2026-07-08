/**
 * Unit unlock/completion state machine (ADR 0015, issue #59 — unit player tracer).
 *
 * Pure and side-effect free: takes the current unit/path state and returns the patch to
 * persist. Callers (`lib/path/unit-player.ts`) are responsible for the actual
 * `ContentRepository.updateUnit` writes and any event emission.
 */
import type { Unit, UnitActivityRef, UnitStatus } from "@/lib/db";

/** The persisted fields a completed activity changes on its unit. */
export interface ActivityCompletionPatch {
  activities: UnitActivityRef[];
  status: UnitStatus;
}

/**
 * Index of the first not-yet-done activity in @unit, or `unit.activities.length` if every
 * activity is done (including the degenerate empty-activities case). Used both to render
 * the unit view's "next activity" affordance and to resume a partially-done unit at the
 * right place.
 */
export function firstPendingActivityIndex(unit: Unit): number {
  const idx = unit.activities.findIndex((activity) => !activity.done);
  return idx === -1 ? unit.activities.length : idx;
}

/** Whether every activity in @unit is done. A unit with no activities is never "complete". */
export function isUnitComplete(unit: Unit): boolean {
  return unit.activities.length > 0 && unit.activities.every((activity) => activity.done);
}

/**
 * Marks the activity at @activityIndex done and derives the unit's new status: `completed`
 * once every activity is done, `in-progress` otherwise (covers both "just started" — was
 * `available` — and "still going"). Never regresses a unit past `completed`; the caller
 * should treat re-completing an already-done activity as a no-op (see `unit-player.ts`).
 */
export function completeActivity(unit: Unit, activityIndex: number): ActivityCompletionPatch {
  const activities = unit.activities.map((activity, i) =>
    i === activityIndex ? { ...activity, done: true } : activity,
  );
  const status: UnitStatus = activities.every((activity) => activity.done)
    ? "completed"
    : "in-progress";
  return { activities, status };
}

/**
 * The next unit on the path after @completedUnit, if one exists and is still `locked`.
 * Returns null when there is no next unit (end of path) or it's already unlocked —
 * unlocking is a one-way, idempotent transition.
 */
export function nextUnitToUnlock(units: readonly Unit[], completedUnit: Unit): Unit | null {
  const next = units.find((u) => u.index === completedUnit.index + 1);
  return next && next.status === "locked" ? next : null;
}

/**
 * The learner's single "current" unit on the path (issue #62 — visual journey), i.e. the
 * node the journey's one-tap continue affordance resumes and the node rendering treats as
 * prominent. Prefers an `in-progress` unit (already started) over the next `available` one
 * (not yet started) — at most one of each can exist at a time under the unlock state machine
 * above, but preferring in-progress is also correct if that ever changes. Returns null when
 * every unit is `locked`/`completed` (nothing to resume — e.g. the whole seeded path is done,
 * or the buffer hasn't unlocked anything yet).
 */
export function currentUnit(units: readonly Unit[]): Unit | null {
  return (
    units.find((u) => u.status === "in-progress") ??
    units.find((u) => u.status === "available") ??
    null
  );
}
