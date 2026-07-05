import { z } from "zod";

import { DEFAULT_GROQ_CHAT_MODEL, GROQ_OPENAI_BASE_URL, getGroqApiKey } from "@/lib/ai/groq";
import { DEFAULT_MISTRAL_EMBED_MODEL, getMistralApiKey } from "@/lib/ai/mistral";
import { CHAT_PROVIDER_VALUES, EMBEDDINGS_PROVIDER_VALUES } from "@/lib/db/drizzle/schema.shared";
import type { ProfileSettings } from "../db";
import type { LLMConfig } from "./config";

/** Trim and drop empty/whitespace strings to `undefined`. */
function clean(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The user-overridable subset of {@link LLMConfig} (PLAN §3.2). Persisted in
 * `profile.settings` and pushed to the server via `POST /api/llm/config`.
 * No API key — secrets stay server-side (hard rule #8).
 */
export const LLMOverridesSchema = z.object({
  chatProvider: z.enum(CHAT_PROVIDER_VALUES).optional(),
  embeddingsProvider: z.enum(EMBEDDINGS_PROVIDER_VALUES).optional(),
  baseURL: z.url().max(2048).optional(),
  chatModel: z.string().optional(),
  utilityModel: z.string().optional(),
  embedModel: z.string().optional(),
  embeddingsModel: z.string().optional(),
});
export type LLMOverrides = z.infer<typeof LLMOverridesSchema>;

function requireGroqApiKey(): string {
  const key = getGroqApiKey();
  if (!key) {
    throw new Error("GROQ_API_KEY is required when chatProvider is groq");
  }
  return key;
}

function requireMistralApiKey(): string {
  const key = getMistralApiKey();
  if (!key) {
    throw new Error("MISTRAL_API_KEY is required when embeddingsProvider is mistral");
  }
  return key;
}

function resolveEmbedModel(
  embeddingsProvider: LLMConfig["embeddingsProvider"],
  base: LLMConfig,
  overrides?: LLMOverrides,
): string {
  if (embeddingsProvider === "mistral") {
    return clean(overrides?.embeddingsModel) ?? DEFAULT_MISTRAL_EMBED_MODEL;
  }
  return clean(overrides?.embedModel) ?? base.embedModel;
}

/** Overlay runtime overrides onto the env-derived base config (empty values ignored). */
export function resolveLLMConfig(base: LLMConfig, overrides?: LLMOverrides): LLMConfig {
  const chatProvider = overrides?.chatProvider ?? base.chatProvider;
  const embeddingsProvider = overrides?.embeddingsProvider ?? base.embeddingsProvider;
  const embedModel = resolveEmbedModel(embeddingsProvider, base, overrides);

  if (embeddingsProvider === "mistral") {
    requireMistralApiKey();
  }

  if (chatProvider === "groq") {
    return {
      chatProvider: "groq",
      baseURL: GROQ_OPENAI_BASE_URL,
      apiKey: requireGroqApiKey(),
      chatModel: clean(overrides?.chatModel) ?? DEFAULT_GROQ_CHAT_MODEL,
      utilityModel: clean(overrides?.utilityModel) ?? base.utilityModel,
      embeddingsProvider,
      embedModel,
      macBaseURL: base.macBaseURL,
      macApiKey: base.macApiKey,
    };
  }

  return {
    chatProvider: "mac",
    baseURL: clean(overrides?.baseURL) ?? base.baseURL,
    apiKey: base.apiKey,
    chatModel: clean(overrides?.chatModel) ?? base.chatModel,
    utilityModel: clean(overrides?.utilityModel) ?? base.utilityModel,
    embeddingsProvider,
    embedModel,
    macBaseURL: clean(overrides?.baseURL) ?? base.macBaseURL,
    macApiKey: base.macApiKey,
  };
}

/** Map persisted profile settings to the override shape sent to the proxy (empties omitted). */
export function settingsToOverrides(settings: ProfileSettings | undefined): LLMOverrides {
  const chatProvider = settings?.chatProvider ?? "mac";
  const embeddingsProvider = settings?.embeddingsProvider ?? "mac";
  const chatModel =
    chatProvider === "groq" ? clean(settings?.chatModel) : clean(settings?.macLlmModel);

  return {
    chatProvider: settings?.chatProvider,
    embeddingsProvider: settings?.embeddingsProvider,
    baseURL: chatProvider === "mac" ? clean(settings?.macLlmBaseUrl) : undefined,
    chatModel,
    utilityModel: clean(settings?.macUtilityModel),
    embedModel: embeddingsProvider === "mac" ? clean(settings?.macEmbedModel) : undefined,
    embeddingsModel:
      embeddingsProvider === "mistral" ? clean(settings?.embeddingsModel) : undefined,
  };
}

/** Shape of the `/api/llm/health` response (validated client-side per hard rule #3). */
export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  models: z.array(z.string()).optional(),
  error: z.string().optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
