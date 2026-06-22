import { z } from "zod";

import type { ProfileSettings } from "../db";
import type { LLMConfig } from "./config";

/** Trim and drop empty/whitespace strings to `undefined`. */
function clean(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The user-overridable subset of {@link LLMConfig} (PLAN §3.2). Persisted in
 * `profile.settings` (IndexedDB) and pushed to the server via `POST /api/llm/config`.
 * No API key — secrets stay server-side (hard rule #8).
 */
export const LLMOverridesSchema = z.object({
  baseURL: z.url().optional(),
  chatModel: z.string().optional(),
  embedModel: z.string().optional(),
});
export type LLMOverrides = z.infer<typeof LLMOverridesSchema>;

/** Overlay runtime overrides onto the env-derived base config (empty values ignored). */
export function resolveLLMConfig(base: LLMConfig, overrides?: LLMOverrides): LLMConfig {
  return {
    baseURL: clean(overrides?.baseURL) ?? base.baseURL,
    apiKey: base.apiKey,
    chatModel: clean(overrides?.chatModel) ?? base.chatModel,
    utilityModel: base.utilityModel,
    embedModel: clean(overrides?.embedModel) ?? base.embedModel,
  };
}

/** Map persisted profile settings to the override shape sent to the proxy (empties omitted). */
export function settingsToOverrides(settings: ProfileSettings | undefined): LLMOverrides {
  return {
    baseURL: clean(settings?.macLlmBaseUrl),
    chatModel: clean(settings?.macLlmModel),
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
