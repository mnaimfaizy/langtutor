import "server-only";

import { loadTtsConfig } from "./config";
import { GroqTtsSynthesizer } from "./groq-tts-synthesizer";
import type { TtsSynthesizer } from "./tts-synthesizer";

/**
 * Server-only composition for the TTS seam (ADR 0016). Imported **only** by route handlers
 * under `app/api/audio/*` — never by client code (the `server-only` import makes that a
 * build error).
 */
export async function getTtsSynthesizer(): Promise<TtsSynthesizer> {
  return new GroqTtsSynthesizer(loadTtsConfig());
}
