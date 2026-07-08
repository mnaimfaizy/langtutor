import { describe, expect, it } from "vitest";

import { ACHIEVEMENT_DEFS } from "@/lib/gamification/achievements";
import { buildCollectionCatalogue, resolveCollectionEarned } from "@/lib/gamification/collection";
import { COLLECTIBLE_DEFS } from "@/lib/gamification/collectibles";

const NOW = new Date("2025-06-01T12:00:00Z");
const LATER = new Date("2025-06-02T12:00:00Z");

describe("buildCollectionCatalogue", () => {
  it("includes every creature and achievement definition", () => {
    const catalogue = buildCollectionCatalogue();
    expect(catalogue).toHaveLength(COLLECTIBLE_DEFS.length + ACHIEVEMENT_DEFS.length);
  });

  it("lists creatures before achievements", () => {
    const catalogue = buildCollectionCatalogue();
    const firstAchievementIdx = catalogue.findIndex((item) => item.kind === "achievement");
    expect(firstAchievementIdx).toBe(COLLECTIBLE_DEFS.length);
    expect(catalogue.slice(0, firstAchievementIdx).every((item) => item.kind === "creature")).toBe(
      true,
    );
  });

  it("maps achievements without image art", () => {
    const achievement = buildCollectionCatalogue().find((item) => item.id === "first_review");
    expect(achievement).toMatchObject({
      kind: "achievement",
      icon: "🌱",
      label: "First steps",
    });
    expect(achievement).not.toHaveProperty("imageSrc");
  });
});

describe("resolveCollectionEarned", () => {
  it("marks collectibles earned when any grant exists for that id", () => {
    const earned = resolveCollectionEarned(
      [{ collectibleId: "creature-fox", unitId: 1, grantedAt: NOW }],
      [],
    );
    expect(earned.get("creature-fox")).toEqual({ earned: true, earnedAt: NOW });
    expect(earned.get("creature-owl")?.earned).toBe(false);
  });

  it("uses the earliest grant date when the same collectible is earned twice", () => {
    const earned = resolveCollectionEarned(
      [
        { collectibleId: "creature-fox", unitId: 1, grantedAt: LATER },
        { collectibleId: "creature-fox", unitId: 2, grantedAt: NOW },
      ],
      [],
    );
    expect(earned.get("creature-fox")).toEqual({ earned: true, earnedAt: NOW });
  });

  it("reads pre-existing achievements without re-grant", () => {
    const earned = resolveCollectionEarned([], [{ id: "xp_50", unlockedAt: NOW }]);
    expect(earned.get("xp_50")).toEqual({ earned: true, earnedAt: NOW });
    expect(earned.get("xp_200")?.earned).toBe(false);
  });

  it("covers every catalogue id", () => {
    const earned = resolveCollectionEarned([], []);
    for (const item of buildCollectionCatalogue()) {
      expect(earned.has(item.id)).toBe(true);
      expect(earned.get(item.id)?.earned).toBe(false);
    }
  });
});
