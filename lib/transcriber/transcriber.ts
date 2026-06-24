/**
 * Transcriber seam (PLAN §2.3). Feature/server code imports **this interface**; the
 * concrete (`WhisperTranscriber`) is wired in `lib/transcriber/server.ts`.
 * "Move to Azure/cloud STT later" = swap the concrete there, not at any call site.
 *
 * The concrete only ever runs server-side (`app/api/stt/*`); the browser reaches it
 * through those same-origin routes, never directly (PLAN §2.1).
 */
export interface Transcriber {
  /** Transcribe an audio blob to text. Rejects if the backend is unreachable. */
  transcribe(audio: Blob): Promise<string>;
}
