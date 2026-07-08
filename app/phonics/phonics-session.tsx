"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ALPHABET_LENGTH } from "@/lib/alphabet/vocab";
import { phonicsAudioUrl } from "@/lib/phonics/media-urls";
import {
  buildPhonicsChoices,
  isLastPhonicsRound,
  isPhonicsComplete,
  nextPhonicsRoundIndex,
  phonicsRoundAt,
  scorePhonicsTap,
  type PhonicsTapResult,
} from "@/lib/phonics/phonics-session";
import { completeUnitActivity } from "@/lib/path/unit-player";
import { getContentRepository } from "@/lib/registry";
import { cn } from "@/ui/cn";
import { BackLink, Button, Card, Progress } from "@/ui";

import { EmbeddedUnitBanner, useEmbeddedActivity } from "@/app/path/embedded";

export function PhonicsSession() {
  const router = useRouter();
  const embedded = useEmbeddedActivity();
  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [tapResult, setTapResult] = useState<PhonicsTapResult | null>(null);
  const [completing, setCompleting] = useState(false);
  const completedRef = useRef(false);

  const round = phonicsRoundAt(roundIndex);
  const choices = useMemo(() => buildPhonicsChoices(roundIndex), [roundIndex]);

  useEffect(() => {
    if (!round || selectedLetter !== null) return;
    const audio = new Audio(phonicsAudioUrl(round.target.letter));
    void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
    };
  }, [round, selectedLetter]);

  async function finishActivity() {
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
    setTapResult(scorePhonicsTap(letter, roundIndex));
  }

  function handleReplaySound() {
    if (!round) return;
    void new Audio(phonicsAudioUrl(round.target.letter)).play().catch(() => undefined);
  }

  function handleAdvance() {
    if (!round) return;
    if (isPhonicsComplete(roundIndex)) {
      void finishActivity();
      return;
    }
    const next = nextPhonicsRoundIndex(roundIndex);
    if (next !== null) {
      setRoundIndex(next);
      setSelectedLetter(null);
      setTapResult(null);
    }
  }

  if (!round) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-muted text-sm">Nothing to show.</p>
      </div>
    );
  }

  const progressValue = ((roundIndex + 1) / ALPHABET_LENGTH) * 100;
  const awaitingAdvance = selectedLetter !== null;

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-lg">
        {embedded ? (
          <EmbeddedUnitBanner unitId={embedded.unitId} />
        ) : (
          <BackLink href="/home" label="Home" className="mb-6" />
        )}

        <div className="mb-6">
          <Progress value={progressValue} aria-label="Phonics progress" />
          <p className="text-muted mt-2 text-center text-xs">
            Round {roundIndex + 1} of {ALPHABET_LENGTH}
          </p>
        </div>

        <Card className="flex flex-col gap-6 px-6 py-10 text-center">
          <div>
            <p className="text-foreground text-lg font-semibold">Which letter makes this sound?</p>
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
              Nice! That&apos;s {round.target.letter.toUpperCase()}.
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
              {isLastPhonicsRound(roundIndex) ? (completing ? "Saving…" : "Finish") : "Next sound"}
            </Button>
          )}
        </Card>

        {!embedded && (
          <p className="text-muted mt-6 text-center text-sm">
            Open this from your learning path to track progress.
          </p>
        )}

        {embedded && !awaitingAdvance && (
          <p className="text-muted mt-4 text-center text-xs">
            Tap the letter that matches the sound.
          </p>
        )}

        {!embedded && (
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
