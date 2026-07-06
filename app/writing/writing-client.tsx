"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import type { Cefr, Content, Weakness } from "@/lib/db";
import { PromptSchema, WRITING_TOPICS } from "@/lib/content/prompt";
import type { PromptPayload } from "@/lib/content/prompt";
import { fetchSingleEmbedding } from "@/lib/content/client-embeddings";
import { rankTopicsByWeakness, WRITING_TOPIC_AFFINITIES } from "@/lib/content/adaptive-selection";
import { computeWeaknesses } from "@/lib/diagnostics/weakness";
import { getContentRepository } from "@/lib/registry";
import { CEFR_BADGE_VARIANT } from "@/lib/cefr";
import { resolveMotionPreset } from "@/lib/motion";
import { Badge, Button, Card, Input, SelectPill } from "@/ui";

const CEFR_LEVELS: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

type GenPhase = "idle" | "generating" | "error";

export function WritingClient() {
  const router = useRouter();
  const reducedMotion = useReducedMotion() ?? false;
  const enter = resolveMotionPreset("enter", reducedMotion);

  const [profileLevel, setProfileLevel] = useState<Cefr>("B1");
  const [selectedLevel, setSelectedLevel] = useState<Cefr | null>(null);
  const [topic, setTopic] = useState<string>(WRITING_TOPICS[0]);
  const [customTopic, setCustomTopic] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [genPhase, setGenPhase] = useState<GenPhase>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const [library, setLibrary] = useState<Content[]>([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [weaknesses, setWeaknesses] = useState<Weakness[]>([]);

  const inFlight = useRef(false);

  // Load profile level, prompt library, and weakness profile from Dexie on mount.
  useEffect(() => {
    let active = true;
    const repo = getContentRepository();

    async function load() {
      const [profile, prompts, errorEvents] = await Promise.all([
        repo.getProfile(),
        repo.queryContent({ type: "prompt" }),
        repo.queryErrorEvents(),
      ]);
      if (!active) return;
      if (profile?.cefrLevel) setProfileLevel(profile.cefrLevel);
      setLibrary(prompts.slice().reverse()); // newest first
      setWeaknesses(computeWeaknesses(errorEvents, new Date()));
      setLibraryLoaded(true);
    }

    void load().catch(() => {
      if (active) setLibraryLoaded(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const effectiveLevel = selectedLevel ?? profileLevel;
  const effectiveTopic = useCustom ? customTopic.trim() : topic;

  // Top-3 topics ranked by writing-skill weaknesses only (other skills would contaminate).
  // Memoized so the sort doesn't re-run on every keystroke in the custom topic input.
  const suggestedTopics = useMemo(
    () =>
      new Set(
        rankTopicsByWeakness(
          WRITING_TOPICS,
          weaknesses.filter((w) => w.skill === "writing"),
          WRITING_TOPIC_AFFINITIES,
        ).slice(0, 3),
      ),
    [weaknesses],
  );

  async function handleGenerate() {
    if (inFlight.current) return;
    const t = effectiveTopic;
    if (!t) {
      setErrorMsg("Please enter a topic.");
      setGenPhase("error");
      return;
    }

    inFlight.current = true;
    setGenPhase("generating");
    setErrorMsg("");

    try {
      const res = await fetch("/api/writing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t, level: effectiveLevel }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { prompt: unknown };
      const prompt = PromptSchema.parse(data.prompt);
      const embedding = await fetchSingleEmbedding(prompt.instruction);

      const repo = getContentRepository();
      const contentId = await repo.putContent({
        type: "prompt",
        level: effectiveLevel,
        topic: t,
        payload: prompt satisfies PromptPayload,
        source: "generated",
        validatedAt: new Date(),
        embedding,
      });

      router.push(`/writing/${contentId}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Generation failed.");
      setGenPhase("error");
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl space-y-10">
        {/* ── Generator ─────────────────────────────────────────────────────── */}
        <section>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Writing</h1>
          <p className="text-muted mt-1 text-sm">
            Pick a topic and generate a level-appropriate writing prompt.
          </p>

          {/* Level selector */}
          <div className="mt-5">
            <p className="text-foreground mb-2 text-sm font-medium">Level</p>
            <div className="flex flex-wrap gap-2">
              {CEFR_LEVELS.map((lvl) => (
                <SelectPill
                  key={lvl}
                  data-testid={`level-${lvl}`}
                  selected={effectiveLevel === lvl}
                  onClick={() => setSelectedLevel(lvl)}
                  className="rounded-lg px-3 py-1.5"
                >
                  {lvl}
                  {lvl === profileLevel && selectedLevel === null && (
                    <span className="text-muted ml-1 text-xs">(profile)</span>
                  )}
                </SelectPill>
              ))}
            </div>
          </div>

          {/* Topic picker */}
          <div className="mt-5">
            <p className="text-foreground mb-2 text-sm font-medium">Topic</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {WRITING_TOPICS.map((t) => (
                <SelectPill
                  key={t}
                  data-testid={`topic-${t.replace(/\s+/g, "-")}`}
                  selected={!useCustom && topic === t}
                  onClick={() => {
                    setTopic(t);
                    setUseCustom(false);
                  }}
                >
                  {t}
                  {weaknesses.length > 0 && suggestedTopics.has(t) && (
                    <Badge
                      data-testid={`suggested-${t.replace(/\s+/g, "-")}`}
                      variant="gradient"
                      size="sm"
                      className="absolute -top-2 -right-2 px-1.5"
                    >
                      ★
                    </Badge>
                  )}
                </SelectPill>
              ))}
              <SelectPill
                data-testid="topic-custom"
                selected={useCustom}
                onClick={() => setUseCustom(true)}
              >
                Custom…
              </SelectPill>
            </div>

            {useCustom && (
              <Input
                autoFocus
                data-testid="custom-topic-input"
                type="text"
                placeholder="Enter a topic…"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          <AnimatePresence>
            {genPhase === "error" && (
              <motion.p
                data-testid="gen-error"
                className="text-danger mt-3 text-sm"
                initial={enter.initial}
                animate={enter.animate}
                exit={enter.exit}
                transition={enter.transition}
              >
                {errorMsg || "Could not generate prompt. Make sure the Mac is reachable."}
              </motion.p>
            )}
          </AnimatePresence>

          <Button
            data-testid="btn-generate"
            variant="gradient"
            size="lg"
            className="mt-5 w-full sm:w-auto"
            disabled={genPhase === "generating" || (useCustom && !customTopic.trim())}
            onClick={() => void handleGenerate()}
          >
            {genPhase === "generating" ? "Generating…" : "Generate prompt"}
          </Button>
        </section>

        {/* ── Library ───────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-foreground text-lg font-semibold">Your prompts</h2>

          {!libraryLoaded ? (
            <p className="text-muted mt-4 text-sm">Loading…</p>
          ) : library.length === 0 ? (
            <p data-testid="library-empty" className="text-muted mt-4 text-sm">
              No prompts yet. Generate one above or complete onboarding to load the starter set.
            </p>
          ) : (
            <ul data-testid="prompt-library" className="mt-4 space-y-2">
              {library.map((item) => {
                const p = PromptSchema.safeParse(item.payload);
                const title = p.success ? p.data.title : item.topic;
                return (
                  <li key={item.id}>
                    <Link
                      href={`/writing/${item.id}`}
                      data-testid={`prompt-item-${item.id}`}
                      className="focus-visible:ring-accent focus-visible:ring-offset-background block rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <Card className="hover:border-accent/40 hover:shadow-glow flex flex-row items-center justify-between gap-4 py-3 transition-[colors,box-shadow]">
                        <div className="min-w-0">
                          <p className="text-foreground truncate text-sm font-medium">{title}</p>
                          <p className="text-muted mt-0.5 truncate text-xs capitalize">
                            {item.topic} · {item.source}
                          </p>
                        </div>
                        <Badge variant={CEFR_BADGE_VARIANT[item.level]} className="shrink-0">
                          {item.level}
                        </Badge>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
