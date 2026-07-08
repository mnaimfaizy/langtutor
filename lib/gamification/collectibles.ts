import type { ContentRepository, CollectibleGrant } from "@/lib/db";

export interface CollectibleDef {
  id: string;
  /** Short emoji shown when the image is unavailable. */
  icon: string;
  label: string;
  description: string;
  /** Bundled art asset served from `public/collectibles/`. */
  imageSrc: string;
}

/** Static collectible catalogue — extended by the collection-screen slice. */
export const COLLECTIBLE_DEFS: CollectibleDef[] = [
  {
    id: "creature-alphie",
    icon: "🔤",
    label: "Alphie",
    description: "Earned by completing the Alphabet unit.",
    imageSrc: "/collectibles/alphie.svg",
  },
  {
    id: "creature-phonix",
    icon: "🎵",
    label: "Phonix",
    description: "Earned by completing the Phonics unit.",
    imageSrc: "/collectibles/phonix.svg",
  },
  {
    id: "creature-picto",
    icon: "🖼️",
    label: "Picto",
    description: "Earned by completing the Picture words unit.",
    imageSrc: "/collectibles/picto.svg",
  },
  {
    id: "creature-tappy",
    icon: "👂",
    label: "Tappy",
    description: "Earned by completing the Listen & tap unit.",
    imageSrc: "/collectibles/tappy.svg",
  },
  {
    id: "creature-fox",
    icon: "🦊",
    label: "Foxy",
    description: "Earned by completing a learning-path unit.",
    imageSrc: "/collectibles/fox.svg",
  },
  {
    id: "creature-owl",
    icon: "🦉",
    label: "Owlie",
    description: "Earned by completing a learning-path unit.",
    imageSrc: "/collectibles/owl.svg",
  },
  {
    id: "creature-bunny",
    icon: "🐰",
    label: "Bunbun",
    description: "Earned by completing a learning-path unit.",
    imageSrc: "/collectibles/bunny.svg",
  },
  {
    id: "creature-frog",
    icon: "🐸",
    label: "Ribbit",
    description: "Earned by completing a learning-path unit.",
    imageSrc: "/collectibles/frog.svg",
  },
];

const COLLECTIBLE_BY_ID = new Map(COLLECTIBLE_DEFS.map((d) => [d.id, d]));

/** Pre-A1 units map to themed starters; A1+ units cycle through the path pool. */
const PRE_A1_COLLECTIBLE_IDS: Record<number, string> = {
  [-4]: "creature-alphie",
  [-3]: "creature-phonix",
  [-2]: "creature-picto",
  [-1]: "creature-tappy",
};

const PATH_POOL_IDS = ["creature-fox", "creature-owl", "creature-bunny", "creature-frog"] as const;

/** Resolves the collectible definition earned by completing a unit at @unitIndex. */
export function getCollectibleDefForUnitIndex(unitIndex: number): CollectibleDef | undefined {
  const preA1Id = PRE_A1_COLLECTIBLE_IDS[unitIndex];
  if (preA1Id) return COLLECTIBLE_BY_ID.get(preA1Id);

  if (unitIndex < 0) return undefined;

  const poolIndex =
    ((unitIndex % PATH_POOL_IDS.length) + PATH_POOL_IDS.length) % PATH_POOL_IDS.length;
  return COLLECTIBLE_BY_ID.get(PATH_POOL_IDS[poolIndex]!);
}

type CollectibleRepo = Pick<ContentRepository, "getCollectibles" | "grantCollectible">;

function alreadyGrantedForUnit(grants: readonly CollectibleGrant[], unitId: number): boolean {
  return grants.some((g) => g.unitId === unitId);
}

/**
 * Grants the collectible for a completed unit, idempotent per unit id — completing the same
 * unit twice returns `null` on the second call (prior art: achievement-unlock idempotency).
 */
export async function grantCollectibleForUnit(
  repo: CollectibleRepo,
  unitId: number,
  unitIndex: number,
  grantedAt: Date,
): Promise<CollectibleDef | null> {
  const def = getCollectibleDefForUnitIndex(unitIndex);
  if (!def) return null;

  const grants = await repo.getCollectibles();
  if (alreadyGrantedForUnit(grants, unitId)) return null;

  await repo.grantCollectible(def.id, unitId, grantedAt);
  return def;
}
