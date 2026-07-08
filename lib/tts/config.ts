import "server-only";

import {
  DEFAULT_GROQ_TTS_MODEL,
  DEFAULT_GROQ_TTS_VOICE,
  getGroqApiKey,
  GROQ_OPENAI_BASE_URL,
} from "@/lib/ai/groq";

/** Server-only TTS configuration (ADR 0016). */
export interface TtsConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  defaultVoice: string;
}

export function loadTtsConfig(): TtsConfig {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set — provision a key at console.groq.com and add it to .env.local",
    );
  }

  return {
    apiKey,
    baseURL: GROQ_OPENAI_BASE_URL,
    model: DEFAULT_GROQ_TTS_MODEL,
    defaultVoice: DEFAULT_GROQ_TTS_VOICE,
  };
}
