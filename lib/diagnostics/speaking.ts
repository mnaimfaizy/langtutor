import type { Cefr, NewErrorEvent } from "@/lib/db";

import type { WerAlignment } from "./wer";
import { createWerErrorEvents } from "./wer-error-events";

/** Maps each non-correct WER alignment token to a speaking diagnostics error event. */
export function createSpeakingErrorEvents(
  alignment: WerAlignment[],
  cefr: Cefr,
  now?: Date,
): NewErrorEvent[] {
  return createWerErrorEvents(alignment, "speaking", cefr, now);
}
