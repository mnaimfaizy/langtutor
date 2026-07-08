/**
 * "Resume exactly where the learner left off" resolution (ADR 0015, issue #62 — visual
 * journey's one-tap continue affordance). Shared by the unit view's own next-activity button
 * and the home path's continue CTA so there is exactly one place that turns "the first
 * pending activity of a unit" into a concrete destination route.
 *
 * Client-side only (calls `generateActivityContent`, which hits the same-origin generation
 * routes) — mirrors `app/path/[id]/unit-view.tsx`'s pre-issue-#62 inline `startActivity`.
 */
import type { ContentRepository, Unit } from "@/lib/db";

import { generateActivityContent } from "./activity-content";
import { firstPendingActivityIndex } from "./unit-progress";

export interface ResumeTarget {
  href: string;
  activityIndex: number;
}

/** Injectable so tests can stub content generation without a real network call. */
export type GenerateActivityContentFn = typeof generateActivityContent;

/**
 * Resolves where @unit's first pending activity should navigate to, generating and caching
 * that activity's content first if it isn't already buffered (skipped entirely for `review`,
 * which needs no unit-specific content, and for any activity the path buffer already
 * generated ahead of time). Throws if generation fails (unreachable provider) — callers fall
 * back to the graceful-pause state (ADR 0015), matching the pre-existing unit-view behavior.
 *
 * Returns null only for the degenerate case of a unit with no activities at all.
 */
export async function resolveUnitResumeTarget(
  repo: ContentRepository,
  unit: Unit,
  generate: GenerateActivityContentFn = generateActivityContent,
): Promise<ResumeTarget | null> {
  const activityIndex = firstPendingActivityIndex(unit);
  const activity = unit.activities[activityIndex];
  if (!activity) return null;

  const query = `?unit=${unit.id}&activity=${activityIndex}`;

  if (activity.skill === "review") {
    return { href: `/review${query}`, activityIndex };
  }

  if (activity.contentId !== undefined) {
    return { href: `/${activity.skill}/${activity.contentId}${query}`, activityIndex };
  }

  const contentId = await generate(repo, unit, activity.skill);
  const activities = unit.activities.map((a, i) => (i === activityIndex ? { ...a, contentId } : a));
  await repo.updateUnit(unit.id, { activities });

  return { href: `/${activity.skill}/${contentId}${query}`, activityIndex };
}
