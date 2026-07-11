"use client";

import { useEffect, useState } from "react";

import type { Unit } from "@/lib/db";
import { ensurePath } from "@/lib/path/seed";
import { getContentRepository } from "@/lib/registry";

/** Loads the real path units for the kid-island home — same repo/seed calls as the standard path. */
export function useKidIslandUnits(): { units: Unit[]; loading: boolean } {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const repo = getContentRepository();

    void (async () => {
      try {
        const profile = await repo.getProfile();
        await ensurePath(repo, {
          cefrLevel: profile?.cefrLevel,
          goals: profile?.goals ?? [],
          createdAt: profile?.createdAt ?? new Date(),
          settings: profile?.settings ?? {},
          experienceMode: profile?.experienceMode,
        });
        const loaded = await repo.getUnits();
        if (active) setUnits(loaded.slice(0, 8));
      } catch (error) {
        console.error("[kid-island] failed to load path units", error);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return { units, loading };
}
