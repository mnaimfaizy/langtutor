import "server-only";

import type { Transcriber } from "./transcriber";
import { getRuntimeSttUrl } from "./runtime-config";
import { WhisperTranscriber } from "./whisper-transcriber";

const DEFAULT_STT_URL = "http://localhost:8080";

/**
 * Server-only composition root for the Transcriber seam (PLAN §2.3). Imported only by
 * route handlers under `app/api/stt/*` — never by client code (`server-only` makes that
 * a build error). Runtime override (set via `POST /api/stt/config`) takes precedence over
 * the env default, matching the same pattern as `lib/llm/server.ts`.
 */
export function getTranscriber(): Transcriber {
  const url = getRuntimeSttUrl() ?? process.env.MAC_STT_URL ?? DEFAULT_STT_URL;
  return new WhisperTranscriber(url);
}
