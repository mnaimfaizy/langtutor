"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  buildListenTapChoices,
  isLastListenTapRound,
  isListenTapComplete,
  listenTapRoundAt,
  nextListenTapRoundIndex,
  scoreListenTapTap,
  type ListenTapTapResult,
} from "@/lib/listen-tap/listen-tap-session";
import { listenTapAudioUrl, listenTapImageUrl } from "@/lib/listen-tap/media-urls";
import { LISTEN_TAP_ROUND_COUNT } from "@/lib/listen-tap/vocab";
import { completeUnitActivity } from "@/lib/path/unit-player";
import { getContentRepository } from "@/lib/registry";
import { cn } from "@/ui/cn";
import { BackLink, Button, Card, Progress } from "@/ui";

import { EmbeddedUnitBanner, useEmbeddedActivity } from "@/app/path/embedded";

export function ListenTapSession() {
  const router = useRouter();
  const embedded = useEmbeddedActivity();
  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [tapResult, setTapResult] = useState<ListenTapTapResult | null>(null);
  const [completing, setCompleting] = useState(false);
  const completedRef = useRef(false);

  const round = listenTapRoundAt(roundIndex);
  const choices = useMemo(() => buildListenTapChoices(roundIndex), [roundIndex]);

  useEffect(() => {
    if (!round || selectedWord !== null) return;
    const audio = new Audio(listenTapAudioUrl(round.def.audioKey));
    void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
    };
  }, [round, selectedWord]);

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

  function handleChoiceTap(word: string) {
    if (!round || selectedWord !== null) return;
    setSelectedWord(word);
    setTapResult(scoreListenTapTap(word, roundIndex));
  }

  function handleReplaySound() {
    if (!round) return;
    void new Audio(listenTapAudioUrl(round.def.audioKey)).play().catch(() => undefined);
  }

  function handleAdvance() {
    if (!round) return;
    if (isListenTapComplete(roundIndex)) {
      void finishActivity();
      return;
    }
    const next = nextListenTapRoundIndex(roundIndex);
    if (next !== null) {
      setRoundIndex(next);
      setSelectedWord(null);
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

  const progressValue = ((roundIndex + 1) / LISTEN_TAP_ROUND_COUNT) * 100;
  const awaitingAdvance = selectedWord !== null;

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-lg">
        {embedded ? (
          <EmbeddedUnitBanner unitId={embedded.unitId} />
        ) : (
          <BackLink href="/home" label="Home" className="mb-6" />
        )}

        <div className="mb-6">
          <Progress value={progressValue} aria-label="Listen and tap progress" />
          <p className="text-muted mt-2 text-center text-xs">
            Round {roundIndex + 1} of {LISTEN_TAP_ROUND_COUNT}
          </p>
        </div>

        <Card className="flex flex-col gap-6 px-6 py-10 text-center">
          <div>
            <p className="text-foreground text-lg font-semibold">{round.def.prompt}</p>
            <Button
              data-testid="btn-listen-tap-listen"
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={handleReplaySound}
            >
              Listen again
            </Button>
          </div>

          <div
            data-testid="listen-tap-choices"
            className="grid grid-cols-2 gap-3"
            role="group"
            aria-label="Picture choices"
          >
            {choices.map((choice) => {
              const isSelected = selectedWord === choice.word;
              const isCorrect = choice.word === round.def.targetWord;
              const showCorrect = awaitingAdvance && isCorrect;
              const showIncorrect = awaitingAdvance && isSelected && tapResult === "incorrect";

              return (
                <button
                  key={choice.word}
                  type="button"
                  data-testid={`listen-tap-choice-${choice.word}`}
                  disabled={awaitingAdvance}
                  onClick={() => handleChoiceTap(choice.word)}
                  className={cn(
                    "rounded-xl border p-3 transition-[colors,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                    "focus-visible:ring-accent focus-visible:ring-offset-background",
                    showCorrect
                      ? "border-success bg-success/15"
                      : showIncorrect
                        ? "border-danger bg-danger/10"
                        : isSelected
                          ? "border-accent bg-accent/10"
                          : "border-border bg-card hover:border-foreground/30",
                    awaitingAdvance && !showCorrect && !showIncorrect && "opacity-60",
                  )}
                  aria-pressed={isSelected}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- same-origin media resolve URL */}
                  <img
                    src={listenTapImageUrl(choice.word)}
                    alt={choice.word}
                    width={128}
                    height={128}
                    className="mx-auto size-24 object-contain sm:size-28"
                  />
                </button>
              );
            })}
          </div>

          {tapResult === "correct" && (
            <p data-testid="listen-tap-feedback" className="text-success text-sm font-medium">
              Great job! That&apos;s {round.def.targetWord}.
            </p>
          )}
          {tapResult === "incorrect" && (
            <p data-testid="listen-tap-feedback" className="text-danger text-sm font-medium">
              Not quite — listen again. It&apos;s {round.def.targetWord}.
            </p>
          )}

          {awaitingAdvance && (
            <Button
              data-testid="btn-listen-tap-next"
              variant="gradient"
              size="lg"
              disabled={completing}
              onClick={handleAdvance}
            >
              {isLastListenTapRound(roundIndex)
                ? completing
                  ? "Saving…"
                  : "Finish"
                : "Next round"}
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
            Listen, then tap the picture that matches.
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
