/**
 * Mac/LLM configuration, read from server-only env (PLAN §3.2). Used solely on the
 * server (constructed in `lib/registry.ts` → `OllamaLLMClient`). A Settings UI can
 * later override these at runtime via `profile.settings` (Phase 0.6).
 */
export interface LLMConfig {
  baseURL: string;
  apiKey: string;
  chatModel: string;
  utilityModel: string;
  embedModel: string;
}

/** Default to a local Ollama OpenAI-compatible endpoint. */
const DEFAULT_BASE_URL = "http://localhost:11434/v1";

export function loadLLMConfig(): LLMConfig {
  return {
    baseURL: process.env.MAC_LLM_BASE_URL ?? DEFAULT_BASE_URL,
    apiKey: process.env.MAC_LLM_API_KEY ?? "ollama",
    chatModel: process.env.MAC_LLM_MODEL ?? "qwen2.5:14b-instruct",
    utilityModel: process.env.MAC_UTILITY_MODEL ?? "qwen2.5:7b-instruct",
    embedModel: process.env.MAC_EMBED_MODEL ?? "nomic-embed-text",
  };
}
