"use client";

import { useEffect, useState } from "react";

import type { SharedPathUnitTemplate, Unit } from "@/lib/db";
import { ensurePath } from "@/lib/path/seed";
import { getContentRepository } from "@/lib/registry";

/** Loads the real path units + approved catalog for the kid-island home. */
export function useKidIslandUnits(): {
  units: Unit[];
  templates: SharedPathUnitTemplate[];
  loading: boolean;
} {
  const [units, setUnits] = useState<Unit[]>([]);
  const [templates, setTemplates] = useState<SharedPathUnitTemplate[]>([]);
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
        const [loaded, approved] = await Promise.all([
          repo.getUnits(),
          repo.querySharedPathUnitTemplates({
            tier: "pre-A1",
            approvalStatus: "approved",
          }),
        ]);
        if (active) {
          // Island is pre-A1 only — include every densified unit, not a hardcoded cap.
          setUnits(loaded.filter((u) => u.index < 0).sort((a, b) => a.index - b.index));
          setTemplates(approved);
        }
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

  return { units, templates, loading };
}
