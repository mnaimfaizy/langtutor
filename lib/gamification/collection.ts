import type { Achievement, CollectibleGrant } from "@/lib/db";

import { ACHIEVEMENT_DEFS } from "./achievements";
import { COLLECTIBLE_DEFS } from "./collectibles";

export type CollectionItemKind = "creature" | "achievement";

/** Unified catalogue entry for the collection screen — creatures plus migrated achievements. */
export interface CollectionItem {
  id: string;
  kind: CollectionItemKind;
  icon: string;
  label: string;
  description: string;
  imageSrc?: string;
}

export interface CollectionEarnedState {
  earned: boolean;
  earnedAt?: Date;
}

/** Every collectible definition plus each legacy achievement, in display order. */
export function buildCollectionCatalogue(): CollectionItem[] {
  const creatures: CollectionItem[] = COLLECTIBLE_DEFS.map((def) => ({
    id: def.id,
    kind: "creature",
    icon: def.icon,
    label: def.label,
    description: def.description,
    imageSrc: def.imageSrc,
  }));

  const achievements: CollectionItem[] = ACHIEVEMENT_DEFS.map((def) => ({
    id: def.id,
    kind: "achievement",
    icon: def.icon,
    label: def.label,
    description: def.description,
  }));

  return [...creatures, ...achievements];
}

/**
 * Resolves earned/locked state per catalogue id. Collectibles are earned when any grant
 * exists for that `collectibleId`; achievements read from persisted `gamification.achievements`.
 */
export function resolveCollectionEarned(
  grants: readonly CollectibleGrant[],
  achievements: readonly Achievement[],
): Map<string, CollectionEarnedState> {
  const earliestGrantByCollectible = new Map<string, Date>();
  for (const grant of grants) {
    const prev = earliestGrantByCollectible.get(grant.collectibleId);
    if (!prev || grant.grantedAt < prev) {
      earliestGrantByCollectible.set(grant.collectibleId, grant.grantedAt);
    }
  }

  const achievementById = new Map(achievements.map((a) => [a.id, a]));
  const result = new Map<string, CollectionEarnedState>();

  for (const def of COLLECTIBLE_DEFS) {
    const earnedAt = earliestGrantByCollectible.get(def.id);
    result.set(def.id, { earned: earnedAt !== undefined, earnedAt });
  }

  for (const def of ACHIEVEMENT_DEFS) {
    const unlocked = achievementById.get(def.id);
    result.set(def.id, {
      earned: unlocked !== undefined,
      earnedAt: unlocked?.unlockedAt,
    });
  }

  return result;
}
