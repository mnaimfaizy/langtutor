"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Unit } from "@/lib/db";
import { chapterTierCompletedByUnit } from "@/lib/path/chapters";
import type { PathTier } from "@/lib/path/pre-a1";
import { consumePendingPathFills, onPathFillPending } from "@/lib/path/path-progression-signals";

function mergeIds(prev: Set<number>, ids: readonly number[]): Set<number> {
  if (ids.length === 0) return prev;
  const next = new Set(prev);
  for (const id of ids) next.add(id);
  return next;
}

function chapterTiersForFill(units: readonly Unit[], unitIds: readonly number[]): PathTier[] {
  const tiers: PathTier[] = [];
  for (const unitId of unitIds) {
    const tier = chapterTierCompletedByUnit(units, unitId);
    if (tier) tiers.push(tier);
  }
  return tiers;
}

/**
 * Tracks which path nodes should play the `path-fill` completion animation, driven by the
 * unit-completion signal (`onUnitCompleted` → {@link consumePendingPathFills}).
 */
export function usePathProgression(units: Unit[] | null) {
  const unitsRef = useRef(units);

  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

  const [fillingUnitIds, setFillingUnitIds] = useState<Set<number>>(
    () => new Set(consumePendingPathFills()),
  );
  const [dismissedChapterTiers, setDismissedChapterTiers] = useState<Set<PathTier>>(
    () => new Set(),
  );

  useEffect(() => {
    return onPathFillPending(() => {
      const ids = consumePendingPathFills();
      if (ids.length === 0) return;

      setFillingUnitIds((prev) => mergeIds(prev, ids));

      const currentUnits = unitsRef.current;
      if (!currentUnits) return;

      const tiers = chapterTiersForFill(currentUnits, ids);
      if (tiers.length === 0) return;

      setDismissedChapterTiers((prev) => {
        const next = new Set(prev);
        for (const tier of tiers) next.delete(tier);
        return next;
      });
    });
  }, []);

  const animatingChapterTiers = useMemo(() => {
    if (!units || fillingUnitIds.size === 0) return new Set<PathTier>();
    const tiers = chapterTiersForFill(units, [...fillingUnitIds]);
    return new Set(tiers.filter((tier) => !dismissedChapterTiers.has(tier)));
  }, [units, fillingUnitIds, dismissedChapterTiers]);

  const clearUnitFill = useCallback((unitId: number) => {
    setFillingUnitIds((prev) => {
      if (!prev.has(unitId)) return prev;
      const next = new Set(prev);
      next.delete(unitId);
      return next;
    });
  }, []);

  const clearChapterAnim = useCallback((tier: PathTier) => {
    setDismissedChapterTiers((prev) => {
      if (prev.has(tier)) return prev;
      const next = new Set(prev);
      next.add(tier);
      return next;
    });
  }, []);

  return { fillingUnitIds, animatingChapterTiers, clearUnitFill, clearChapterAnim };
}
