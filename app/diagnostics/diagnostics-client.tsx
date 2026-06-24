"use client";

import { useEffect, useMemo, useState } from "react";

import type { Cefr, ErrorEventRecord, Skill, Weakness } from "@/lib/db";
import { computeWeaknesses } from "@/lib/diagnostics/weakness";
import { getContentRepository } from "@/lib/registry";
import { cn } from "@/ui/cn";

const SKILLS: Skill[] = ["reading", "writing", "listening", "speaking"];
const CEFR_LEVELS: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

type MasteryTier = "mastering" | "developing" | "struggling";

function masteryTier(score: number): MasteryTier {
  if (score >= 0.6) return "struggling";
  if (score >= 0.3) return "developing";
  return "mastering";
}

const TIER_STYLE: Record<MasteryTier, string> = {
  mastering: "bg-success/15 text-success border-success/30",
  developing: "bg-warning/15 text-warning border-warning/30",
  struggling: "bg-danger/15 text-danger border-danger/30",
};

const TIER_ABBR: Record<MasteryTier, string> = {
  mastering: "Mas",
  developing: "Dev",
  struggling: "Str",
};

const TIER_LABEL: Record<MasteryTier, string> = {
  mastering: "Mastering",
  developing: "Developing",
  struggling: "Struggling",
};

export function DiagnosticsClient() {
  const [events, setEvents] = useState<ErrorEventRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeSkill, setActiveSkill] = useState<Skill>("reading");
  const [selectedCell, setSelectedCell] = useState<{ category: string; cefr: Cefr } | null>(null);

  useEffect(() => {
    let active = true;
    void getContentRepository()
      .queryErrorEvents()
      .then((evts) => {
        if (!active) return;
        setEvents(evts);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const now = useMemo(() => new Date(), []);
  const weaknesses = useMemo(() => computeWeaknesses(events, now), [events, now]);

  const byTriple = useMemo(() => {
    const m = new Map<string, Weakness>();
    for (const w of weaknesses) {
      m.set(`${w.skill}|${w.category}|${w.cefr}`, w);
    }
    return m;
  }, [weaknesses]);

  const eventsByTriple = useMemo(() => {
    const m = new Map<string, ErrorEventRecord[]>();
    for (const e of events) {
      const key = `${e.skill}|${e.category}|${e.cefr}`;
      const arr = m.get(key) ?? [];
      arr.push(e);
      m.set(key, arr);
    }
    return m;
  }, [events]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const w of weaknesses) {
      if (w.skill === activeSkill) cats.add(w.category);
    }
    return Array.from(cats).sort();
  }, [weaknesses, activeSkill]);

  const selectedContexts = useMemo(() => {
    if (!selectedCell) return [];
    const key = `${activeSkill}|${selectedCell.category}|${selectedCell.cefr}`;
    const evts = (eventsByTriple.get(key) ?? [])
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const e of evts) {
      if (e.context && !seen.has(e.context)) {
        seen.add(e.context);
        unique.push(e.context);
      }
      if (unique.length >= 5) break;
    }
    return unique;
  }, [selectedCell, activeSkill, eventsByTriple]);

  function handleSkillClick(skill: Skill) {
    setActiveSkill(skill);
    setSelectedCell(null);
  }

  function handleCellClick(category: string, cefr: Cefr) {
    const isSelected = selectedCell?.category === category && selectedCell.cefr === cefr;
    setSelectedCell(isSelected ? null : { category, cefr });
  }

  return (
    <div data-testid="diagnostics-page" className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <section>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Diagnostics</h1>
          <p className="text-muted mt-1 text-sm">
            Your weakness profile across all four skills — built automatically from practice errors.
          </p>
        </section>

        {/* Skill tabs */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Skills">
          {SKILLS.map((skill) => (
            <button
              key={skill}
              role="tab"
              aria-selected={skill === activeSkill}
              data-testid={`skill-tab-${skill}`}
              onClick={() => handleSkillClick(skill)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors",
                skill === activeSkill
                  ? "bg-accent text-accent-foreground"
                  : "border-border text-muted hover:text-foreground border",
              )}
            >
              {skill}
            </button>
          ))}
        </div>

        {!loaded ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : events.length === 0 ? (
          <div
            data-testid="diagnostics-empty"
            className="border-border rounded-xl border p-10 text-center"
          >
            <p className="text-foreground text-sm font-medium">No practice data yet</p>
            <p className="text-muted mt-2 text-sm leading-6">
              Complete reading, writing, listening, or speaking exercises to build your weakness
              profile.
            </p>
          </div>
        ) : (
          <div data-testid="diagnostics-heatmap" className="space-y-6">
            {categories.length === 0 ? (
              <p className="text-muted text-sm">
                No errors recorded for {activeSkill} yet — keep practising!
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="text-muted py-2 pr-4 text-left text-xs font-medium tracking-wider uppercase">
                          Category
                        </th>
                        {CEFR_LEVELS.map((cefr) => (
                          <th
                            key={cefr}
                            className="text-muted min-w-[72px] py-2 text-center text-xs font-semibold tracking-wider uppercase"
                          >
                            {cefr}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((category) => (
                        <tr key={category} className="border-border border-t">
                          <td className="text-foreground py-2 pr-4 text-xs font-medium capitalize">
                            {category}
                          </td>
                          {CEFR_LEVELS.map((cefr) => {
                            const key = `${activeSkill}|${category}|${cefr}`;
                            const weakness = byTriple.get(key);
                            const isSelected =
                              selectedCell?.category === category && selectedCell.cefr === cefr;

                            if (!weakness) {
                              return (
                                <td key={cefr} className="px-1 py-1.5 text-center">
                                  <div className="border-border mx-auto h-8 w-16 rounded border opacity-30" />
                                </td>
                              );
                            }

                            const tier = masteryTier(weakness.score);
                            return (
                              <td key={cefr} className="px-1 py-1.5 text-center">
                                <button
                                  onClick={() => handleCellClick(category, cefr)}
                                  aria-pressed={isSelected}
                                  title={`${TIER_LABEL[tier]} — ${Math.round(weakness.score * 100)}% weakness`}
                                  className={cn(
                                    "mx-auto flex h-8 w-16 items-center justify-center rounded border text-[10px] font-semibold transition-opacity hover:opacity-80",
                                    TIER_STYLE[tier],
                                    isSelected && "ring-accent ring-2 ring-offset-1",
                                  )}
                                >
                                  {TIER_ABBR[tier]}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-xs">
                  <span className="text-success flex items-center gap-1.5">
                    <span className="bg-success/20 inline-block h-3 w-3 rounded" />
                    Mastering (&lt;30%)
                  </span>
                  <span className="text-warning flex items-center gap-1.5">
                    <span className="bg-warning/20 inline-block h-3 w-3 rounded" />
                    Developing (30–60%)
                  </span>
                  <span className="text-danger flex items-center gap-1.5">
                    <span className="bg-danger/20 inline-block h-3 w-3 rounded" />
                    Struggling (&#x2265;60%)
                  </span>
                </div>

                {/* Drill-down panel */}
                {selectedCell && selectedContexts.length > 0 && (
                  <div
                    data-testid="diagnostics-drilldown"
                    className="border-border bg-card space-y-2 rounded-xl border p-4"
                  >
                    <p className="text-foreground text-sm font-medium capitalize">
                      {selectedCell.category} · {selectedCell.cefr} — recent error contexts
                    </p>
                    <ul className="space-y-1.5">
                      {selectedContexts.map((ctx, i) => (
                        <li key={i} className="text-muted text-xs leading-relaxed">
                          &ldquo;{ctx}&rdquo;
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
