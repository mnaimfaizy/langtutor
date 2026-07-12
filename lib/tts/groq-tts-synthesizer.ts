import "server-only";

import { z } from "zod";

import type { TtsConfig } from "./config";
import { TTS_MAX_SPOKEN_TEXT_CHARS } from "./prompts";
import { GROQ_ORPHEUS_VOICES, resolveTtsOptions } from "./speech-synthesis";
import type { TtsSynthesizer } from "./tts-synthesizer";
import type { TtsSynthesizeOptions, TtsSynthesizeResult } from "./types";

/** Groq speech API error body — Zod-parsed at the boundary (hard rule #3). */
const GroqSpeechError = z.object({
  error: z
    .object({
      message: z.string().optional(),
    })
    .optional(),
});

/**
 * {@link TtsSynthesizer} backed by Groq's Orpheus English model. Reuses
 * {@link resolveTtsOptions} from the browser TTS path so profile rate/voice prefs map
 * consistently. Server-only: never import from client code or feature modules.
 */
export class GroqTtsSynthesizer implements TtsSynthesizer {
  constructor(private readonly config: TtsConfig) {}

  async synthesize(text: string, options: TtsSynthesizeOptions = {}): Promise<TtsSynthesizeResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error("TTS input text is empty");
    }

    const { rate, voice } = resolveTtsOptions(
      { rate: options.rate, voiceUri: options.voiceUri },
      GROQ_ORPHEUS_VOICES,
    );
    const voiceId = voice?.voiceURI ?? this.config.defaultVoice;
    const input = trimmed.slice(0, TTS_MAX_SPOKEN_TEXT_CHARS);

    const url = `${this.config.baseURL}/audio/speech`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        Accept: "audio/wav",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        input,
        voice: voiceId,
        response_format: "wav",
        speed: rate,
      }),
    });

    if (!response.ok) {
      let detail = `status ${response.status}`;
      try {
        const parsed = GroqSpeechError.safeParse(await response.json());
        if (parsed.success && parsed.data.error?.message) {
          detail = parsed.data.error.message;
        }
      } catch {
        // Non-JSON error body — keep status-only detail.
      }
      throw new Error(`Groq TTS request failed (${detail})`);
    }

    const data = new Uint8Array(await response.arrayBuffer());
    return { data, mimeType: "audio/wav" };
  }
}
