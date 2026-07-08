"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  buildPictureMatchChoices,
  isLastPictureMatchRound,
  isPictureMatchComplete,
  nextPictureMatchRoundIndex,
  pictureMatchAudioKeyAt,
  pictureMatchRoundAt,
  scorePictureMatchTap,
  type PictureMatchTapResult,
} from "@/lib/picture-match/picture-match-session";
import { pictureMatchAudioUrl, pictureMatchImageUrl } from "@/lib/picture-match/media-urls";
import { PICTURE_MATCH_ROUND_COUNT } from "@/lib/picture-match/vocab";
import { completeUnitActivity } from "@/lib/path/unit-player";
import { getContentRepository } from "@/lib/registry";
import { cn } from "@/ui/cn";
import { BackLink, Button, Card, Progress } from "@/ui";

import { EmbeddedUnitBanner, useEmbeddedActivity } from "@/app/path/embedded";

export function PictureMatchSession() {
  const router = useRouter();
  const embedded = useEmbeddedActivity();
  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [tapResult, setTapResult] = useState<PictureMatchTapResult | null>(null);
  const [completing, setCompleting] = useState(false);
  const completedRef = useRef(false);

  const round = pictureMatchRoundAt(roundIndex);
  const choices = useMemo(() => buildPictureMatchChoices(roundIndex), [roundIndex]);
  const isWordToPicture = round?.def.direction === "word-to-picture";
  const audioKey = pictureMatchAudioKeyAt(roundIndex);

  useEffect(() => {
    if (!round || !isWordToPicture || !audioKey || selectedWord !== null) return;
    const audio = new Audio(pictureMatchAudioUrl(audioKey));
    void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
    };
  }, [round, isWordToPicture, audioKey, selectedWord]);

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
    setTapResult(scorePictureMatchTap(word, roundIndex));
  }

  function handleReplaySound() {
    if (!audioKey) return;
    void new Audio(pictureMatchAudioUrl(audioKey)).play().catch(() => undefined);
  }

  function handleAdvance() {
    if (!round) return;
    if (isPictureMatchComplete(roundIndex)) {
      void finishActivity();
      return;
    }
    const next = nextPictureMatchRoundIndex(roundIndex);
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

  const progressValue = ((roundIndex + 1) / PICTURE_MATCH_ROUND_COUNT) * 100;
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
          <Progress value={progressValue} aria-label="Picture match progress" />
          <p className="text-muted mt-2 text-center text-xs">
            Round {roundIndex + 1} of {PICTURE_MATCH_ROUND_COUNT}
          </p>
        </div>

        <Card className="flex flex-col gap-6 px-6 py-10 text-center">
          <div>
            <p className="text-foreground text-lg font-semibold">{round.def.prompt}</p>
            {isWordToPicture && (
              <Button
                data-testid="btn-picture-match-listen"
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={handleReplaySound}
              >
                Listen again
              </Button>
            )}
          </div>

          {!isWordToPicture && (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- same-origin media resolve URL */}
              <img
                data-testid="picture-match-prompt-image"
                src={pictureMatchImageUrl(round.def.targetWord)}
                alt=""
                width={160}
                height={160}
                className="size-32 object-contain sm:size-40"
              />
            </div>
          )}

          {isWordToPicture ? (
            <div
              data-testid="picture-match-choices"
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
                    data-testid={`picture-match-choice-${choice.word}`}
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
                      src={pictureMatchImageUrl(choice.word)}
                      alt={choice.word}
                      width={128}
                      height={128}
                      className="mx-auto size-24 object-contain sm:size-28"
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              data-testid="picture-match-choices"
              className="grid grid-cols-2 gap-3"
              role="group"
              aria-label="Word choices"
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
                    data-testid={`picture-match-choice-${choice.word}`}
                    disabled={awaitingAdvance}
                    onClick={() => handleChoiceTap(choice.word)}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-base font-semibold capitalize transition-[colors,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                      "focus-visible:ring-accent focus-visible:ring-offset-background",
                      showCorrect
                        ? "border-success bg-success/15 text-success"
                        : showIncorrect
                          ? "border-danger bg-danger/10 text-danger"
                          : isSelected
                            ? "border-accent bg-accent/10"
                            : "border-border bg-card hover:border-foreground/30",
                      awaitingAdvance && !showCorrect && !showIncorrect && "opacity-60",
                    )}
                    aria-pressed={isSelected}
                  >
                    {choice.word}
                  </button>
                );
              })}
            </div>
          )}

          {tapResult === "correct" && (
            <p data-testid="picture-match-feedback" className="text-success text-sm font-medium">
              Great job! That&apos;s {round.def.targetWord}.
            </p>
          )}
          {tapResult === "incorrect" && (
            <p data-testid="picture-match-feedback" className="text-danger text-sm font-medium">
              Not quite — try again next time. It&apos;s {round.def.targetWord}.
            </p>
          )}

          {awaitingAdvance && (
            <Button
              data-testid="btn-picture-match-next"
              variant="gradient"
              size="lg"
              disabled={completing}
              onClick={handleAdvance}
            >
              {isLastPictureMatchRound(roundIndex)
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
            {isWordToPicture
              ? "Listen, then tap the matching picture."
              : "Look at the picture, then tap the matching word."}
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
