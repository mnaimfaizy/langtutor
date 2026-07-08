import "server-only";

/** Groq OpenAI-compatible API base URL (chat + STT). */
export const GROQ_OPENAI_BASE_URL = "https://api.groq.com/openai/v1";

/** Default Groq chat model when none is configured in appConfig. */
export const DEFAULT_GROQ_CHAT_MODEL = "llama-3.3-70b-versatile";

/** Groq Whisper model for speech-to-text. */
export const GROQ_WHISPER_MODEL = "whisper-large-v3";

/** Groq Orpheus English model for text-to-speech (ADR 0016). */
export const DEFAULT_GROQ_TTS_MODEL = "canopylabs/orpheus-v1-english";

/** Default kid-friendly Orpheus voice when profile voiceUri does not map. */
export const DEFAULT_GROQ_TTS_VOICE = "hannah";

/** Read the Groq API key from server env (never persisted in the database). */
export function getGroqApiKey(): string | undefined {
  const key = process.env.GROQ_API_KEY?.trim();
  return key ? key : undefined;
}
