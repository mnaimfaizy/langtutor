/**
 * Unit-completion event emission (ADR 0015, issue #59 — unit player tracer).
 *
 * "Unit completion emits a completion event ... that workstream 5 (gamification) will
 * consume — the emission exists; no celebration UI here" (issue #59). This is a minimal
 * in-memory pub/sub: gamification's own issue will add a subscriber (XP/streak/achievement
 * hooks); nothing in this codebase subscribes yet. Deliberately not a persisted event log —
 * that's more machinery than a same-tab, same-session notification needs; revisit if a
 * durable/offline-replayable event record turns out to be required.
 */
export interface UnitCompletedEvent {
  unitId: number;
  unitIndex: number;
  completedAt: Date;
}

type UnitCompletedListener = (event: UnitCompletedEvent) => void;

const listeners = new Set<UnitCompletedListener>();

/** Subscribes to unit-completion events; returns an unsubscribe function. */
export function onUnitCompleted(listener: UnitCompletedListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Notifies every subscriber that a unit was completed. Synchronous, in-process only. */
export function emitUnitCompleted(event: UnitCompletedEvent): void {
  for (const listener of listeners) listener(event);
}
