import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DEFAULT_GROQ_CHAT_MODEL, GROQ_OPENAI_BASE_URL } from "@/lib/ai/groq";
import type { LLMConfig } from "@/lib/llm/config";
import { resolveLLMConfig, settingsToOverrides } from "@/lib/llm/settings";

const base: LLMConfig = {
  chatProvider: "mac",
  baseURL: "http://env:11434/v1",
  apiKey: "ollama",
  chatModel: "env-chat",
  utilityModel: "env-utility",
  embeddingsProvider: "mac",
  embedModel: "env-embed",
  macBaseURL: "http://env:11434/v1",
  macApiKey: "ollama",
};

describe("resolveLLMConfig", () => {
  it("returns the base config when there are no overrides", () => {
    expect(resolveLLMConfig(base)).toEqual(base);
  });

  it("overlays provided overrides and keeps base for the rest", () => {
    const resolved = resolveLLMConfig(base, { baseURL: "http://mac:11434/v1", chatModel: "qwen" });
    expect(resolved.chatProvider).toBe("mac");
    expect(resolved.baseURL).toBe("http://mac:11434/v1");
    expect(resolved.chatModel).toBe("qwen");
    expect(resolved.utilityModel).toBe("env-utility");
    expect(resolved.embedModel).toBe("env-embed");
    expect(resolved.apiKey).toBe("ollama");
  });

  it("overrides utility model when provided", () => {
    const resolved = resolveLLMConfig(base, { utilityModel: "qwen2.5:3b-instruct" });
    expect(resolved.utilityModel).toBe("qwen2.5:3b-instruct");
    expect(resolved.chatModel).toBe("env-chat");
  });

  it("ignores blank / whitespace-only overrides", () => {
    const resolved = resolveLLMConfig(base, { baseURL: "   ", chatModel: "", utilityModel: "  " });
    expect(resolved.baseURL).toBe("http://env:11434/v1");
    expect(resolved.chatModel).toBe("env-chat");
    expect(resolved.utilityModel).toBe("env-utility");
  });

  it("routes to Groq when chatProvider is groq", () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test_key");
    const resolved = resolveLLMConfig(base, {
      chatProvider: "groq",
      chatModel: "llama-3.1-8b-instant",
    });
    expect(resolved).toEqual({
      chatProvider: "groq",
      baseURL: GROQ_OPENAI_BASE_URL,
      apiKey: "gsk_test_key",
      chatModel: "llama-3.1-8b-instant",
      utilityModel: "env-utility",
      embeddingsProvider: "mac",
      embedModel: "env-embed",
      macBaseURL: "http://env:11434/v1",
      macApiKey: "ollama",
    });
    vi.unstubAllEnvs();
  });

  it("uses default Groq chat model when none is provided", () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test_key");
    const resolved = resolveLLMConfig(base, { chatProvider: "groq" });
    expect(resolved.chatModel).toBe(DEFAULT_GROQ_CHAT_MODEL);
    vi.unstubAllEnvs();
  });

  it("throws when Groq is selected without GROQ_API_KEY", () => {
    vi.stubEnv("GROQ_API_KEY", "");
    expect(() => resolveLLMConfig(base, { chatProvider: "groq" })).toThrow(
      "GROQ_API_KEY is required when chatProvider is groq",
    );
    vi.unstubAllEnvs();
  });

  it("routes embeddings to Mistral when embeddingsProvider is mistral", () => {
    vi.stubEnv("MISTRAL_API_KEY", "mistral_test_key");
    const resolved = resolveLLMConfig(base, {
      embeddingsProvider: "mistral",
      embeddingsModel: "mistral-embed",
    });
    expect(resolved.embeddingsProvider).toBe("mistral");
    expect(resolved.embedModel).toBe("mistral-embed");
    expect(resolved.macBaseURL).toBe("http://env:11434/v1");
    vi.unstubAllEnvs();
  });

  it("uses default Mistral embed model when none is provided", () => {
    vi.stubEnv("MISTRAL_API_KEY", "mistral_test_key");
    const resolved = resolveLLMConfig(base, { embeddingsProvider: "mistral" });
    expect(resolved.embedModel).toBe("mistral-embed");
    vi.unstubAllEnvs();
  });

  it("throws when Mistral is selected without MISTRAL_API_KEY", () => {
    vi.stubEnv("MISTRAL_API_KEY", "");
    expect(() => resolveLLMConfig(base, { embeddingsProvider: "mistral" })).toThrow(
      "MISTRAL_API_KEY is required when embeddingsProvider is mistral",
    );
    vi.unstubAllEnvs();
  });
});

describe("settingsToOverrides", () => {
  it("maps mac* profile settings and drops empties", () => {
    expect(
      settingsToOverrides({
        macLlmBaseUrl: "http://mac/v1",
        macLlmModel: "qwen",
        macUtilityModel: "qwen-small",
        macEmbedModel: "  ",
      }),
    ).toEqual({
      chatProvider: undefined,
      embeddingsProvider: undefined,
      baseURL: "http://mac/v1",
      chatModel: "qwen",
      utilityModel: "qwen-small",
      embedModel: undefined,
      embeddingsModel: undefined,
    });
  });

  it("maps groq provider settings without mac base URL", () => {
    expect(
      settingsToOverrides({
        chatProvider: "groq",
        chatModel: "llama-3.3-70b-versatile",
      }),
    ).toEqual({
      chatProvider: "groq",
      embeddingsProvider: undefined,
      baseURL: undefined,
      chatModel: "llama-3.3-70b-versatile",
      utilityModel: undefined,
      embedModel: undefined,
      embeddingsModel: undefined,
    });
  });

  it("maps mistral embeddings provider settings without mac embed model", () => {
    expect(
      settingsToOverrides({
        embeddingsProvider: "mistral",
        embeddingsModel: "mistral-embed",
      }),
    ).toEqual({
      chatProvider: undefined,
      embeddingsProvider: "mistral",
      baseURL: undefined,
      chatModel: undefined,
      utilityModel: undefined,
      embedModel: undefined,
      embeddingsModel: "mistral-embed",
    });
  });

  it("handles undefined settings", () => {
    expect(settingsToOverrides(undefined)).toEqual({
      chatProvider: undefined,
      embeddingsProvider: undefined,
      baseURL: undefined,
      chatModel: undefined,
      utilityModel: undefined,
      embedModel: undefined,
      embeddingsModel: undefined,
    });
  });

  it("drops blank utility model", () => {
    expect(settingsToOverrides({ macUtilityModel: "  " })).toMatchObject({
      utilityModel: undefined,
    });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
