"use client";

import { useEffect, useState } from "react";

import { DEFAULT_EXPERIENCE_MODE, type ExperienceMode, type Unit } from "@/lib/db";
import { groupUnitsByChapter } from "@/lib/path/chapters";
import { replenishPathBuffer } from "@/lib/path/replenish";
import { ensurePath } from "@/lib/path/seed";
import { currentUnit } from "@/lib/path/unit-progress";
import { getContentRepository } from "@/lib/registry";
import { PathChapterMilestone } from "./path-chapter-milestone";
import { PathContinue } from "./path-continue";
import { PathNode } from "./path-node";
import { usePathProgression } from "./use-path-progression";

const MODE_HEADING: Record<ExperienceMode, string> = {
  kid: "Your adventure map",
  adult: "Your learning path",
};

/**
 * The home path as a visual journey (ADR 0015/0017, issue #62) — replacing the minimal list
 * from #57. Renders one shared component tree in both experience modes ("two renders, one
 * system"): `PathNode` and `PathChapterMilestone` read `mode` and switch register (adventure-
 * map/kid vs premium/adult) via classNames and copy, never a forked component tree. Palette
 * tokens (ADR 0017) do the rest of the visual differentiation automatically.
 *
 * Seeds the backbone path from the learner's profile on first visit — deterministic, offline,
 * no LLM call (ADR 0015). Renders nothing until units are loaded so it never flashes an empty
 * state on a fresh account. Once the backbone is visible, kicks off a best-effort path-buffer
 * replenishment pass (session-start trigger, ADR 0015, issue #61 — plans unplanned future
 * units, issue #58, and pre-generates their activity content, issue #61) and re-renders with
 * whatever it managed to fill in.
 */
export function LearningPath() {
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [mode, setMode] = useState<ExperienceMode>(DEFAULT_EXPERIENCE_MODE);

  useEffect(() => {
    let active = true;
    const repo = getContentRepository();

    void (async () => {
      const profile = await repo.getProfile();
      if (active) setMode(profile?.experienceMode ?? DEFAULT_EXPERIENCE_MODE);

      await ensurePath(repo, {
        cefrLevel: profile?.cefrLevel,
        goals: profile?.goals ?? [],
        createdAt: profile?.createdAt ?? new Date(),
        settings: profile?.settings ?? {},
        experienceMode: profile?.experienceMode,
      });
      const loaded = await repo.getUnits();
      if (active) setUnits(loaded);

      await replenishPathBuffer(repo, undefined, undefined, async () => {
        // Surface teacher plans as soon as they're persisted — don't wait for content
        // generation / embeddings, which can be slow or hang when the Mac is unreachable.
        if (active) setUnits(await repo.getUnits());
      });
      if (active) setUnits(await repo.getUnits());
    })();

    return () => {
      active = false;
    };
  }, []);

  const { fillingUnitIds, animatingChapterTiers, clearUnitFill, clearChapterAnim } =
    usePathProgression(units);

  if (!units || units.length === 0) return null;

  const chapters = groupUnitsByChapter(units);
  const current = currentUnit(units);

  return (
    <section data-testid="learning-path" data-experience-mode={mode} className="mt-10 w-full">
      <h2 className="text-foreground text-lg font-semibold tracking-tight">{MODE_HEADING[mode]}</h2>

      {current && (
        <div className="mt-4">
          <PathContinue unit={current} mode={mode} />
        </div>
      )}

      <ol className="mt-4 flex flex-col gap-2">
        {chapters.map((chapter, chapterIndex) => (
          <li key={chapter.tier}>
            <ol className="flex flex-col gap-2">
              {chapter.units.map((unit) => (
                <li key={unit.id}>
                  <PathNode
                    unit={unit}
                    mode={mode}
                    isCurrent={unit.id === current?.id}
                    playFillAnimation={fillingUnitIds.has(unit.id)}
                    onFillAnimationEnd={() => clearUnitFill(unit.id)}
                  />
                </li>
              ))}
            </ol>
            {chapter.isComplete && (
              <div className="mt-2">
                <PathChapterMilestone
                  tier={chapter.tier}
                  nextTier={chapters[chapterIndex + 1]?.tier}
                  mode={mode}
                  animateIn={animatingChapterTiers.has(chapter.tier)}
                  onAnimationEnd={() => clearChapterAnim(chapter.tier)}
                />
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
