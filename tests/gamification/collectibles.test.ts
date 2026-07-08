import { afterEach, describe, expect, it, vi } from "vitest";

import type { CollectibleGrant, ContentRepository } from "@/lib/db";
import {
  COLLECTIBLE_DEFS,
  getCollectibleDefForUnitIndex,
  grantCollectibleForUnit,
} from "@/lib/gamification/collectibles";
import { emitUnitCompleted, onUnitCompleted } from "@/lib/path/unit-events";

const NOW = new Date("2025-06-01T12:00:00Z");

function makeFakeRepo(): ContentRepository & { grants: CollectibleGrant[] } {
  const state = { grants: [] as CollectibleGrant[] };
  return {
    grants: state.grants,
    async getCollectibles() {
      return state.grants.slice();
    },
    async grantCollectible(collectibleId: string, unitId: number, grantedAt: Date) {
      const existing = state.grants.find(
        (g) => g.collectibleId === collectibleId && g.unitId === unitId,
      );
      if (existing) return;
      state.grants.push({ collectibleId, unitId, grantedAt });
    },
  } as unknown as ContentRepository & { grants: CollectibleGrant[] };
}

describe("COLLECTIBLE_DEFS", () => {
  it("has at least 4 collectibles", () =>
    expect(COLLECTIBLE_DEFS.length).toBeGreaterThanOrEqual(4));

  it("all ids are unique", () => {
    const ids = COLLECTIBLE_DEFS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all have non-empty labels and image sources", () => {
    COLLECTIBLE_DEFS.forEach((c) => {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.imageSrc.startsWith("/collectibles/")).toBe(true);
    });
  });
});

describe("getCollectibleDefForUnitIndex", () => {
  it("maps pre-A1 unit indices to themed starters", () => {
    expect(getCollectibleDefForUnitIndex(-4)?.id).toBe("creature-alphie");
    expect(getCollectibleDefForUnitIndex(-1)?.id).toBe("creature-tappy");
  });

  it("cycles the path pool for A1+ indices", () => {
    expect(getCollectibleDefForUnitIndex(0)?.id).toBe("creature-fox");
    expect(getCollectibleDefForUnitIndex(1)?.id).toBe("creature-owl");
    expect(getCollectibleDefForUnitIndex(4)?.id).toBe("creature-fox");
  });
});

describe("grantCollectibleForUnit", () => {
  let unsubscribe: (() => void) | null = null;

  afterEach(() => {
    unsubscribe?.();
    unsubscribe = null;
  });

  it("grants exactly one collectible for a completed unit", async () => {
    const repo = makeFakeRepo();

    const def = await grantCollectibleForUnit(repo, 42, 0, NOW);

    expect(def?.id).toBe("creature-fox");
    expect(await repo.getCollectibles()).toEqual([
      { collectibleId: "creature-fox", unitId: 42, grantedAt: NOW },
    ]);
  });

  it("grants once when the same unit completes twice (idempotent)", async () => {
    const repo = makeFakeRepo();

    await grantCollectibleForUnit(repo, 42, 0, NOW);
    const second = await grantCollectibleForUnit(repo, 42, 0, new Date("2025-06-02T12:00:00Z"));

    expect(second).toBeNull();
    expect(await repo.getCollectibles()).toHaveLength(1);
    expect((await repo.getCollectibles())[0]?.grantedAt).toEqual(NOW);
  });

  it("grants via onUnitCompleted subscription with a controlled clock", async () => {
    const repo = makeFakeRepo();
    const granted: string[] = [];

    unsubscribe = onUnitCompleted((event) => {
      void grantCollectibleForUnit(repo, event.unitId, event.unitIndex, event.completedAt).then(
        (def) => {
          if (def) granted.push(def.id);
        },
      );
    });

    emitUnitCompleted({ unitId: 7, unitIndex: -4, completedAt: NOW });
    await vi.waitFor(() => expect(granted).toEqual(["creature-alphie"]));

    emitUnitCompleted({
      unitId: 7,
      unitIndex: -4,
      completedAt: new Date("2025-06-02T12:00:00Z"),
    });
    await vi.waitFor(() => expect(granted).toEqual(["creature-alphie"]));

    expect(await repo.getCollectibles()).toHaveLength(1);
  });
});
