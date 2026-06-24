"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { Content } from "@/lib/db";
import { PassageSchema } from "@/lib/content/passage";
import { createSpeakingErrorEvents } from "@/lib/diagnostics/speaking";
import { computeWer } from "@/lib/diagnostics/wer";
import type { WerAlignment, WerResult } from "@/lib/diagnostics/wer";
import { useRecorder } from "@/lib/audio/use-recorder";
import { getContentRepository } from "@/lib/registry";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";
import { TtsButton } from "@/ui/tts-button";

type LoadPhase = "loading" | "ready" | "notFound" | "error";
type TranscribeState = "idle" | "loading" | "done" | "mac-unavailable" | "error";

const CEFR_COLOR: Record<string, string> = {
  A1: "text-success",
  A2: "text-success",
  B1: "text-warning",
  B2: "text-warning",
  C1: "text-danger",
  C2: "text-danger",
};

function werColor(wer: number): string {
  if (wer <= 0.2) return "text-success";
  if (wer <= 0.5) return "text-warning";
  return "text-danger";
}

function AlignmentToken({ token }: { token: WerAlignment }) {
  if (token.type === "correct") {
    return <span className="text-foreground">{token.ref}</span>;
  }
  if (token.type === "substitution") {
    return (
      <span>
        <s className="text-danger">{token.ref}</s>{" "}
        <span className="text-warning font-medium">({token.hyp})</span>
      </span>
    );
  }
  if (token.type === "deletion") {
    return <span className="bg-danger/10 text-danger rounded px-0.5 text-sm">[{token.ref}]</span>;
  }
  return <span className="bg-warning/10 text-warning rounded px-0.5 text-sm">+{token.hyp}</span>;
}

function WerDisplay({ result }: { result: WerResult }) {
  const pct = isFinite(result.wer) ? Math.round(result.wer * 100) : 100;
  return (
    <div data-testid="wer-result" className="mt-8 space-y-5">
      <div className="border-border rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-muted text-xs font-medium tracking-wider uppercase">
              Pronunciation score
            </p>
            <p
              data-testid="wer-score"
              className={cn("mt-1 text-4xl font-bold", werColor(result.wer))}
            >
              {100 - pct}
              <span className="text-muted text-lg font-normal">%</span>
            </p>
            <p className="text-muted mt-1 text-xs">accuracy ({pct}% word error rate)</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-muted text-xs font-medium tracking-wider uppercase">Errors</p>
            <p className="text-foreground mt-1">
              {result.substitutions}S · {result.deletions}D · {result.insertions}I
            </p>
          </div>
        </div>
      </div>

      {result.alignment.length > 0 && (
        <div className="border-border rounded-xl border p-5">
          <p className="text-foreground mb-3 text-xs font-medium tracking-wider uppercase">
            Alignment
          </p>
          <p className="text-foreground text-sm leading-8">
            {result.alignment.map((token, i) => (
              <span key={i}>
                {i > 0 && " "}
                <AlignmentToken token={token} />
              </span>
            ))}
          </p>
          <p className="text-muted mt-3 text-xs">
            <span className="text-danger">red strikethrough</span> = wrong word (yours in brackets)
            · <span className="text-danger">[red]</span> = missed word ·{" "}
            <span className="text-warning">+orange</span> = extra word
          </p>
        </div>
      )}
    </div>
  );
}

export function SpeakingView({ id }: { id: number }) {
  const [phase, setPhase] = useState<LoadPhase>(() =>
    isNaN(id) || id <= 0 ? "notFound" : "loading",
  );
  const [content, setContent] = useState<Content | null>(null);
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
          setContent(row);
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

      const { transcript } = (await res.json()) as { transcript: string };
      const parsed = PassageSchema.safeParse(content.payload);
      const reference = parsed.success ? parsed.data.body : "";

      const result = computeWer(reference, transcript);
      setWerResult(result);
      setTranscribeState("done");

      if (reference && isFinite(result.wer)) {
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

  const parsed = PassageSchema.safeParse(content.payload);
  const title = parsed.success ? parsed.data.title : content.topic;
  const body = parsed.success ? parsed.data.body : "";

  return (
    <div className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/speaking"
              className="text-muted hover:text-foreground mb-1 inline-block text-xs"
            >
              ← Speaking
            </Link>
            <h1 className="text-foreground text-xl font-semibold">{title}</h1>
            <p className="text-muted mt-0.5 text-sm capitalize">
              {content.topic} ·{" "}
              <span className={cn("font-semibold", CEFR_COLOR[content.level])}>
                {content.level}
              </span>
            </p>
          </div>
          {body && <TtsButton text={body} />}
        </div>

        {/* Passage text — shown upfront so the user can read it */}
        {body && (
          <div className="border-border bg-card rounded-xl border p-5">
            <p className="text-foreground text-sm leading-7 whitespace-pre-wrap">{body}</p>
          </div>
        )}

        {/* Instructions */}
        <p className="text-muted text-sm">
          Read the passage aloud, then press <strong>Stop</strong> and <strong>Transcribe</strong>{" "}
          to score your pronunciation.
        </p>

        {/* Recorder controls */}
        <div className="flex flex-wrap gap-3">
          {!isRecording ? (
            <Button onClick={() => void start()} disabled={isMicBusy} aria-label="Start recording">
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
            <span aria-hidden>●</span> Recording — read the passage, then press Stop
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
          <div
            className="bg-warning/10 border-warning/30 rounded-lg border p-4 text-sm"
            data-testid="transcript-mac-unavailable"
            role="alert"
          >
            <p className="text-warning font-medium">Mac STT server not reachable</p>
            <p className="text-muted mt-1">
              Start your whisper-server on the Mac and make sure{" "}
              <code className="bg-card rounded px-1">MAC_STT_URL</code> is set in{" "}
              <code className="bg-card rounded px-1">.env.local</code>, then try again.
            </p>
          </div>
        )}

        {transcribeState === "error" && (
          <p className="text-danger text-sm" role="alert">
            Transcription failed — please try again.
          </p>
        )}

        {/* WER result */}
        {werResult && <WerDisplay result={werResult} />}
      </div>
    </div>
  );
}
