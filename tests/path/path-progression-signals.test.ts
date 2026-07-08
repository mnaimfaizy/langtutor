import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitUnitCompleted } from "@/lib/path/unit-events";
import { consumePendingPathFills, onPathFillPending } from "@/lib/path/path-progression-signals";

describe("path-progression-signals", () => {
  beforeEach(() => {
    consumePendingPathFills();
  });

  afterEach(() => {
    consumePendingPathFills();
  });

  it("queues a unit id when a unit completes", () => {
    emitUnitCompleted({ unitId: 7, unitIndex: 2, completedAt: new Date(0) });

    expect(consumePendingPathFills()).toEqual([7]);
  });

  it("drains pending fills and clears the queue", () => {
    emitUnitCompleted({ unitId: 1, unitIndex: 0, completedAt: new Date(0) });
    emitUnitCompleted({ unitId: 2, unitIndex: 1, completedAt: new Date(0) });

    expect(consumePendingPathFills().sort()).toEqual([1, 2]);
    expect(consumePendingPathFills()).toEqual([]);
  });

  it("notifies subscribers when a fill is queued", () => {
    const listener = vi.fn();
    const unsubscribe = onPathFillPending(listener);

    emitUnitCompleted({ unitId: 9, unitIndex: 0, completedAt: new Date(0) });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(consumePendingPathFills()).toEqual([9]);

    unsubscribe();
  });
});
