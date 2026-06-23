import type { Cefr, NewErrorEvent } from "@/lib/db";

import type { WerAlignment } from "./wer";

/** Maps each non-correct WER alignment token to a diagnostics error event. */
export function createListeningErrorEvents(
  alignment: WerAlignment[],
  cefr: Cefr,
  now?: Date,
): NewErrorEvent[] {
  const ts = now ?? new Date();
  return alignment
    .filter((a) => a.type !== "correct")
    .map((a) => ({
      skill: "listening" as const,
      category: a.type,
      cefr,
      context: a.ref ?? a.hyp ?? "",
      createdAt: ts,
    }));
}
