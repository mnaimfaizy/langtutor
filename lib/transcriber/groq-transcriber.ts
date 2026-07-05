import "server-only";

import { z } from "zod";

import { GROQ_OPENAI_BASE_URL, GROQ_WHISPER_MODEL } from "@/lib/ai/groq";

import type { Transcriber } from "./transcriber";

const GroqTranscriptionResponseSchema = z.object({ text: z.string() });

/**
 * Calls Groq's OpenAI-compatible `POST /audio/transcriptions` endpoint using
 * `whisper-large-v3`. The API key is read from server env only (ADR 0010).
 */
export class GroqTranscriber implements Transcriber {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = GROQ_WHISPER_MODEL,
  ) {}

  async transcribe(audio: Blob): Promise<string> {
    const form = new FormData();
    form.append("file", audio, "audio.wav");
    form.append("model", this.model);
    form.append("response_format", "json");

    let res: Response;
    try {
      res = await fetch(`${GROQ_OPENAI_BASE_URL}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
      });
    } catch (cause) {
      throw new Error("Groq STT not reachable", { cause });
    }

    if (!res.ok) {
      throw new Error(`Groq STT returned ${res.status}`);
    }

    const raw: unknown = await res.json();
    const { text } = GroqTranscriptionResponseSchema.parse(raw);
    return text.trim();
  }
}
