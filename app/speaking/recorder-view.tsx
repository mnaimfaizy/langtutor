"use client";

import { useRecorder } from "@/lib/audio/use-recorder";
import { Button } from "@/ui/button";

const STATE_LABEL: Record<string, string> = {
  idle: "",
  requesting: "Requesting microphone access…",
  recording: "Recording…",
  processing: "Processing audio…",
  denied:
    "Microphone access was denied. Please allow microphone access in your browser settings and try again.",
  error: "Something went wrong capturing audio. Please try again.",
};

export function RecorderView() {
  const { state, blob, start, stop } = useRecorder();

  const isRecording = state === "recording";
  const isBusy = state === "requesting" || state === "processing";
  const isDenied = state === "denied";
  const isError = state === "error";

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-12">
      <h1 className="text-2xl font-bold">Speaking practice</h1>
      <p className="text-muted text-sm">
        Record yourself speaking. Your audio is captured locally — nothing leaves your device.
      </p>

      <div className="flex gap-3">
        {!isRecording ? (
          <Button onClick={() => void start()} disabled={isBusy} aria-label="Start recording">
            {isBusy ? "Please wait…" : "Record"}
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

      {STATE_LABEL[state] && !isRecording && (
        <p
          className={isDenied || isError ? "text-danger text-sm" : "text-muted text-sm"}
          role="status"
        >
          {STATE_LABEL[state]}
        </p>
      )}

      {blob && (
        <div
          className="bg-success/10 border-success/30 rounded-lg border p-4 text-sm"
          data-testid="capture-result"
        >
          <p className="text-success font-medium">Audio captured</p>
          <p className="text-muted mt-1">{(blob.size / 1024).toFixed(1)} KB · 16 kHz mono WAV</p>
        </div>
      )}
    </div>
  );
}
