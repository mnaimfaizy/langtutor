"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { ActivityKind, NewContent, Unit } from "@/lib/db";
import { lookupConstruction } from "@/lib/content/grammar-map";
import { PassageSchema } from "@/lib/content/passage";
import { PromptSchema } from "@/lib/content/prompt";
import { fetchSingleEmbedding } from "@/lib/content/client-embeddings";
import { firstPendingActivityIndex } from "@/lib/path/unit-progress";
import { getContentRepository } from "@/lib/registry";
import { CEFR_BADGE_VARIANT } from "@/lib/cefr";
import { Badge, BackLink, Button, Card } from "@/ui";
import { BookIcon, HeadphonesIcon, MicIcon, PencilIcon, RepeatIcon } from "../../icons";

type Phase = "loading" | "ready" | "notFound" | "generating" | "error";

const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  review: "Vocabulary review",
  reading: "Reading",
  writing: "Writing",
  listening: "Listening",
  speaking: "Speaking",
};

const ACTIVITY_ICON: Record<ActivityKind, typeof BookIcon> = {
  review: RepeatIcon,
  reading: BookIcon,
  writing: PencilIcon,
  listening: HeadphonesIcon,
  speaking: MicIcon,
};

/** Topic for a unit's lazily-generated activity content: its grammar focus, or its title. */
function unitTopicFor(unit: Unit): string {
  const construction = lookupConstruction(unit.targetGrammarIds[0] ?? "");
  return construction?.label ?? unit.title;
}

/** Activity kinds whose content is a `passage` — reading, listening, and speaking all read/
 * hear/say the same generated text, generated via the same reading pipeline (issue #60). */
const PASSAGE_ACTIVITY_KINDS: ReadonlySet<ActivityKind> = new Set([
  "reading",
  "listening",
  "speaking",
]);

/** Generates and caches this unit's passage content for a reading/listening/speaking slot. */
async function generatePassageContent(topic: string, level: Unit["targetCefr"]): Promise<number> {
  const res = await fetch("/api/reading/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, level }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as { passage: unknown };
  const passage = PassageSchema.parse(data.passage);
  const embedding = await fetchSingleEmbedding(passage.body);

  return getContentRepository().putContent({
    type: "passage",
    level,
    topic,
    payload: passage,
    source: "generated",
    validatedAt: new Date(),
    embedding,
  } satisfies NewContent);
}

/** Generates and caches this unit's writing prompt content for a writing slot. */
async function generatePromptContent(topic: string, level: Unit["targetCefr"]): Promise<number> {
  const res = await fetch("/api/writing/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, level }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as { prompt: unknown };
  const prompt = PromptSchema.parse(data.prompt);
  const embedding = await fetchSingleEmbedding(prompt.instruction);

  return getContentRepository().putContent({
    type: "prompt",
    level,
    topic,
    payload: prompt,
    source: "generated",
    validatedAt: new Date(),
    embedding,
  } satisfies NewContent);
}

export function UnitView({ id }: { id: number }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(() => (isNaN(id) || id <= 0 ? "notFound" : "loading"));
  const [unit, setUnit] = useState<Unit | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isNaN(id) || id <= 0) return;

    let active = true;
    void getContentRepository()
      .getUnits()
      .then((units) => {
        if (!active) return;
        const found = units.find((u) => u.id === id);
        if (!found) {
          setPhase("notFound");
        } else {
          setUnit(found);
          setPhase("ready");
        }
      })
      .catch(() => {
        if (active) setPhase("error");
      });

    return () => {
      active = false;
    };
  }, [id]);

  /**
   * Starts the review activity directly (it needs no unit-specific content — it operates on
   * the learner's global SRS deck) or lazily generates-then-caches this activity's content
   * (a passage for reading/listening/speaking, a writing prompt for writing) the first time
   * it's opened, storing the resulting `contentId` back on the unit so re-entering resumes
   * the same content instead of regenerating it (issue #59, extended to all module types by
   * issue #60).
   */
  async function startActivity(activityIndex: number) {
    if (!unit) return;
    const activity = unit.activities[activityIndex];
    if (!activity) return;

    const query = `?unit=${unit.id}&activity=${activityIndex}`;

    if (activity.skill === "review") {
      router.push(`/review${query}`);
      return;
    }

    if (activity.contentId !== undefined) {
      router.push(`/${activity.skill}/${activity.contentId}${query}`);
      return;
    }

    setPhase("generating");
    setErrorMsg("");
    try {
      const repo = getContentRepository();
      const topic = unitTopicFor(unit);
      const contentId = PASSAGE_ACTIVITY_KINDS.has(activity.skill)
        ? await generatePassageContent(topic, unit.targetCefr)
        : await generatePromptContent(topic, unit.targetCefr);

      const activities = unit.activities.map((a, i) =>
        i === activityIndex ? { ...a, contentId } : a,
      );
      await repo.updateUnit(unit.id, { activities });

      router.push(`/${activity.skill}/${contentId}${query}`);
    } catch {
      setErrorMsg(
        `Could not generate this unit's ${ACTIVITY_LABEL[activity.skill].toLowerCase()} content. Make sure the Mac is reachable.`,
      );
      setPhase("ready");
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-muted text-sm">Loading…</p>
      </div>
    );
  }

  if (phase === "notFound" || !unit) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <p className="text-foreground text-base font-semibold">Unit not found</p>
        <p className="text-muted mt-2 text-sm">It may have been removed or the link is invalid.</p>
        <Link href="/home" className="mt-8">
          <Button variant="secondary" size="lg">
            Back to home
          </Button>
        </Link>
      </div>
    );
  }

  if (unit.status === "locked") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <p className="text-foreground text-base font-semibold">This unit is still locked</p>
        <p className="text-muted mt-2 text-sm">
          Complete the units before it on your learning path first.
        </p>
        <Link href="/home" className="mt-8">
          <Button variant="secondary" size="lg">
            Back to home
          </Button>
        </Link>
      </div>
    );
  }

  const nextIndex = firstPendingActivityIndex(unit);

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <BackLink href="/home" label="Home" className="mb-6" />

        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Badge variant={CEFR_BADGE_VARIANT[unit.targetCefr]}>{unit.targetCefr}</Badge>
          {unit.status === "completed" && (
            <Badge variant="success" size="sm">
              Completed
            </Badge>
          )}
        </div>

        <h1
          data-testid="unit-title"
          className="text-foreground mt-2 text-2xl leading-snug font-semibold tracking-tight"
        >
          {unit.title}
        </h1>
        <p data-testid="unit-teacher-note" className="text-muted mt-3 text-base leading-7">
          {unit.teacherNote}
        </p>

        {phase === "error" && (
          <p className="text-danger mt-4 text-sm">Could not load this unit. Try again.</p>
        )}
        {errorMsg && <p className="text-danger mt-4 text-sm">{errorMsg}</p>}

        <ol data-testid="unit-activities" className="mt-8 flex flex-col gap-2">
          {unit.activities.map((activity, i) => {
            const Icon = ACTIVITY_ICON[activity.skill];
            const isNext = i === nextIndex;
            const isDone = Boolean(activity.done);
            const isDisabled = i > nextIndex;

            return (
              <li key={i}>
                <Card
                  data-testid={`unit-activity-${i}`}
                  data-done={isDone}
                  className={isDone ? "opacity-70" : undefined}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          isDone
                            ? "bg-success/15 text-success flex size-9 shrink-0 items-center justify-center rounded-lg"
                            : "bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-lg"
                        }
                      >
                        <Icon className="size-5" />
                      </span>
                      <div>
                        <p className="text-foreground text-sm font-semibold">
                          {ACTIVITY_LABEL[activity.skill]}
                        </p>
                        <p className="text-muted mt-0.5 text-xs">
                          {isDone ? "Done" : isNext ? "Up next" : "Not started"}
                        </p>
                      </div>
                    </div>

                    {isNext && !isDone && (
                      <Button
                        data-testid={`btn-start-activity-${i}`}
                        variant="gradient"
                        size="sm"
                        disabled={phase === "generating" || isDisabled}
                        onClick={() => void startActivity(i)}
                      >
                        {phase === "generating"
                          ? "Preparing…"
                          : unit.status === "in-progress"
                            ? "Continue"
                            : "Start"}
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>

        {unit.status === "completed" && (
          <p data-testid="unit-complete-message" className="text-success mt-6 text-sm font-medium">
            Unit complete — nice work! The next unit is now available.
          </p>
        )}
      </div>
    </div>
  );
}
