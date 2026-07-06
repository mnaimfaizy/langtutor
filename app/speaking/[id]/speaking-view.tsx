"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { Content } from "@/lib/db";
import { PassageSchema } from "@/lib/content/passage";
import { createSpeakingErrorEvents } from "@/lib/diagnostics/speaking";
import { computeWer } from "@/lib/diagnostics/wer";
import type { WerResult } from "@/lib/diagnostics/wer";
import { useRecorder } from "@/lib/audio/use-recorder";
import { getContentRepository } from "@/lib/registry";
import { TranscribeResponseSchema } from "../transcribe-schema";
import { CEFR_BADGE_VARIANT } from "@/lib/cefr";
import { Badge, BackLink, Button, Card } from "@/ui";
import { TtsButton } from "@/ui/tts-button";
import { WerDisplay } from "@/ui/wer-display";

type LoadPhase = "loading" | "ready" | "notFound" | "error";
type TranscribeState = "idle" | "loading" | "done" | "mac-unavailable" | "error";

export function SpeakingView({ id }: { id: number }) {
  const [phase, setPhase] = useState<LoadPhase>(() =>
    isNaN(id) || id <= 0 ? "notFound" : "loading",
  );
  const [content, setContent] = useState<Content | null>(null);
  const [passage, setPassage] = useState<{ title: string; body: string } | null>(null);
  const [transcribeState, setTranscribeState] = useState<TranscribeState>("idle");
  const [werResult, setWerResult] = useState<WerResult | null>(null);
  const transcribeInFlight = useRef(false);

  const { state: micState, blob, start, stop } = useRecorder();
  const isRecording = micState === "recording";
  const isMicBusy = micState === "requesting" || micState === "processing";
  const micDenied = micState === "denied";

  useEffect(() => {
    if (isNaN(id) || id <= 0) return;
    let active = true;
    void getContentRepository()
      .getContent(id)
      .then((row) => {
        if (!active) return;
        if (!row || row.type !== "passage") {
          setPhase("notFound");
        } else {
          const p = PassageSchema.safeParse(row.payload);
          setContent(row);
          setPassage(p.success ? { title: p.data.title, body: p.data.body } : null);
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

  async function handleTranscribe() {
    if (transcribeInFlight.current || !blob || !content) return;
    transcribeInFlight.current = true;
    setTranscribeState("loading");
    setWerResult(null);

    try {
      const reference = passage?.body ?? "";
      if (!reference) {
        setTranscribeState("error");
        return;
      }

      const form = new FormData();
      form.append("audio", blob, "audio.wav");

      const res = await fetch("/api/stt/transcribe", { method: "POST", body: form });
      if (res.status === 502) {
        setTranscribeState("mac-unavailable");
        return;
      }
      if (!res.ok) {
        setTranscribeState("error");
        return;
      }

      const json: unknown = await res.json();
      const transcribeResult = TranscribeResponseSchema.safeParse(json);
      if (!transcribeResult.success) {
        setTranscribeState("error");
        return;
      }
      const { transcript } = transcribeResult.data;

      const result = computeWer(reference, transcript);
      setWerResult(result);
      setTranscribeState("done");

      if (isFinite(result.wer)) {
        const repo = getContentRepository();
        const now = new Date();
        for (const event of createSpeakingErrorEvents(result.alignment, content.level, now)) {
          try {
            await repo.addErrorEvent(event);
          } catch {
            // partial write — continue
          }
        }
      }
    } finally {
      transcribeInFlight.current = false;
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-muted text-sm">Loading…</p>
      </div>
    );
  }

  if (phase === "notFound" || !content) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <p className="text-foreground text-base font-semibold">Passage not found</p>
        <p className="text-muted mt-2 text-sm">It may have been removed or the link is invalid.</p>
        <Link href="/speaking" className="mt-8">
          <Button variant="secondary" size="lg">
            Back to Speaking
          </Button>
        </Link>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <p className="text-danger text-base font-semibold">Something went wrong</p>
        <Link href="/speaking" className="mt-8">
          <Button variant="secondary" size="lg">
            Back to Speaking
          </Button>
        </Link>
      </div>
    );
  }

  const title = passage?.title ?? content.topic;
  const body = passage?.body ?? "";

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        {/* Header */}
        <div>
          <BackLink href="/speaking" label="Speaking" className="mb-1" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-foreground text-xl font-semibold">{title}</h1>
              <p className="text-muted mt-1 flex items-center gap-1.5 text-sm capitalize">
                {content.topic} ·{" "}
                <Badge variant={CEFR_BADGE_VARIANT[content.level]} size="sm">
                  {content.level}
                </Badge>
              </p>
            </div>
            {body && <TtsButton text={body} />}
          </div>
        </div>

        {/* Passage text — shown upfront so the user can read it */}
        {body && (
          <Card>
            <p className="text-foreground text-sm leading-7 whitespace-pre-wrap">{body}</p>
          </Card>
        )}

        {/* Instructions */}
        <p className="text-muted text-sm">
          Read the passage aloud, then press <strong>Stop</strong> and <strong>Transcribe</strong>{" "}
          to score your pronunciation.
        </p>

        {/* Recorder controls */}
        <div className="flex flex-wrap gap-3">
          {!isRecording ? (
            <Button
              variant="gradient"
              onClick={() => {
                setTranscribeState("idle");
                setWerResult(null);
                void start();
              }}
              disabled={isMicBusy}
              aria-label="Start recording"
            >
              {isMicBusy ? "Please wait…" : "Record"}
            </Button>
          ) : (
            <Button variant="secondary" onClick={stop} aria-label="Stop recording">
              Stop
            </Button>
          )}

          {blob && !isRecording && (
            <Button
              variant="secondary"
              onClick={() => void handleTranscribe()}
              disabled={transcribeState === "loading"}
              aria-label="Transcribe and score"
            >
              {transcribeState === "loading" ? "Scoring…" : "Transcribe & Score"}
            </Button>
          )}
        </div>

        {isRecording && (
          <p className="text-warning flex items-center gap-2 text-sm font-medium" role="status">
            <span className="bg-warning size-2 shrink-0 animate-pulse rounded-full" aria-hidden />
            Recording — read the passage, then press Stop
          </p>
        )}

        {micDenied && (
          <p className="text-danger text-sm" role="alert">
            Microphone access was denied. Please allow microphone access in your browser settings
            and try again.
          </p>
        )}

        {micState === "error" && (
          <p className="text-danger text-sm" role="alert">
            Something went wrong capturing audio. Please try again.
          </p>
        )}

        {/* Mac unavailable */}
        {transcribeState === "mac-unavailable" && (
          <Card
            className="border-warning/30 bg-warning/10"
            data-testid="transcript-mac-unavailable"
            role="alert"
          >
            <p className="text-warning text-sm font-medium">Mac STT server not reachable</p>
            <p className="text-muted mt-1 text-sm">
              Start your whisper-server on the Mac and make sure{" "}
              <code className="bg-card rounded px-1">MAC_STT_URL</code> is set in{" "}
              <code className="bg-card rounded px-1">.env.local</code>, then try again.
            </p>
          </Card>
        )}

        {transcribeState === "error" && (
          <p className="text-danger text-sm" role="alert">
            Transcription failed — please try again.
          </p>
        )}

        {/* WER result */}
        {werResult && <WerDisplay result={werResult} scoreLabel="Pronunciation score" />}
      </div>
    </div>
  );
}
