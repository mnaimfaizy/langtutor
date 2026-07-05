import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DEFAULT_GROQ_CHAT_MODEL, GROQ_OPENAI_BASE_URL } from "@/lib/ai/groq";
import type { LLMConfig } from "@/lib/llm/config";
import { settingsToOverrides } from "@/lib/llm/settings";

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

async function importSettingsServer() {
  vi.resetModules();
  return import("@/lib/llm/settings.server");
}

describe("resolveLLMConfig", () => {
  it("returns the base config when there are no overrides", () => {
    return importSettingsServer().then(({ resolveLLMConfig }) => {
      expect(resolveLLMConfig(base)).toEqual(base);
    });
  });

  it("overlays provided overrides and keeps base for the rest", () => {
    return importSettingsServer().then(({ resolveLLMConfig }) => {
      const resolved = resolveLLMConfig(base, {
        baseURL: "http://mac:11434/v1",
        chatModel: "qwen",
      });
      expect(resolved.chatProvider).toBe("mac");
      expect(resolved.baseURL).toBe("http://mac:11434/v1");
      expect(resolved.chatModel).toBe("qwen");
      expect(resolved.utilityModel).toBe("env-utility");
      expect(resolved.embedModel).toBe("env-embed");
      expect(resolved.apiKey).toBe("ollama");
    });
  });

  it("overrides utility model when provided", () => {
    return importSettingsServer().then(({ resolveLLMConfig }) => {
      const resolved = resolveLLMConfig(base, { utilityModel: "qwen2.5:3b-instruct" });
      expect(resolved.utilityModel).toBe("qwen2.5:3b-instruct");
      expect(resolved.chatModel).toBe("env-chat");
    });
  });

  it("ignores blank / whitespace-only overrides", () => {
    return importSettingsServer().then(({ resolveLLMConfig }) => {
      const resolved = resolveLLMConfig(base, {
        baseURL: "   ",
        chatModel: "",
        utilityModel: "  ",
      });
      expect(resolved.baseURL).toBe("http://env:11434/v1");
      expect(resolved.chatModel).toBe("env-chat");
      expect(resolved.utilityModel).toBe("env-utility");
    });
  });

  it("routes to Groq when chatProvider is groq", () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test_key");
    return importSettingsServer().then(({ resolveLLMConfig }) => {
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
    });
  });

  it("uses default Groq chat model when none is provided", () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test_key");
    return importSettingsServer().then(({ resolveLLMConfig }) => {
      const resolved = resolveLLMConfig(base, { chatProvider: "groq" });
      expect(resolved.chatModel).toBe(DEFAULT_GROQ_CHAT_MODEL);
    });
  });

  it("throws when Groq is selected without GROQ_API_KEY", () => {
    delete process.env.GROQ_API_KEY;
    return importSettingsServer().then(({ resolveLLMConfig }) => {
      expect(() => resolveLLMConfig(base, { chatProvider: "groq" })).toThrow(
        "GROQ_API_KEY is required when chatProvider is groq",
      );
    });
  });

  it("routes embeddings to Mistral when embeddingsProvider is mistral", () => {
    vi.stubEnv("MISTRAL_API_KEY", "mistral_test_key");
    return importSettingsServer().then(({ resolveLLMConfig }) => {
      const resolved = resolveLLMConfig(base, {
        embeddingsProvider: "mistral",
        embeddingsModel: "mistral-embed",
      });
      expect(resolved.embeddingsProvider).toBe("mistral");
      expect(resolved.embedModel).toBe("mistral-embed");
      expect(resolved.macBaseURL).toBe("http://env:11434/v1");
    });
  });

  it("uses default Mistral embed model when none is provided", () => {
    vi.stubEnv("MISTRAL_API_KEY", "mistral_test_key");
    return importSettingsServer().then(({ resolveLLMConfig }) => {
      const resolved = resolveLLMConfig(base, { embeddingsProvider: "mistral" });
      expect(resolved.embedModel).toBe("mistral-embed");
    });
  });

  it("throws when Mistral is selected without MISTRAL_API_KEY", () => {
    delete process.env.MISTRAL_API_KEY;
    return importSettingsServer().then(({ resolveLLMConfig }) => {
      expect(() => resolveLLMConfig(base, { embeddingsProvider: "mistral" })).toThrow(
        "MISTRAL_API_KEY is required when embeddingsProvider is mistral",
      );
    });
  });

  it("forces cloud providers when LANGTUTOR_MODE is cloud", () => {
    vi.stubEnv("LANGTUTOR_MODE", "cloud");
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    vi.stubEnv("LANGTUTOR_ADMIN_EMAIL", "admin@example.com");
    vi.stubEnv("LANGTUTOR_ADMIN_PASSWORD", "adminPass99");
    vi.stubEnv("LANGTUTOR_SESSION_SECRET", "super-secret-value");
    vi.stubEnv("MAC_LLM_BASE_URL", "http://env:11434/v1");
    vi.stubEnv("MAC_LLM_API_KEY", "ollama");
    vi.stubEnv("MAC_LLM_MODEL", "env-chat");
    vi.stubEnv("MAC_UTILITY_MODEL", "env-utility");
    vi.stubEnv("MAC_EMBED_MODEL", "env-embed");
    vi.stubEnv("MAC_STT_URL", "http://env:8080");
    vi.stubEnv("GROQ_API_KEY", "gsk_test_key");
    vi.stubEnv("MISTRAL_API_KEY", "mistral_test_key");
    return importSettingsServer().then(({ resolveLLMConfig }) => {
      const resolved = resolveLLMConfig(base, {
        chatProvider: "mac",
        embeddingsProvider: "mac",
      });
      expect(resolved.chatProvider).toBe("groq");
      expect(resolved.embeddingsProvider).toBe("mistral");
    });
  });

  it("prefers env cloud model vars over persisted overrides", () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test_key");
    vi.stubEnv("MISTRAL_API_KEY", "mistral_test_key");
    vi.stubEnv("GROQ_CHAT_MODEL", "llama-3.1-8b-instant");
    vi.stubEnv("MISTRAL_EMBED_MODEL", "mistral-embed-latest");
    return importSettingsServer().then(({ resolveLLMConfig }) => {
      const resolved = resolveLLMConfig(base, {
        chatProvider: "groq",
        chatModel: "persisted-chat-model",
        embeddingsProvider: "mistral",
        embeddingsModel: "persisted-embed-model",
      });
      expect(resolved.chatModel).toBe("llama-3.1-8b-instant");
      expect(resolved.embedModel).toBe("mistral-embed-latest");
    });
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
