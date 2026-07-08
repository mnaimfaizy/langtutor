"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import type { QuestProgressEntry, QuestState } from "@/lib/db";
import { DAILY_QUEST_DEFS, rolloverDailyQuests } from "@/lib/gamification/quests";
import { localDateString } from "@/lib/gamification";
import { getContentRepository } from "@/lib/registry";
import { Card, CardTitle, Progress, cn } from "@/ui";

interface QuestRow {
  def: (typeof DAILY_QUEST_DEFS)[number];
  entry: QuestProgressEntry;
}

function buildRows(state: QuestState): QuestRow[] {
  const byId = new Map(state.entries.map((e) => [e.questId, e]));
  return DAILY_QUEST_DEFS.map((def) => ({
    def,
    entry: byId.get(def.id) ?? { questId: def.id, progress: 0, completedAt: null },
  }));
}

export function DailyQuests() {
  const pathname = usePathname();
  const [rows, setRows] = useState<QuestRow[] | null>(null);

  useEffect(() => {
    if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/sign-up"))
      return;

    let active = true;
    const repo = getContentRepository();
    const today = localDateString(new Date());

    void (async () => {
      const current = await repo.getQuestState();
      const rolled = rolloverDailyQuests(current, today);
      const dailyEntryCount = rolled.entries.filter((e) =>
        DAILY_QUEST_DEFS.some((d) => d.id === e.questId),
      ).length;
      const needsPersist =
        !current ||
        current.dailyPeriodStart !== rolled.dailyPeriodStart ||
        dailyEntryCount !== DAILY_QUEST_DEFS.length;
      if (needsPersist) {
        await repo.saveQuestState(rolled);
      }
      if (active) setRows(buildRows(rolled));
    })();

    return () => {
      active = false;
    };
  }, [pathname]);

  if (!rows) return null;

  const completedCount = rows.filter((r) => r.entry.completedAt !== null).length;

  return (
    <section data-testid="daily-quests" className="mt-8 w-full">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Today&apos;s quests
        </h2>
        <p className="text-muted text-sm tabular-nums">
          {completedCount}/{rows.length} done
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map(({ def, entry }) => {
          const done = entry.completedAt !== null;
          const pct = Math.min(100, Math.round((entry.progress / def.target) * 100));

          return (
            <li key={def.id}>
              <Card
                data-testid={`quest-${def.id}`}
                data-quest-done={done ? "true" : "false"}
                className={cn(done && "border-success/30 bg-success/5")}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-lg text-lg"
                    aria-hidden
                  >
                    {def.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {def.label}
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}
