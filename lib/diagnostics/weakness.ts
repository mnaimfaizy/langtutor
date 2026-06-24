import type { ErrorEventRecord, Weakness } from "@/lib/db";

/** Errors older than this many days are weighted at 50% of a fresh error. */
const HALF_LIFE_DAYS = 30;
const DECAY_RATE = Math.LN2 / HALF_LIFE_DAYS;

/**
 * Decay-weighted event count at which score reaches 0.5.
 * Formula: score = W / (W + K), where W = sum of per-event decay weights.
 * K=5 means 5 fully-fresh errors → score ≈ 0.5.
 */
const SATURATION_K = 5;

/**
 * Decay-weighted event count needed for full confidence (score=1.0 → "reliable estimate").
 * Below this, confidence is proportional to how much data we have.
 */
const CONFIDENCE_THRESHOLD = 10;

/**
 * Aggregate `errorEvents` into per-(skill × category × cefr) weakness scores.
 *
 * Each event contributes a weight that decays exponentially with age, with a 30-day
 * half-life. The resulting `score` is in [0, 1]: higher means weaker. `confidence`
 * reflects data density and reaches 1 once enough evidence has accumulated.
 *
 * @param events - All (or a filtered subset of) error events to roll up.
 * @param now    - Reference timestamp for age calculations (injected for testability).
 */
export function computeWeaknesses(events: ErrorEventRecord[], now: Date): Weakness[] {
  const nowMs = now.getTime();

  type GroupKey = string;
  type Group = {
    skill: Weakness["skill"];
    category: string;
    cefr: Weakness["cefr"];
    totalWeight: number;
  };
  const groups = new Map<GroupKey, Group>();

  for (const event of events) {
    const key = `${event.skill}|${event.category}|${event.cefr}`;
    if (!groups.has(key)) {
      groups.set(key, {
        skill: event.skill,
        category: event.category,
        cefr: event.cefr,
        totalWeight: 0,
      });
    }
    const ageDays = Math.max(0, (nowMs - event.createdAt.getTime()) / 86_400_000);
    groups.get(key)!.totalWeight += Math.exp(-DECAY_RATE * ageDays);
  }

  const result: Weakness[] = [];
  for (const { skill, category, cefr, totalWeight } of groups.values()) {
    const score = totalWeight / (totalWeight + SATURATION_K);
    const confidence = Math.min(1, totalWeight / CONFIDENCE_THRESHOLD);
    result.push({ skill, category, cefr, score, confidence, updatedAt: now });
  }
  return result;
}

/** Computed view of all weaknesses at a point in time. */
export interface WeaknessReport {
  weaknesses: Weakness[];
  computedAt: Date;
}
