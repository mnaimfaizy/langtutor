import "server-only";

import { getGroqApiKey } from "@/lib/ai/groq";
import type { SttProvider } from "@/lib/db/drizzle/schema.shared";

import { GroqTranscriber } from "./groq-transcriber";
import { getRuntimeSttProvider, getRuntimeSttUrl } from "./runtime-config";
import type { Transcriber } from "./transcriber";
import { WhisperTranscriber } from "./whisper-transcriber";

const DEFAULT_STT_URL = "http://localhost:8080";
const DEFAULT_STT_PROVIDER: SttProvider = "mac";

/**
 * Server-only composition root for the Transcriber seam (PLAN §2.3). Imported only by
 * route handlers under `app/api/stt/*` — never by client code (`server-only` makes that
 * a build error). Runtime overrides take precedence over env defaults.
 */
export function getTranscriber(): Transcriber {
  const provider = getRuntimeSttProvider() ?? DEFAULT_STT_PROVIDER;

  if (provider === "groq") {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is required when sttProvider is groq");
    }
    return new GroqTranscriber(apiKey);
  }

  const url = getRuntimeSttUrl() ?? process.env.MAC_STT_URL ?? DEFAULT_STT_URL;
  return new WhisperTranscriber(url);
}
