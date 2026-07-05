import { z } from "zod";

import { CHAT_PROVIDER_VALUES, EMBEDDINGS_PROVIDER_VALUES } from "@/lib/db/drizzle/schema.shared";
import type { ProfileSettings } from "../db";

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
