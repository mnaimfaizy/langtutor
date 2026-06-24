import "server-only";

import type { Transcriber } from "./transcriber";
import { WhisperTranscriber } from "./whisper-transcriber";

const DEFAULT_STT_URL = "http://localhost:8080";

/**
 * Server-only composition root for the Transcriber seam (PLAN §2.3). Imported only by
 * route handlers under `app/api/stt/*` — never by client code (`server-only` makes that
 * a build error). Built fresh per call so it always reflects the current env.
 */
export function getTranscriber(): Transcriber {
  const url = process.env.MAC_STT_URL ?? DEFAULT_STT_URL;
  return new WhisperTranscriber(url);
}
