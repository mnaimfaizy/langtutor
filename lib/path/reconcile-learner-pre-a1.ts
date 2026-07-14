/**
 * Reconcile an existing learner's pre-A1 units with the approved shared catalog.
 *
 * Fresh seeds only materialize when pre-A1 is empty; already-logged-in kids need this
 * pass so newly approved densification units appear (and pathIndex stays contiguous
 * for unlock-by-index+1).
 */
import type { ContentRepository, NewUnit, SharedPathUnitTemplate, Unit } from "@/lib/db";

import { materializePreA1UnitsFromCatalog } from "./shared-path-catalog";

/** Temp unit_index band while rewriting contiguous pre-A1 indices (unique user+index). */
const UNIT_INDEX_REWRITE_BASE = -1_000_000;

/**
 * After catalog inserts/remaps, ensure exactly one pre-A1 "head": the first
 * non-completed unit is available (or stays in-progress); later incomplete units lock.
 */
export async function normalizePreA1UnlockHead(repo: ContentRepository): Promise<void> {
  const preA1 = (await repo.getUnits())
    .filter((u) => u.index < 0)
    .slice()
    .sort((a, b) => a.index - b.index);

  let seenIncomplete = false;
  for (const unit of preA1) {
    if (unit.status === "completed") continue;
    if (!seenIncomplete) {
      seenIncomplete = true;
      if (unit.status === "locked") {
        await repo.updateUnit(unit.id, { status: "available" });
      }
      continue;
    }
    if (unit.status === "available") {
      await repo.updateUnit(unit.id, { status: "locked" });
    }
  }
}

/**
 * Match existing pre-A1 units to catalog rows by title, remap indexes, add missing.
 * Preserves status + activity done flags on matched units. Idempotent.
 */
export async function reconcileLearnerPreA1WithCatalog(
  repo: ContentRepository,
  templates: readonly SharedPathUnitTemplate[],
  now: Date = new Date(),
): Promise<void> {
  const desired = materializePreA1UnitsFromCatalog(templates, now);
  if (desired.length === 0) return;

  const units = await repo.getUnits();
  const existingPreA1 = units.filter((u) => u.index < 0);
  if (existingPreA1.length === 0) return;

  const byTitle = new Map(existingPreA1.map((u) => [u.title, u]));
  const matched: { unit: Unit; desired: NewUnit }[] = [];
  const toAdd: NewUnit[] = [];

  for (const row of desired) {
    const existing = byTitle.get(row.title);
    if (existing) {
      matched.push({ unit: existing, desired: row });
      byTitle.delete(row.title);
    } else {
      toAdd.push(row);
    }
  }

  // Nothing new and indexes already match → still normalize head (cheap) and return.
  const needsIndexRewrite = matched.some(({ unit, desired: row }) => unit.index !== row.index);
  if (!needsIndexRewrite && toAdd.length === 0 && byTitle.size === 0) {
    await normalizePreA1UnlockHead(repo);
    return;
  }

  // Unmatched existing pre-A1 rows keep progress but park below the approved block.
  const orphans = [...byTitle.values()];
  const finalPreA1Count = matched.length + toAdd.length + orphans.length;
  const orphanStart = -finalPreA1Count;

  type PlanItem = { id?: number; index: number; patch: Partial<NewUnit>; add?: NewUnit };
  const plan: PlanItem[] = [];

  for (const { unit, desired: row } of matched) {
    plan.push({
      id: unit.id,
      index: row.index,
      patch: {
        index: row.index,
        title: row.title,
        teacherNote: row.teacherNote,
        targetVocab: row.targetVocab.slice(),
        activities:
          unit.activities.length > 0
            ? unit.activities
            : row.activities.map((a) => ({ skill: a.skill })),
      },
    });
  }

  let orphanOffset = 0;
  for (const orphan of orphans.sort((a, b) => a.index - b.index)) {
    plan.push({
      id: orphan.id,
      index: orphanStart + orphanOffset,
      patch: { index: orphanStart + orphanOffset },
    });
    orphanOffset += 1;
  }

  for (const row of toAdd) {
    plan.push({
      index: row.index,
      patch: {},
      add: {
        ...row,
        status: "locked",
        activities: row.activities.map((a) => ({ skill: a.skill })),
      },
    });
  }

  const updates = plan.filter((p) => p.id !== undefined);
  for (let i = 0; i < updates.length; i++) {
    const item = updates[i]!;
    await repo.updateUnit(item.id!, { index: UNIT_INDEX_REWRITE_BASE - i });
  }
  for (const item of updates) {
    await repo.updateUnit(item.id!, item.patch);
  }

  for (const item of plan) {
    if (item.add) {
      await repo.addUnit(item.add);
    }
  }

  await normalizePreA1UnlockHead(repo);
}
