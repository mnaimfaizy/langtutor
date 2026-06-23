import type { Cefr, NewErrorEvent } from "@/lib/db";

import type { WerAlignment } from "./wer";

/** Creates a listening comprehension error event for a wrong quiz answer. */
export function createListeningComprehensionErrorEvent(params: {
  question: string;
  category: string;
  cefr: Cefr;
  now?: Date;
}): NewErrorEvent {
  return {
    skill: "listening",
    category: params.category,
    cefr: params.cefr,
    context: params.question,
    createdAt: params.now ?? new Date(),
  };
}

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
