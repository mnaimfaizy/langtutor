import type { Cefr, NewErrorEvent } from "@/lib/db";

import type { WerAlignment } from "./wer";
import { createWerErrorEvents } from "./wer-error-events";

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
  return createWerErrorEvents(alignment, "listening", cefr, now);
}
