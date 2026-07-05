import { z } from "zod";

import { DEFAULT_GROQ_CHAT_MODEL, GROQ_OPENAI_BASE_URL, getGroqApiKey } from "@/lib/ai/groq";
import { CHAT_PROVIDER_VALUES } from "@/lib/db/drizzle/schema.shared";
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
  baseURL: z.url().max(2048).optional(),
  chatModel: z.string().optional(),
  utilityModel: z.string().optional(),
  embedModel: z.string().optional(),
});
export type LLMOverrides = z.infer<typeof LLMOverridesSchema>;

function requireGroqApiKey(): string {
  const key = getGroqApiKey();
  if (!key) {
    throw new Error("GROQ_API_KEY is required when chatProvider is groq");
  }
  return key;
}

/** Overlay runtime overrides onto the env-derived base config (empty values ignored). */
export function resolveLLMConfig(base: LLMConfig, overrides?: LLMOverrides): LLMConfig {
  const chatProvider = overrides?.chatProvider ?? base.chatProvider;

  if (chatProvider === "groq") {
    return {
      chatProvider: "groq",
      baseURL: GROQ_OPENAI_BASE_URL,
      apiKey: requireGroqApiKey(),
      chatModel: clean(overrides?.chatModel) ?? DEFAULT_GROQ_CHAT_MODEL,
      utilityModel: clean(overrides?.utilityModel) ?? base.utilityModel,
      embedModel: clean(overrides?.embedModel) ?? base.embedModel,
    };
  }

  return {
    chatProvider: "mac",
    baseURL: clean(overrides?.baseURL) ?? base.baseURL,
    apiKey: base.apiKey,
    chatModel: clean(overrides?.chatModel) ?? base.chatModel,
    utilityModel: clean(overrides?.utilityModel) ?? base.utilityModel,
    embedModel: clean(overrides?.embedModel) ?? base.embedModel,
  };
}

/** Map persisted profile settings to the override shape sent to the proxy (empties omitted). */
export function settingsToOverrides(settings: ProfileSettings | undefined): LLMOverrides {
  const chatProvider = settings?.chatProvider ?? "mac";
  const chatModel =
    chatProvider === "groq" ? clean(settings?.chatModel) : clean(settings?.macLlmModel);

  return {
    chatProvider: settings?.chatProvider,
    baseURL: chatProvider === "mac" ? clean(settings?.macLlmBaseUrl) : undefined,
    chatModel,
    utilityModel: clean(settings?.macUtilityModel),
    embedModel: clean(settings?.macEmbedModel),
  };
}

/** Shape of the `/api/llm/health` response (validated client-side per hard rule #3). */
export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  models: z.array(z.string()).optional(),
  error: z.string().optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
