"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Shared "embedded in a unit" plumbing for the module experiences the unit player deep-links
// into (review, reading — issue #59; listening, writing, speaking — issue #60). Standalone
// module routes never carry `unit`/`activity` search params, so `useEmbeddedActivity` returns
// null and every embedded-only affordance in those modules stays hidden — standalone behavior
// is unchanged (issue #59/#60 acceptance criteria).

export interface EmbeddedActivity {
  unitId: number;
  activityIndex: number;
}

/** Reads the `unit`/`activity` search params a unit-player deep link carries, if present. */
export function useEmbeddedActivity(): EmbeddedActivity | null {
  const searchParams = useSearchParams();
  const unitParam = searchParams.get("unit");
  const activityParam = searchParams.get("activity");
  if (unitParam === null || activityParam === null) return null;

  const unitId = Number(unitParam);
  const activityIndex = Number(activityParam);
  if (!Number.isInteger(unitId) || !Number.isInteger(activityIndex)) return null;

  return { unitId, activityIndex };
}

/** Builds the search-param suffix to deep-link into a module experience from a unit. */
export function embeddedActivityQuery({ unitId, activityIndex }: EmbeddedActivity): string {
  return `?unit=${unitId}&activity=${activityIndex}`;
}

/** "You're inside a unit session" framing with a way back, shown by embedded module views. */
export function EmbeddedUnitBanner({ unitId }: { unitId: number }) {
  return (
    <div
      data-testid="embedded-unit-banner"
      className="border-accent/30 bg-accent/10 text-accent mb-6 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm"
    >
      <span>Part of your learning path</span>
      <Link href={`/path/${unitId}`} className="font-medium underline-offset-2 hover:underline">
        Back to unit
      </Link>
    </div>
  );
}

/** Admin try-out of a shared path draft — no learner progress is written. */
export function PreviewTemplateBanner({ templateId }: { templateId: string }) {
  return (
    <div
      data-testid="preview-template-banner"
      className="border-warning/40 bg-warning/10 text-warning mb-6 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm"
    >
      <span>Admin try-out — progress is not saved. Template {templateId}</span>
      <Link href="/admin/path" className="font-medium underline-offset-2 hover:underline">
        Back to shared path
      </Link>
    </div>
  );
}
