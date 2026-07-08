import type { QuestProgressEntry, QuestState } from "@/lib/db";

import type { CelebrationEvent } from "./celebration-event";
import { localDateString } from "./streak";

export type QuestKind = "word-review-count" | "unit-finish" | "review-session" | "active-day";

export interface QuestDef {
  id: string;
  icon: string;
  label: string;
  description: string;
  target: number;
  kind: QuestKind;
  /** Bonus XP shown on weekly quests; daily quests omit this. */
  xpReward?: number;
}

export type DailyQuestDef = QuestDef;
export type WeeklyQuestDef = QuestDef & { xpReward: number };

/** Static daily quest catalogue. */
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

/** Static weekly quest catalogue — fewer quests, bigger bonus rewards. */
export const WEEKLY_QUEST_DEFS: WeeklyQuestDef[] = [
  {
    id: "weekly-active-days",
    icon: "🔥",
    label: "Study 5 days",
    description: "Practice on 5 different days this week.",
    target: 5,
    kind: "active-day",
    xpReward: 100,
  },
  {
    id: "weekly-units-2",
    icon: "🏆",
    label: "Finish 2 units",
    description: "Complete two learning-path units this week.",
    target: 2,
    kind: "unit-finish",
    xpReward: 150,
  },
];

const DAILY_QUEST_IDS = new Set(DAILY_QUEST_DEFS.map((d) => d.id));
const WEEKLY_QUEST_IDS = new Set(WEEKLY_QUEST_DEFS.map((d) => d.id));
const QUEST_BY_ID = new Map(
  [...DAILY_QUEST_DEFS, ...WEEKLY_QUEST_DEFS].map((d) => [d.id, d] as const),
);

/** ISO `YYYY-MM-DD` local date for the Monday that starts the week containing `dateString`. */
export function localWeekStart(dateString: string): string {
  const [y, m, d] = dateString.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + diff);
  return localDateString(date);
}

function freshDailyEntries(): QuestProgressEntry[] {
  return DAILY_QUEST_DEFS.map((def) => ({
    questId: def.id,
    progress: 0,
    completedAt: null,
  }));
}

function freshWeeklyEntries(): QuestProgressEntry[] {
  return WEEKLY_QUEST_DEFS.map((def) => ({
    questId: def.id,
    progress: 0,
    completedAt: null,
    lastCountedDay: null,
  }));
}

/** Ensures every daily quest def has a progress entry; leaves weekly entries untouched. */
function ensureDailyEntries(state: QuestState): QuestState {
  const existing = new Map(state.entries.map((e) => [e.questId, e]));
  const dailyEntries = DAILY_QUEST_DEFS.map(
    (def) => existing.get(def.id) ?? { questId: def.id, progress: 0, completedAt: null },
  );
  const weeklyEntries = state.entries.filter((e) => WEEKLY_QUEST_IDS.has(e.questId));
  return { ...state, entries: [...dailyEntries, ...weeklyEntries] };
}

/** Ensures every weekly quest def has a progress entry; leaves daily entries untouched. */
function ensureWeeklyEntries(state: QuestState): QuestState {
  const existing = new Map(state.entries.map((e) => [e.questId, e]));
  const weeklyEntries = WEEKLY_QUEST_DEFS.map(
    (def) =>
      existing.get(def.id) ?? {
        questId: def.id,
        progress: 0,
        completedAt: null,
        lastCountedDay: null,
      },
  );
  const dailyEntries = state.entries.filter((e) => DAILY_QUEST_IDS.has(e.questId));
  return { ...state, entries: [...dailyEntries, ...weeklyEntries] };
}

/**
 * Rolls daily quests forward when `today` is a new local calendar day.
 * Resets daily progress while preserving weekly entries.
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

  const weeklyEntries = base.entries.filter((e) => WEEKLY_QUEST_IDS.has(e.questId));
  return {
    ...base,
    dailyPeriodStart: today,
    entries: [...freshDailyEntries(), ...weeklyEntries],
  };
}

/**
 * Rolls weekly quests forward when `today` falls in a new local calendar week.
 * Resets weekly progress while preserving daily entries.
 */
export function rolloverWeeklyQuests(state: QuestState, today: string): QuestState {
  const weekStart = localWeekStart(today);

  if (state.weeklyPeriodStart === weekStart) {
    return ensureWeeklyEntries(state);
  }

  const dailyEntries = state.entries.filter((e) => DAILY_QUEST_IDS.has(e.questId));
  return {
    ...state,
    weeklyPeriodStart: weekStart,
    entries: [...dailyEntries, ...freshWeeklyEntries()],
  };
}

function eventQualifiesForActiveDay(event: CelebrationEvent): boolean {
  if (event.kind === "unit-complete") return true;
  return event.kind === "review-complete" && event.cardCount > 0;
}

function deltaForQuest(def: QuestDef, event: CelebrationEvent): number {
  switch (def.kind) {
    case "word-review-count":
      return event.kind === "review-complete" ? event.cardCount : 0;
    case "unit-finish":
      return event.kind === "unit-complete" ? 1 : 0;
    case "review-session":
      return event.kind === "review-complete" && event.cardCount > 0 ? 1 : 0;
    case "active-day":
      return 0;
    default:
      return 0;
  }
}

function applyEventToEntry(
  def: QuestDef,
  entry: QuestProgressEntry,
  event: CelebrationEvent,
  today: string,
): QuestProgressEntry {
  if (entry.completedAt !== null) return entry;

  if (def.kind === "active-day") {
    if (!eventQualifiesForActiveDay(event)) return entry;
    if (entry.lastCountedDay === today) return entry;

    const progress = Math.min(entry.progress + 1, def.target);
    return {
      ...entry,
      progress,
      lastCountedDay: today,
      completedAt: progress >= def.target ? event.at : null,
    };
  }

  const delta = deltaForQuest(def, event);
  if (delta === 0) return entry;

  const progress = Math.min(entry.progress + delta, def.target);
  const completedAt = progress >= def.target ? event.at : null;
  return { ...entry, progress, completedAt };
}

/**
 * Applies a celebration event to in-progress daily and weekly quests. Idempotent for completed
 * quests. Call after {@link rolloverDailyQuests} and {@link rolloverWeeklyQuests}.
 */
export function applyCelebrationToQuests(state: QuestState, event: CelebrationEvent): QuestState {
  const today = localDateString(event.at);
  const entries = state.entries.map((entry) => {
    const def = QUEST_BY_ID.get(entry.questId);
    if (!def) return entry;
    return applyEventToEntry(def, entry, event, today);
  });

  return { ...state, entries };
}

/** Resolves a daily quest definition by id; undefined for unknown ids. */
export function getDailyQuestDef(questId: string): DailyQuestDef | undefined {
  const def = QUEST_BY_ID.get(questId);
  return def && DAILY_QUEST_IDS.has(questId) ? def : undefined;
}

/** Resolves a weekly quest definition by id; undefined for unknown ids. */
export function getWeeklyQuestDef(questId: string): WeeklyQuestDef | undefined {
  const def = QUEST_BY_ID.get(questId);
  return def && WEEKLY_QUEST_IDS.has(questId) ? (def as WeeklyQuestDef) : undefined;
}
