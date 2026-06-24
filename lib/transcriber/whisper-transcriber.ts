import "server-only";

import { z } from "zod";

import type { Transcriber } from "./transcriber";

const WhisperResponseSchema = z.object({ text: z.string() });

/**
 * Calls the Mac whisper.cpp / faster-whisper HTTP server at `POST /inference`.
 * Standard whisper.cpp server ships with this endpoint; it accepts `file` + optional
 * `response_format=json` in a multipart form and returns `{ "text": "…" }`.
 */
export class WhisperTranscriber implements Transcriber {
  constructor(private readonly baseUrl: string) {}

  async transcribe(audio: Blob): Promise<string> {
    const form = new FormData();
    form.append("file", audio, "audio.wav");
    form.append("response_format", "json");

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/inference`, { method: "POST", body: form });
    } catch (cause) {
      throw new Error("Mac STT server not reachable", { cause });
    }

    if (!res.ok) {
      throw new Error(`Whisper server returned ${res.status}`);
    }

    const raw: unknown = await res.json();
    const { text } = WhisperResponseSchema.parse(raw);
    return text.trim();
  }
}
