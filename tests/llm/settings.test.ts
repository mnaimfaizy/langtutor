import { describe, expect, it } from "vitest";

import type { LLMConfig } from "@/lib/llm/config";
import { resolveLLMConfig, settingsToOverrides } from "@/lib/llm/settings";

const base: LLMConfig = {
  baseURL: "http://env:11434/v1",
  apiKey: "ollama",
  chatModel: "env-chat",
  utilityModel: "env-utility",
  embedModel: "env-embed",
};

describe("resolveLLMConfig", () => {
  it("returns the base config when there are no overrides", () => {
    expect(resolveLLMConfig(base)).toEqual(base);
  });

  it("overlays provided overrides and keeps base for the rest", () => {
    const resolved = resolveLLMConfig(base, { baseURL: "http://mac:11434/v1", chatModel: "qwen" });
    expect(resolved.baseURL).toBe("http://mac:11434/v1");
    expect(resolved.chatModel).toBe("qwen");
    expect(resolved.utilityModel).toBe("env-utility"); // untouched
    expect(resolved.embedModel).toBe("env-embed"); // untouched
    expect(resolved.apiKey).toBe("ollama"); // never overridable from the client
  });

  it("overrides utility model when provided", () => {
    const resolved = resolveLLMConfig(base, { utilityModel: "qwen2.5:3b-instruct" });
    expect(resolved.utilityModel).toBe("qwen2.5:3b-instruct");
    expect(resolved.chatModel).toBe("env-chat"); // untouched
  });

  it("ignores blank / whitespace-only overrides", () => {
    const resolved = resolveLLMConfig(base, { baseURL: "   ", chatModel: "", utilityModel: "  " });
    expect(resolved.baseURL).toBe("http://env:11434/v1");
    expect(resolved.chatModel).toBe("env-chat");
    expect(resolved.utilityModel).toBe("env-utility");
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
      baseURL: "http://mac/v1",
      chatModel: "qwen",
      utilityModel: "qwen-small",
      embedModel: undefined,
    });
  });

  it("handles undefined settings", () => {
    expect(settingsToOverrides(undefined)).toEqual({
      baseURL: undefined,
      chatModel: undefined,
      utilityModel: undefined,
      embedModel: undefined,
    });
  });

  it("drops blank utility model", () => {
    expect(settingsToOverrides({ macUtilityModel: "  " })).toMatchObject({
      utilityModel: undefined,
    });
  });
});
