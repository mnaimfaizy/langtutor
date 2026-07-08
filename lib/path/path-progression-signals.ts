/**
 * Bridges unit-completion events to path-map fill animations (issue #84).
 *
 * `completeUnitActivity` emits via `onUnitCompleted` synchronously; the home path may not be
 * mounted yet. Pending unit ids accumulate here until `LearningPath` consumes them and plays
 * the `path-fill` motion on the matching node — same signal layer as collectible grants.
 */
import { onUnitCompleted } from "./unit-events";

const pendingFillUnitIds = new Set<number>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

onUnitCompleted((event) => {
  pendingFillUnitIds.add(event.unitId);
  notify();
});

/** Subscribes to new path-fill signals; returns an unsubscribe function. */
export function onPathFillPending(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Drains and clears any unit ids waiting for a fill animation on the path map. */
export function consumePendingPathFills(): number[] {
  const ids = [...pendingFillUnitIds];
  pendingFillUnitIds.clear();
  return ids;
}
