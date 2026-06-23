"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { Cefr, Content } from "@/lib/db";
import { PassageSchema, READING_TOPICS } from "@/lib/content/passage";
import type { PassagePayload } from "@/lib/content/passage";
import { getContentRepository } from "@/lib/registry";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";

const CEFR_LEVELS: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const CEFR_COLOR: Record<Cefr, string> = {
  A1: "text-success",
  A2: "text-success",
  B1: "text-warning",
  B2: "text-warning",
  C1: "text-danger",
  C2: "text-danger",
};

type GenPhase = "idle" | "generating" | "error";

export function ReadingClient() {
  const router = useRouter();

  const [profileLevel, setProfileLevel] = useState<Cefr>("B1");
  const [selectedLevel, setSelectedLevel] = useState<Cefr | null>(null);
  const [topic, setTopic] = useState<string>(READING_TOPICS[0]);
  const [customTopic, setCustomTopic] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [genPhase, setGenPhase] = useState<GenPhase>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const [library, setLibrary] = useState<Content[]>([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);

  const inFlight = useRef(false);

  // Load profile level + passage library from Dexie on mount.
  useEffect(() => {
    let active = true;
    const repo = getContentRepository();

    async function load() {
      const [profile, passages] = await Promise.all([
        repo.getProfile(),
        repo.queryContent({ type: "passage" }),
      ]);
      if (!active) return;
      if (profile?.cefrLevel) setProfileLevel(profile.cefrLevel);
      setLibrary(passages.slice().reverse()); // newest first
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
      const res = await fetch("/api/reading/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t, level: effectiveLevel }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { passage: unknown };
      const passage = PassageSchema.parse(data.passage);

      const repo = getContentRepository();
      const contentId = await repo.putContent({
        type: "passage",
        level: effectiveLevel,
        topic: t,
        payload: passage satisfies PassagePayload,
        source: "generated",
        validatedAt: new Date(),
      });

      router.push(`/reading/${contentId}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Generation failed.");
      setGenPhase("error");
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <div className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-10">
        {/* ── Generator ─────────────────────────────────────────────────────── */}
        <section>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Reading</h1>
          <p className="text-muted mt-1 text-sm">
            Pick a topic and generate a level-appropriate passage.
          </p>

          {/* Level selector */}
          <div className="mt-5">
            <p className="text-foreground mb-2 text-sm font-medium">Level</p>
            <div className="flex flex-wrap gap-2">
              {CEFR_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  data-testid={`level-${lvl}`}
                  onClick={() => setSelectedLevel(lvl)}
                  className={cn(
                    "border-border rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    effectiveLevel === lvl
                      ? "bg-accent text-accent-foreground border-accent"
                      : "text-muted hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  {lvl}
                  {lvl === profileLevel && selectedLevel === null && (
                    <span className="text-muted ml-1 text-xs">(profile)</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Topic picker */}
          <div className="mt-5">
            <p className="text-foreground mb-2 text-sm font-medium">Topic</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {READING_TOPICS.map((t) => (
                <button
                  key={t}
                  data-testid={`topic-${t.replace(/\s+/g, "-")}`}
                  onClick={() => {
                    setTopic(t);
                    setUseCustom(false);
                  }}
                  className={cn(
                    "border-border rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    !useCustom && topic === t
                      ? "bg-accent/10 border-accent text-foreground font-medium"
                      : "text-muted hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  {t}
                </button>
              ))}
              <button
                data-testid="topic-custom"
                onClick={() => setUseCustom(true)}
                className={cn(
                  "border-border rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                  useCustom
                    ? "bg-accent/10 border-accent text-foreground font-medium"
                    : "text-muted hover:text-foreground hover:border-foreground/30",
                )}
              >
                Custom…
              </button>
            </div>

            {useCustom && (
              <input
                autoFocus
                data-testid="custom-topic-input"
                type="text"
                placeholder="Enter a topic…"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="border-border bg-background text-foreground placeholder:text-muted focus:ring-accent mt-2 w-full rounded-xl border px-4 py-2.5 text-sm focus:ring-2 focus:outline-none"
              />
            )}
          </div>

          {genPhase === "error" && (
            <p data-testid="gen-error" className="text-danger mt-3 text-sm">
              {errorMsg || "Could not generate passage. Make sure the Mac is reachable."}
            </p>
          )}

          <Button
            data-testid="btn-generate"
            variant="primary"
            size="lg"
            className="mt-5 w-full sm:w-auto"
            disabled={genPhase === "generating" || (useCustom && !customTopic.trim())}
            onClick={() => void handleGenerate()}
          >
            {genPhase === "generating" ? "Generating…" : "Generate passage"}
          </Button>
        </section>

        {/* ── Library ───────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-foreground text-lg font-semibold">Your passages</h2>

          {!libraryLoaded ? (
            <p className="text-muted mt-4 text-sm">Loading…</p>
          ) : library.length === 0 ? (
            <p data-testid="library-empty" className="text-muted mt-4 text-sm">
              No passages yet. Generate one above or complete onboarding to load the starter set.
            </p>
          ) : (
            <ul data-testid="passage-library" className="mt-4 space-y-2">
              {library.map((item) => {
                const p = PassageSchema.safeParse(item.payload);
                const title = p.success ? p.data.title : item.topic;
                return (
                  <li key={item.id}>
                    <Link
                      href={`/reading/${item.id}`}
                      data-testid={`passage-item-${item.id}`}
                      className="border-border bg-card hover:border-foreground/20 flex items-center justify-between rounded-xl border px-4 py-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-sm font-medium">{title}</p>
                        <p className="text-muted mt-0.5 truncate text-xs capitalize">
                          {item.topic} · {item.source}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "ml-4 shrink-0 text-xs font-semibold tracking-wider uppercase",
                          CEFR_COLOR[item.level],
                        )}
                      >
                        {item.level}
                      </span>
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
