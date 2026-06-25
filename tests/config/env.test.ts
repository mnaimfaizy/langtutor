import { describe, expect, it } from "vitest";

import { parseEnv } from "@/lib/config/env";

const VALID_LOCAL: Record<string, string> = {
  LANGTUTOR_MODE: "local",
  LANGTUTOR_DB_PATH: "./test.db",
  LANGTUTOR_SESSION_SECRET: "super-secret-value",
  MAC_LLM_BASE_URL: "http://192.168.1.10:11434/v1",
  MAC_LLM_API_KEY: "ollama",
  MAC_LLM_MODEL: "qwen2.5:14b-instruct",
  MAC_UTILITY_MODEL: "qwen2.5:7b-instruct",
  MAC_EMBED_MODEL: "nomic-embed-text",
  MAC_STT_URL: "http://192.168.1.10:8080",
};

describe("parseEnv — local mode", () => {
  it("accepts a fully valid local config", () => {
    const cfg = parseEnv(VALID_LOCAL);
    expect(cfg.LANGTUTOR_MODE).toBe("local");
    expect(cfg.LANGTUTOR_DB_PATH).toBe("./test.db");
    expect(cfg.MAC_LLM_MODEL).toBe("qwen2.5:14b-instruct");
  });

  it("defaults LANGTUTOR_MODE to 'local' when absent", () => {
    const { LANGTUTOR_MODE: _, ...withoutMode } = VALID_LOCAL;
    const cfg = parseEnv(withoutMode);
    expect(cfg.LANGTUTOR_MODE).toBe("local");
  });

  it("applies default DB path when LANGTUTOR_DB_PATH is absent", () => {
    const { LANGTUTOR_DB_PATH: _, ...withoutPath } = VALID_LOCAL;
    const cfg = parseEnv(withoutPath);
    expect(cfg.LANGTUTOR_DB_PATH).toBe("./langtutor.db");
  });

  it("applies default MAC values when absent", () => {
    const cfg = parseEnv({});
    expect(cfg.MAC_LLM_BASE_URL).toBe("http://localhost:11434/v1");
    expect(cfg.MAC_LLM_MODEL).toBe("qwen2.5:14b-instruct");
    expect(cfg.MAC_UTILITY_MODEL).toBe("qwen2.5:7b-instruct");
    expect(cfg.MAC_EMBED_MODEL).toBe("nomic-embed-text");
    expect(cfg.MAC_STT_URL).toBe("http://localhost:8080");
  });

  it("applies default session secret when absent", () => {
    const cfg = parseEnv({});
    expect(cfg.LANGTUTOR_SESSION_SECRET).toBe("change-me-in-production");
  });
});

describe("parseEnv — invalid configs", () => {
  it("throws with a clear message when MAC_LLM_BASE_URL is not a valid URL", () => {
    expect(() => parseEnv({ ...VALID_LOCAL, MAC_LLM_BASE_URL: "not-a-url" })).toThrowError(
      "[LangTutor] Invalid environment configuration:",
    );
  });

  it("throws with a clear message when MAC_STT_URL is not a valid URL", () => {
    expect(() => parseEnv({ ...VALID_LOCAL, MAC_STT_URL: "totally-invalid" })).toThrowError(
      "[LangTutor] Invalid environment configuration:",
    );
  });

  it("error message includes the offending field path", () => {
    try {
      parseEnv({ ...VALID_LOCAL, MAC_LLM_BASE_URL: "bad" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(String(err)).toContain("MAC_LLM_BASE_URL");
    }
  });

  it("throws when LANGTUTOR_MODE is an unsupported value", () => {
    expect(() => parseEnv({ LANGTUTOR_MODE: "cloud" })).toThrowError(
      "[LangTutor] Invalid environment configuration:",
    );
  });
});
