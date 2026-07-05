import "server-only";

import { DEFAULT_MISTRAL_EMBED_MODEL, MISTRAL_EMBEDDINGS_BASE_URL } from "@/lib/content/embeddings";

/** Mistral OpenAI-compatible API base URL (embeddings). */
export const MISTRAL_API_BASE_URL = MISTRAL_EMBEDDINGS_BASE_URL;

export { DEFAULT_MISTRAL_EMBED_MODEL };

/** Read the Mistral API key from server env (never persisted in the database). */
export function getMistralApiKey(): string | undefined {
  const key = process.env.MISTRAL_API_KEY?.trim();
  return key ? key : undefined;
}
