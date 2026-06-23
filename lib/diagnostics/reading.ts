import type { Cefr, NewErrorEvent } from "@/lib/db";

/** Creates a reading comprehension error event for a wrong answer. */
export function createReadingErrorEvent(params: {
  question: string;
  category: string;
  cefr: Cefr;
  now?: Date;
}): NewErrorEvent {
  return {
    skill: "reading",
    category: params.category,
    cefr: params.cefr,
    context: params.question,
    createdAt: params.now ?? new Date(),
  };
}
