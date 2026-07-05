import "server-only";

import { DEFAULT_GROQ_CHAT_MODEL, GROQ_OPENAI_BASE_URL, getGroqApiKey } from "@/lib/ai/groq";
import { DEFAULT_MISTRAL_EMBED_MODEL, getMistralApiKey } from "@/lib/ai/mistral";
import { env } from "@/lib/config/env";

import type { LLMConfig } from "./config";
import type { LLMOverrides } from "./settings";

/** Trim and drop empty/whitespace strings to `undefined`. */
function clean(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

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
    return (
      clean(env.MISTRAL_EMBED_MODEL) ??
      clean(overrides?.embeddingsModel) ??
      DEFAULT_MISTRAL_EMBED_MODEL
    );
  }
  return clean(overrides?.embedModel) ?? base.embedModel;
}

/** Overlay runtime overrides onto the env-derived base config (empty values ignored). */
export function resolveLLMConfig(base: LLMConfig, overrides?: LLMOverrides): LLMConfig {
  const cloudMode = env.LANGTUTOR_MODE === "cloud";
  const chatProvider = cloudMode ? "groq" : (overrides?.chatProvider ?? base.chatProvider);
  const embeddingsProvider = cloudMode
    ? "mistral"
    : (overrides?.embeddingsProvider ?? base.embeddingsProvider);
  const embedModel = resolveEmbedModel(embeddingsProvider, base, overrides);

  if (embeddingsProvider === "mistral") {
    requireMistralApiKey();
  }

  if (chatProvider === "groq") {
    return {
      chatProvider: "groq",
      baseURL: GROQ_OPENAI_BASE_URL,
      apiKey: requireGroqApiKey(),
      chatModel:
        clean(env.GROQ_CHAT_MODEL) ?? clean(overrides?.chatModel) ?? DEFAULT_GROQ_CHAT_MODEL,
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
