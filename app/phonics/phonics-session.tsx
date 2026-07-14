"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { phonicsAudioUrl, phonicsWordAudioUrl, phonicsWordImageUrl } from "@/lib/phonics/media-urls";
import {
  buildPhonicsChoices,
  isLastPhonicsRound,
  isPhonicsComplete,
  nextPhonicsRoundIndex,
  phonicsRoundAt,
  phonicsRoundCount,
  scorePhonicsTap,
  type PhonicsSessionConfig,
  type PhonicsTapResult,
} from "@/lib/phonics/phonics-session";
import { buildPhonicsVocabSession } from "@/lib/path/pre-a1-vocab-rounds";
import { completeUnitActivity } from "@/lib/path/unit-player";
import { getContentRepository } from "@/lib/registry";
import { cn } from "@/ui/cn";
import { BackLink, Button, Card, Progress } from "@/ui";

import {
  EmbeddedUnitBanner,
  PreviewTemplateBanner,
  useEmbeddedActivity,
} from "@/app/path/embedded";
import { usePreA1ActivityVocab } from "@/app/path/use-pre-a1-activity-vocab";

export function PhonicsSession() {
  const router = useRouter();
  const embedded = useEmbeddedActivity();
  const vocab = usePreA1ActivityVocab();
  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [tapResult, setTapResult] = useState<PhonicsTapResult | null>(null);
  const [completing, setCompleting] = useState(false);
  const completedRef = useRef(false);

  const sessionConfig: PhonicsSessionConfig | undefined = useMemo(() => {
    if (vocab.status !== "ready" || vocab.words.length === 0) return undefined;
    const built = buildPhonicsVocabSession(vocab.words);
    return built ?? undefined;
  }, [vocab]);

  const roundCount = phonicsRoundCount(sessionConfig);
  const round = phonicsRoundAt(roundIndex, sessionConfig);
  const choices = useMemo(
    () => buildPhonicsChoices(roundIndex, undefined, sessionConfig),
    [roundIndex, sessionConfig],
  );
  const isPreview = vocab.status === "ready" && vocab.mode === "preview";
  const isWordAnchored = Boolean(round?.anchorWord);

  useEffect(() => {
    if (!round || selectedLetter !== null) return;
    const src = round.anchorWord
      ? phonicsWordAudioUrl(round.anchorWord)
      : phonicsAudioUrl(round.target.letter);
    const audio = new Audio(src);
    void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
    };
  }, [round, selectedLetter]);

  async function finishActivity() {
    if (isPreview) {
      router.push("/admin/path");
      return;
    }
    if (!embedded || completedRef.current) return;
    completedRef.current = true;
    setCompleting(true);
    try {
      const repo = getContentRepository();
      const units = await repo.getUnits();
      await completeUnitActivity(repo, units, embedded.unitId, embedded.activityIndex);
    } finally {
      router.push(`/path/${embedded.unitId}`);
    }
  }

  function handleChoiceTap(letter: string) {
    if (!round || selectedLetter !== null) return;
    setSelectedLetter(letter);
    setTapResult(scorePhonicsTap(letter, roundIndex, sessionConfig));
  }

  function handleReplaySound() {
    if (!round) return;
    const src = round.anchorWord
      ? phonicsWordAudioUrl(round.anchorWord)
      : phonicsAudioUrl(round.target.letter);
    void new Audio(src).play().catch(() => undefined);
  }

  function handleAdvance() {
    if (!round) return;
    if (isPhonicsComplete(roundIndex, sessionConfig)) {
      void finishActivity();
      return;
    }
    const next = nextPhonicsRoundIndex(roundIndex, sessionConfig);
    if (next !== null) {
      setRoundIndex(next);
      setSelectedLetter(null);
      setTapResult(null);
    }
  }

  if (vocab.status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-muted text-sm">Loading…</p>
      </div>
    );
  }

  if (!round || roundCount === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-muted text-sm">Nothing to show.</p>
      </div>
    );
  }

  const progressValue = ((roundIndex + 1) / roundCount) * 100;
  const awaitingAdvance = selectedLetter !== null;
  const prompt = isWordAnchored
    ? "Which letter starts this word?"
    : "Which letter makes this sound?";

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-lg">
        {isPreview && vocab.previewTemplateId ? (
          <PreviewTemplateBanner templateId={vocab.previewTemplateId} />
        ) : embedded ? (
          <EmbeddedUnitBanner unitId={embedded.unitId} />
        ) : (
          <BackLink href="/home" label="Home" className="mb-6" />
        )}

        <div className="mb-6">
          <Progress value={progressValue} aria-label="Phonics progress" />
          <p className="text-muted mt-2 text-center text-xs">
            Round {roundIndex + 1} of {roundCount}
          </p>
        </div>

        <Card className="flex flex-col gap-6 px-6 py-10 text-center">
          <div>
            <p className="text-foreground text-lg font-semibold">{prompt}</p>
            {round.anchorWord ? (
              <div className="mt-4 flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- same-origin media resolve URL */}
                <img
                  src={phonicsWordImageUrl(round.anchorWord)}
                  alt={round.anchorWord}
                  width={160}
                  height={160}
                  className="size-32 object-contain sm:size-40"
                  data-testid="phonics-anchor-image"
                />
                <p
                  className="text-foreground text-2xl font-bold tracking-wide"
                  data-testid="phonics-anchor-word"
                >
                  {round.anchorWord}
                </p>
              </div>
            ) : null}
            <Button
              data-testid="btn-phonics-listen"
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={handleReplaySound}
            >
              Listen again
            </Button>
          </div>

          <div
            data-testid="phonics-choices"
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            role="group"
            aria-label="Letter choices"
          >
            {choices.map((choice) => {
              const isSelected = selectedLetter === choice.letter;
              const isCorrect = choice.letter === round.target.letter;
              const showCorrect = awaitingAdvance && isCorrect;
              const showIncorrect = awaitingAdvance && isSelected && tapResult === "incorrect";

              return (
                <button
                  key={choice.letter}
                  type="button"
                  data-testid={`phonics-choice-${choice.letter}`}
                  disabled={awaitingAdvance}
                  onClick={() => handleChoiceTap(choice.letter)}
                  className={cn(
                    "rounded-xl border px-3 py-4 text-2xl font-bold transition-[colors,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                    "focus-visible:ring-accent focus-visible:ring-offset-background",
                    showCorrect
                      ? "border-success bg-success/15 text-success"
                      : showIncorrect
                        ? "border-danger bg-danger/10 text-danger"
                        : isSelected
                          ? "border-accent bg-accent/10 text-foreground"
                          : "border-border bg-card text-foreground hover:border-foreground/30",
                    awaitingAdvance && !showCorrect && !showIncorrect && "opacity-60",
                  )}
                  aria-pressed={isSelected}
                >
                  {choice.letter.toUpperCase()}
                </button>
              );
            })}
          </div>

          {tapResult === "correct" && (
            <p data-testid="phonics-feedback" className="text-success text-sm font-medium">
              Nice! {round.anchorWord ? `${round.anchorWord} starts with` : "That's"}{" "}
              {round.target.letter.toUpperCase()}.
            </p>
          )}
          {tapResult === "incorrect" && (
            <p data-testid="phonics-feedback" className="text-danger text-sm font-medium">
              Not quite — listen again. It&apos;s {round.target.letter.toUpperCase()}.
            </p>
          )}

          {awaitingAdvance && (
            <Button
              data-testid="btn-phonics-next"
              variant="gradient"
              size="lg"
              disabled={completing}
              onClick={handleAdvance}
            >
              {isLastPhonicsRound(roundIndex, sessionConfig)
                ? completing
                  ? "Saving…"
                  : isPreview
                    ? "Done"
                    : "Finish"
                : isWordAnchored
                  ? "Next word"
                  : "Next sound"}
            </Button>
          )}
        </Card>

        {!embedded && !isPreview && (
          <p className="text-muted mt-6 text-center text-sm">
            Open this from your learning path to track progress.
          </p>
        )}

        {(embedded || isPreview) && !awaitingAdvance && (
          <p className="text-muted mt-4 text-center text-xs">
            {isWordAnchored
              ? "Tap the letter that starts this word."
              : "Tap the letter that matches the sound."}
          </p>
        )}

        {!embedded && !isPreview && (
          <div className="mt-8 flex justify-center">
            <Link href="/home">
              <Button variant="ghost" size="sm">
                Back to home
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
