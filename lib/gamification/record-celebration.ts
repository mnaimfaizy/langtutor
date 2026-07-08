import type { ContentRepository } from "@/lib/db";

import type { CelebrationEvent } from "./celebration-event";
import { applyCelebrationToQuests, rolloverDailyQuests, rolloverWeeklyQuests } from "./quests";
import { localDateString } from "./streak";

type QuestRepo = Pick<ContentRepository, "getQuestState" | "saveQuestState">;

/**
 * Rolls daily quests if needed, applies the celebration event, and persists quest state.
 * Called from review-session completion and unit-player activity/unit completion.
 */
export async function recordCelebration(repo: QuestRepo, event: CelebrationEvent): Promise<void> {
  const today = localDateString(event.at);
  const current = await repo.getQuestState();
  const dailyRolled = rolloverDailyQuests(current, today);
  const rolled = rolloverWeeklyQuests(dailyRolled, today);
  const updated = applyCelebrationToQuests(rolled, event);
  await repo.saveQuestState(updated);
}
