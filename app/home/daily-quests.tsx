"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import type { QuestProgressEntry, QuestState } from "@/lib/db";
import {
  DAILY_QUEST_DEFS,
  WEEKLY_QUEST_DEFS,
  rolloverDailyQuests,
  rolloverWeeklyQuests,
} from "@/lib/gamification/quests";
import { localDateString } from "@/lib/gamification";
import { getContentRepository } from "@/lib/registry";
import { Card, CardTitle, Progress, cn } from "@/ui";

interface DailyQuestRow {
  def: (typeof DAILY_QUEST_DEFS)[number];
  entry: QuestProgressEntry;
}

interface WeeklyQuestRow {
  def: (typeof WEEKLY_QUEST_DEFS)[number];
  entry: QuestProgressEntry;
}

function buildDailyRows(state: QuestState): DailyQuestRow[] {
  const byId = new Map(state.entries.map((e) => [e.questId, e]));
  return DAILY_QUEST_DEFS.map((def) => ({
    def,
    entry: byId.get(def.id) ?? { questId: def.id, progress: 0, completedAt: null },
  }));
}

function buildWeeklyRows(state: QuestState): WeeklyQuestRow[] {
  const byId = new Map(state.entries.map((e) => [e.questId, e]));
  return WEEKLY_QUEST_DEFS.map((def) => ({
    def,
    entry: byId.get(def.id) ?? {
      questId: def.id,
      progress: 0,
      completedAt: null,
      lastCountedDay: null,
    },
  }));
}

function QuestCard({
  def,
  entry,
  rewardLabel,
  accentClassName,
}: {
  def: { id: string; icon: string; label: string; description: string; target: number };
  entry: QuestProgressEntry;
  rewardLabel?: string;
  accentClassName?: string;
}) {
  const done = entry.completedAt !== null;
  const pct = Math.min(100, Math.round((entry.progress / def.target) * 100));

  return (
    <Card
      data-testid={`quest-${def.id}`}
      data-quest-done={done ? "true" : "false"}
      className={cn(done && "border-success/30 bg-success/5", accentClassName)}
    >
      <div className="flex items-start gap-3">
        <span
          className="bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-lg text-lg"
          aria-hidden
        >
          {def.icon}
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {def.label}
            {rewardLabel && (
              <span className="bg-accent/15 text-accent rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
                {rewardLabel}
              </span>
            )}
            {done && (
              <span className="text-success text-xs font-medium" aria-label="Completed">
                ✓
              </span>
            )}
          </CardTitle>
          <p className="text-muted mt-0.5 text-sm leading-6">{def.description}</p>
          <div className="mt-3">
            <div className="text-muted mb-1 flex justify-between text-xs tabular-nums">
              <span>
                {entry.progress} / {def.target}
              </span>
              <span>{pct}%</span>
            </div>
            <Progress
              value={entry.progress}
              max={def.target}
              aria-label={`${def.label}: ${entry.progress} of ${def.target}`}
              indicatorClassName={done ? "from-success to-success" : undefined}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function DailyQuests() {
  const pathname = usePathname();
  const [dailyRows, setDailyRows] = useState<DailyQuestRow[] | null>(null);
  const [weeklyRows, setWeeklyRows] = useState<WeeklyQuestRow[] | null>(null);

  useEffect(() => {
    if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/sign-up"))
      return;

    let active = true;
    const repo = getContentRepository();
    const today = localDateString(new Date());

    void (async () => {
      const current = await repo.getQuestState();
      const dailyRolled = rolloverDailyQuests(current, today);
      const rolled = rolloverWeeklyQuests(dailyRolled, today);
      const dailyEntryCount = rolled.entries.filter((e) =>
        DAILY_QUEST_DEFS.some((d) => d.id === e.questId),
      ).length;
      const weeklyEntryCount = rolled.entries.filter((e) =>
        WEEKLY_QUEST_DEFS.some((d) => d.id === e.questId),
      ).length;
      const needsPersist =
        !current ||
        current.dailyPeriodStart !== rolled.dailyPeriodStart ||
        current.weeklyPeriodStart !== rolled.weeklyPeriodStart ||
        dailyEntryCount !== DAILY_QUEST_DEFS.length ||
        weeklyEntryCount !== WEEKLY_QUEST_DEFS.length;
      if (needsPersist) {
        await repo.saveQuestState(rolled);
      }
      if (active) {
        setDailyRows(buildDailyRows(rolled));
        setWeeklyRows(buildWeeklyRows(rolled));
      }
    })();

    return () => {
      active = false;
    };
  }, [pathname]);

  if (!dailyRows || !weeklyRows) return null;

  const dailyCompletedCount = dailyRows.filter((r) => r.entry.completedAt !== null).length;
  const weeklyCompletedCount = weeklyRows.filter((r) => r.entry.completedAt !== null).length;

  return (
    <div className="mt-8 w-full">
      <section data-testid="daily-quests">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            Today&apos;s quests
          </h2>
          <p className="text-muted text-sm tabular-nums">
            {dailyCompletedCount}/{dailyRows.length} done
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          {dailyRows.map(({ def, entry }) => (
            <li key={def.id}>
              <QuestCard def={def} entry={entry} />
            </li>
          ))}
        </ul>
      </section>

      <section data-testid="weekly-quests" className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            This week&apos;s quests
          </h2>
          <p className="text-muted text-sm tabular-nums">
            {weeklyCompletedCount}/{weeklyRows.length} done
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          {weeklyRows.map(({ def, entry }) => (
            <li key={def.id}>
              <QuestCard
                def={def}
                entry={entry}
                rewardLabel={`+${def.xpReward} XP bonus`}
                accentClassName="border-accent/20 bg-accent/5"
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
