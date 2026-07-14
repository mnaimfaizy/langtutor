"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  alphabetEntryAt,
  canAdvanceAlphabet,
  isAlphabetComplete,
  isLastAlphabetIndex,
  nextAlphabetIndex,
} from "@/lib/alphabet/alphabet-session";
import { alphabetAudioUrl, alphabetImageUrl } from "@/lib/alphabet/media-urls";
import { ALPHABET_LENGTH } from "@/lib/alphabet/vocab";
import { completeUnitActivity } from "@/lib/path/unit-player";
import { getContentRepository } from "@/lib/registry";
import { BackLink, Button, Card, Progress } from "@/ui";

import { EmbeddedUnitBanner, PreviewTemplateBanner, useEmbeddedActivity } from "@/app/path/embedded";
import { usePreA1ActivityVocab } from "@/app/path/use-pre-a1-activity-vocab";

export function AlphabetSession() {
  const router = useRouter();
  const embedded = useEmbeddedActivity();
  const vocab = usePreA1ActivityVocab();
  const [index, setIndex] = useState(0);
  const [completing, setCompleting] = useState(false);
  const completedRef = useRef(false);
  const isPreview = vocab.status === "ready" && vocab.mode === "preview";

  const entry = alphabetEntryAt(index);

  useEffect(() => {
    if (!entry) return;
    const audio = new Audio(alphabetAudioUrl(entry.letter));
    void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
    };
  }, [entry]);

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

  function handleAdvance() {
    if (!entry) return;
    if (isAlphabetComplete(index)) {
      void finishActivity();
      return;
    }
    const next = nextAlphabetIndex(index);
    if (next !== null) setIndex(next);
  }

  function handleReplaySound() {
    if (!entry) return;
    void new Audio(alphabetAudioUrl(entry.letter)).play().catch(() => undefined);
  }

  if (!entry) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-muted text-sm">Nothing to show.</p>
      </div>
    );
  }

  const progressValue = ((index + 1) / ALPHABET_LENGTH) * 100;

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
          <Progress value={progressValue} aria-label="Alphabet progress" />
          <p className="text-muted mt-2 text-center text-xs">
            Letter {index + 1} of {ALPHABET_LENGTH}
          </p>
        </div>

        <Card className="flex flex-col items-center gap-6 px-6 py-10 text-center">
          <p
            data-testid="alphabet-letter"
            className="text-foreground text-7xl leading-none font-bold tracking-tight sm:text-8xl"
            aria-label={`Letter ${entry.letter.toUpperCase()}`}
          >
            {entry.letter.toUpperCase()}
          </p>

          {/* eslint-disable-next-line @next/next/no-img-element -- same-origin media resolve URL */}
          <img
            data-testid="alphabet-picture"
            src={alphabetImageUrl(entry.pictureWord)}
            alt={entry.pictureWord}
            width={256}
            height={256}
            className="size-48 object-contain sm:size-56"
          />

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              data-testid="btn-alphabet-listen"
              variant="secondary"
              size="sm"
              onClick={handleReplaySound}
            >
              Listen again
            </Button>
            <Button
              data-testid="btn-alphabet-next"
              variant="gradient"
              size="lg"
              disabled={completing}
              onClick={handleAdvance}
            >
              {isLastAlphabetIndex(index)
                ? completing
                  ? "Saving…"
                  : isPreview
                    ? "Done"
                    : "Finish"
                : "Next letter"}
            </Button>
          </div>
        </Card>

        {!embedded && !isPreview && (
          <p className="text-muted mt-6 text-center text-sm">
            Open this from your learning path to track progress.
          </p>
        )}

        {(embedded || isPreview) && canAdvanceAlphabet(index) && (
          <p className="text-muted mt-4 text-center text-xs">
            Tap through every letter to finish this activity.
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
