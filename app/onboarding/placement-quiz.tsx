"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { Profile } from "@/lib/db";
import { CEFR_ORDER, buildQuizBatch, scoreQuiz, shouldAdvance } from "@/lib/placement/quiz-engine";
import type { QuizAnswer, QuizItem, QuizResult } from "@/lib/placement/quiz-engine";
import { getContentRepository } from "@/lib/registry";
import { Button } from "@/ui/button";
import { Progress } from "@/ui/progress";

type Phase = "loading" | "intro" | "quizzing" | "result" | "saving";

const LEVEL_LABELS: Record<string, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper intermediate",
  C1: "Advanced",
  C2: "Mastery",
};

export function PlacementQuiz() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [levelIndex, setLevelIndex] = useState(0);
  const [batch, setBatch] = useState<QuizItem[]>([]);
  const [batchIdx, setBatchIdx] = useState(0);
  const [allAnswers, setAllAnswers] = useState<QuizAnswer[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    void getContentRepository()
      .getProfile()
      .then((profile) => {
        if (profile?.cefrLevel) {
          router.replace(profile.goals.length > 0 ? "/" : "/onboarding/goals");
          return;
        }
        setPhase("intro");
      })
      .catch(() => setPhase("intro"));
  }, [router]);

  function startQuiz() {
    setBatch(buildQuizBatch(CEFR_ORDER[0]));
    setBatchIdx(0);
    setLevelIndex(0);
    setAllAnswers([]);
    setPhase("quizzing");
  }

  function handleAnswer(known: boolean) {
    const item = batch[batchIdx];
    const answer: QuizAnswer = { ...item, known };
    const updatedAnswers = [...allAnswers, answer];
    setAllAnswers(updatedAnswers);

    if (batchIdx + 1 < batch.length) {
      setBatchIdx(batchIdx + 1);
      return;
    }

    // Batch complete — check whether to advance or stop
    const batchAnswers = updatedAnswers.slice(-batch.length);
    const advance = shouldAdvance(batchAnswers);
    const nextIdx = levelIndex + 1;

    if (advance && nextIdx < CEFR_ORDER.length) {
      setBatch(buildQuizBatch(CEFR_ORDER[nextIdx]));
      setBatchIdx(0);
      setLevelIndex(nextIdx);
    } else {
      setResult(scoreQuiz(updatedAnswers));
      setPhase("result");
    }
  }

  async function handleSave() {
    if (!result) return;
    setPhase("saving");
    try {
      const repo = getContentRepository();
      const existing = await repo.getProfile();
      const profile: Profile = {
        cefrLevel: result.estimatedLevel,
        goals: existing?.goals ?? [],
        createdAt: existing?.createdAt ?? new Date(),
        settings: existing?.settings ?? {},
      };
      await repo.saveProfile(profile);
      router.replace("/onboarding/goals");
    } catch {
      setPhase("result"); // allow retry
    }
  }

  // ── loading ──────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted text-sm">Loading…</p>
      </div>
    );
  }

  // ── intro ─────────────────────────────────────────────────────────────────

  if (phase === "intro") {
    return (
      <div
        data-testid="quiz-intro"
        className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16"
      >
        <div className="w-full max-w-sm text-center">
          <h1 className="text-foreground text-3xl font-semibold tracking-tight">
            Discover your level
          </h1>
          <p className="text-muted mt-4 text-base leading-7">
            We&apos;ll show you words one at a time. Tap &ldquo;Know it&rdquo; if you know the word,
            or &ldquo;Don&apos;t know&rdquo; if you don&apos;t. Be honest — the quiz works better
            that way.
          </p>
          <Button
            data-testid="quiz-start-btn"
            size="lg"
            className="mt-8 w-full"
            onClick={startQuiz}
          >
            Start quiz
          </Button>
        </div>
      </div>
    );
  }

  // ── quizzing ──────────────────────────────────────────────────────────────

  if (phase === "quizzing") {
    const currentItem = batch[batchIdx];
    const progressValue = Math.round((batchIdx / batch.length) * 100);

    return (
      <div
        data-testid="quiz-quizzing"
        className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16"
      >
        <div className="w-full max-w-sm">
          <div className="mb-4 flex items-center justify-between text-xs">
            <span className="bg-foreground/[0.06] text-muted rounded-full px-3 py-1 font-medium">
              Level {CEFR_ORDER[levelIndex]}
            </span>
            <span className="text-muted">
              {batchIdx + 1} / {batch.length}
            </span>
          </div>
          <Progress value={progressValue} className="mb-10" />

          <div className="mb-12 text-center">
            <span
              data-testid="quiz-word"
              className="text-foreground text-5xl font-semibold tracking-tight"
            >
              {currentItem.word}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              data-testid="btn-unknown"
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => handleAnswer(false)}
            >
              Don&apos;t know
            </Button>
            <Button
              data-testid="btn-known"
              size="lg"
              className="w-full"
              onClick={() => handleAnswer(true)}
            >
              Know it
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── result / saving ───────────────────────────────────────────────────────

  const isSaving = phase === "saving";

  return (
    <div
      data-testid="quiz-result"
      className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16"
    >
      <div className="w-full max-w-sm text-center">
        <p className="text-muted text-sm font-medium tracking-widest uppercase">
          Your estimated level
        </p>
        <p
          data-testid="quiz-result-level"
          className="text-foreground mt-3 text-7xl font-semibold tracking-tight"
        >
          {result?.estimatedLevel}
        </p>
        <p className="text-muted mt-1 text-lg">
          {result ? LEVEL_LABELS[result.estimatedLevel] : ""}
        </p>

        {result?.confidence === "low" && (
          <p className="text-warning mt-4 text-sm">
            Some answers seemed inconsistent — your actual level may differ.
          </p>
        )}

        <Button
          data-testid="btn-save-level"
          size="lg"
          className="mt-10 w-full"
          disabled={isSaving}
          onClick={() => void handleSave()}
        >
          {isSaving ? "Saving…" : `Start learning at ${result?.estimatedLevel ?? ""}`}
        </Button>
      </div>
    </div>
  );
}
