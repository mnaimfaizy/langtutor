import type { Correction } from "@/lib/content/feedback";
import type { Cefr, NewErrorEvent } from "@/lib/db";

/** Maps each correction from a writing feedback response to a diagnostics error event. */
export function createWritingErrorEvents(
  corrections: Correction[],
  cefr: Cefr,
  now?: Date,
): NewErrorEvent[] {
  const ts = now ?? new Date();
  return corrections.map((c) => ({
    skill: "writing",
    category: c.category,
    cefr,
    context: c.original,
    createdAt: ts,
  }));
}
