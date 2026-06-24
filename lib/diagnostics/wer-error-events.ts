import type { Cefr, NewErrorEvent } from "@/lib/db";

import type { WerAlignment } from "./wer";

/** Shared helper: maps non-correct WER alignment tokens to diagnostic error events. */
export function createWerErrorEvents(
  alignment: WerAlignment[],
  skill: "listening" | "speaking",
  cefr: Cefr,
  now?: Date,
): NewErrorEvent[] {
  const ts = now ?? new Date();
  return alignment
    .filter((a) => a.type !== "correct")
    .map((a) => ({
      skill,
      category: a.type,
      cefr,
      context: a.ref ?? a.hyp ?? "",
      createdAt: ts,
    }));
}
