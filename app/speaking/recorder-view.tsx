"use client";

import { useState } from "react";

import { useRecorder } from "@/lib/audio/use-recorder";
import { Button } from "@/ui/button";

const MIC_STATE_LABEL: Record<string, string> = {
  requesting: "Requesting microphone access…",
  processing: "Processing audio…",
  denied:
    "Microphone access was denied. Please allow microphone access in your browser settings and try again.",
  error: "Something went wrong capturing audio. Please try again.",
};

type TranscribeState = "idle" | "loading" | "done" | "mac-unavailable" | "error";

export function RecorderView() {
  const { state: micState, blob, start, stop } = useRecorder();
  const [transcribeState, setTranscribeState] = useState<TranscribeState>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);

  const isRecording = micState === "recording";
  const isMicBusy = micState === "requesting" || micState === "processing";
  const micError = micState === "denied" || micState === "error";

  async function handleTranscribe() {
    if (!blob) return;
    setTranscribeState("loading");
    setTranscript(null);

    const form = new FormData();
    form.append("audio", blob, "audio.wav");

    try {
      const res = await fetch("/api/stt/transcribe", { method: "POST", body: form });
      if (res.status === 502) {
        setTranscribeState("mac-unavailable");
        return;
      }
      if (!res.ok) {
        setTranscribeState("error");
        return;
      }
      const { transcript: text } = (await res.json()) as { transcript: string };
      setTranscript(text);
      setTranscribeState("done");
    } catch {
      setTranscribeState("error");
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-12">
      <h1 className="text-2xl font-bold">Speaking practice</h1>
      <p className="text-muted text-sm">
        Record yourself speaking. Your audio is captured locally — nothing leaves your device unless
        you choose to transcribe.
      </p>

      {/* Record / Stop */}
      <div className="flex gap-3">
        {!isRecording ? (
          <Button onClick={() => void start()} disabled={isMicBusy} aria-label="Start recording">
            {isMicBusy ? "Please wait…" : "Record"}
          </Button>
        ) : (
          <Button variant="secondary" onClick={stop} aria-label="Stop recording">
            Stop
          </Button>
        )}
      </div>

      {isRecording && (
        <p className="text-warning flex items-center gap-2 text-sm font-medium" role="status">
          <span aria-hidden>●</span> Recording — press Stop when done
        </p>
      )}

      {MIC_STATE_LABEL[micState] && (
        <p className={micError ? "text-danger text-sm" : "text-muted text-sm"} role="status">
          {MIC_STATE_LABEL[micState]}
        </p>
      )}

      {/* Captured blob info + Transcribe button */}
      {blob && (
        <div
          className="bg-card border-border space-y-3 rounded-lg border p-4 text-sm"
          data-testid="capture-result"
        >
          <p className="text-foreground font-medium">
            Audio captured · {(blob.size / 1024).toFixed(1)} KB · 16 kHz mono WAV
          </p>
          <Button
            size="sm"
            onClick={() => void handleTranscribe()}
            disabled={transcribeState === "loading"}
            aria-label="Transcribe audio"
          >
            {transcribeState === "loading" ? "Transcribing…" : "Transcribe"}
          </Button>
        </div>
      )}

      {/* Transcript result */}
      {transcribeState === "done" && transcript !== null && (
        <div
          className="bg-success/10 border-success/30 rounded-lg border p-4 text-sm"
          data-testid="transcript-result"
        >
          <p className="text-success mb-2 font-medium">Transcript</p>
          <p className="text-foreground">
            {transcript || <em className="text-muted">— empty —</em>}
          </p>
        </div>
      )}

      {/* Offline / needs Mac */}
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
    </div>
  );
}
