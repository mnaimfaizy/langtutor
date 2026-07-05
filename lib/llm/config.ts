import "server-only";

import { DEFAULT_GROQ_CHAT_MODEL } from "@/lib/ai/groq";
import { DEFAULT_MISTRAL_EMBED_MODEL } from "@/lib/ai/mistral";
import { env } from "@/lib/config/env";

import type { ChatProvider, EmbeddingsProvider } from "../db/drizzle/schema.shared";

/**
 * Mac/LLM configuration, read from server-only env (PLAN §3.2). Used solely on the
 * server (constructed in `lib/llm/server.ts` → `OllamaLLMClient`). A Settings UI can
 * later override these at runtime via `profile.settings` (Phase 0.6).
 */
export interface LLMConfig {
  chatProvider: ChatProvider;
  baseURL: string;
  apiKey: string;
  chatModel: string;
  utilityModel: string;
  embeddingsProvider: EmbeddingsProvider;
  embedModel: string;
  /** Mac Ollama endpoint — used for embeddings when embeddingsProvider is mac. */
  macBaseURL: string;
  macApiKey: string;
}

/** Default to a local Ollama OpenAI-compatible endpoint. */
const DEFAULT_BASE_URL = "http://localhost:11434/v1";

function clean(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function loadLLMConfig(): LLMConfig {
  const macBaseURL = env.MAC_LLM_BASE_URL ?? DEFAULT_BASE_URL;
  const macApiKey = env.MAC_LLM_API_KEY ?? "ollama";
  const cloudMode = env.LANGTUTOR_MODE === "cloud";
  return {
    chatProvider: cloudMode ? "groq" : "mac",
    baseURL: macBaseURL,
    apiKey: macApiKey,
    chatModel: cloudMode
      ? (clean(env.GROQ_CHAT_MODEL) ?? DEFAULT_GROQ_CHAT_MODEL)
      : env.MAC_LLM_MODEL,
    utilityModel: env.MAC_UTILITY_MODEL,
    embeddingsProvider: cloudMode ? "mistral" : "mac",
    embedModel: cloudMode
      ? (clean(env.MISTRAL_EMBED_MODEL) ?? DEFAULT_MISTRAL_EMBED_MODEL)
      : env.MAC_EMBED_MODEL,
    macBaseURL,
    macApiKey,
  };
}
