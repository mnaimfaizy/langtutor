import type { TtsSynthesizeOptions, TtsSynthesizeResult } from "./types";

/**
 * Text-to-speech seam (ADR 0016). Feature/server code imports **this interface**; the
 * concrete is wired in `lib/tts/server.ts`. "Move to a different TTS provider later" =
 * swap the concrete there, not at any call site.
 *
 * The concrete only ever runs server-side (route handlers under `app/api/audio/*`); the
 * browser reaches it through those same-origin routes, never directly.
 */
export interface TtsSynthesizer {
  /** Synthesize spoken audio for `text`. */
  synthesize(text: string, options?: TtsSynthesizeOptions): Promise<TtsSynthesizeResult>;
}
