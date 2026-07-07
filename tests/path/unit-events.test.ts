import { describe, expect, it, vi } from "vitest";

import { emitUnitCompleted, onUnitCompleted } from "@/lib/path/unit-events";

describe("unit completion events", () => {
  it("notifies a subscribed listener with the event payload", () => {
    const listener = vi.fn();
    const unsubscribe = onUnitCompleted(listener);

    const event = { unitId: 1, unitIndex: 0, completedAt: new Date(0) };
    emitUnitCompleted(event);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(event);
    unsubscribe();
  });

  it("notifies every subscriber, in subscription order", () => {
    const calls: string[] = [];
    const unsubA = onUnitCompleted(() => calls.push("a"));
    const unsubB = onUnitCompleted(() => calls.push("b"));

    emitUnitCompleted({ unitId: 1, unitIndex: 0, completedAt: new Date(0) });

    expect(calls).toEqual(["a", "b"]);
    unsubA();
    unsubB();
  });

  it("stops notifying a listener once unsubscribed", () => {
    const listener = vi.fn();
    const unsubscribe = onUnitCompleted(listener);
    unsubscribe();

    emitUnitCompleted({ unitId: 1, unitIndex: 0, completedAt: new Date(0) });

    expect(listener).not.toHaveBeenCalled();
  });

  it("emitting with no subscribers is a silent no-op", () => {
    expect(() =>
      emitUnitCompleted({ unitId: 1, unitIndex: 0, completedAt: new Date(0) }),
    ).not.toThrow();
  });
});
