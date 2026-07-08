import type { QuestProgressEntry, QuestState } from "@/lib/db";

import type { CelebrationEvent } from "./celebration-event";

export type DailyQuestKind = "word-review-count" | "unit-finish" | "review-session";

export interface DailyQuestDef {
  id: string;
  icon: string;
  label: string;
  description: string;
  target: number;
  kind: DailyQuestKind;
}

/** Static daily quest catalogue — extended by the weekly-quest slice. */
export const DAILY_QUEST_DEFS: DailyQuestDef[] = [
  {
    id: "daily-review-10",
    icon: "📚",
    label: "Review 10 words",
    description: "Rate 10 vocabulary cards in a review session.",
    target: 10,
    kind: "word-review-count",
  },
  {
    id: "daily-finish-unit",
    icon: "🗺️",
    label: "Finish 1 unit",
    description: "Complete every activity in a learning-path unit.",
    target: 1,
    kind: "unit-finish",
  },
  {
    id: "daily-review-session",
    icon: "✅",
    label: "Complete a review",
    description: "Finish at least one review session today.",
    target: 1,
    kind: "review-session",
  },
];

const DAILY_QUEST_IDS = new Set(DAILY_QUEST_DEFS.map((d) => d.id));
const DAILY_QUEST_BY_ID = new Map(DAILY_QUEST_DEFS.map((d) => [d.id, d]));

function freshDailyEntries(): QuestProgressEntry[] {
  return DAILY_QUEST_DEFS.map((def) => ({
    questId: def.id,
    progress: 0,
    completedAt: null,
  }));
}

/** Ensures every daily quest def has a progress entry; leaves weekly entries untouched. */
function ensureDailyEntries(state: QuestState): QuestState {
  const existing = new Map(state.entries.map((e) => [e.questId, e]));
  const dailyEntries = DAILY_QUEST_DEFS.map(
    (def) => existing.get(def.id) ?? { questId: def.id, progress: 0, completedAt: null },
  );
  const otherEntries = state.entries.filter((e) => !DAILY_QUEST_IDS.has(e.questId));
  return { ...state, entries: [...dailyEntries, ...otherEntries] };
}

/**
 * Rolls daily quests forward when `today` is a new local calendar day.
 * Resets daily progress while preserving non-daily (weekly) entries.
 */
export function rolloverDailyQuests(state: QuestState | undefined, today: string): QuestState {
  const base: QuestState = state ?? {
    dailyPeriodStart: null,
    weeklyPeriodStart: null,
    entries: [],
  };

  if (base.dailyPeriodStart === today) {
    return ensureDailyEntries(base);
  }

  const weeklyEntries = base.entries.filter((e) => !DAILY_QUEST_IDS.has(e.questId));
  return {
    ...base,
    dailyPeriodStart: today,
    entries: [...freshDailyEntries(), ...weeklyEntries],
  };
}

function deltaForQuest(def: DailyQuestDef, event: CelebrationEvent): number {
  switch (def.kind) {
    case "word-review-count":
      return event.kind === "review-complete" ? event.cardCount : 0;
    case "unit-finish":
      return event.kind === "unit-complete" ? 1 : 0;
    case "review-session":
      return event.kind === "review-complete" && event.cardCount > 0 ? 1 : 0;
    default:
      return 0;
  }
}

/**
 * Applies a celebration event to in-progress daily quests. Idempotent for completed quests.
 * Call after {@link rolloverDailyQuests} so entries match today's period.
 */
export function applyCelebrationToQuests(state: QuestState, event: CelebrationEvent): QuestState {
  const entries = state.entries.map((entry) => {
    const def = DAILY_QUEST_BY_ID.get(entry.questId);
    if (!def || entry.completedAt !== null) return entry;

    const delta = deltaForQuest(def, event);
    if (delta === 0) return entry;

    const progress = Math.min(entry.progress + delta, def.target);
    const completedAt = progress >= def.target ? event.at : null;
    return { ...entry, progress, completedAt };
  });

  return { ...state, entries };
}

/** Resolves a daily quest definition by id; undefined for unknown ids. */
export function getDailyQuestDef(questId: string): DailyQuestDef | undefined {
  return DAILY_QUEST_BY_ID.get(questId);
}
