import { describe, expect, it } from "vitest";

import {
  composeSpokenText,
  normalizeDirection,
  parseSpokenText,
  resolveSpokenText,
  TTS_MAX_SPOKEN_TEXT_CHARS,
} from "@/lib/tts/prompts";

describe("normalizeDirection", () => {
  it("strips wrapping brackets and collapses whitespace", () => {
    expect(normalizeDirection("  cheerful  ")).toBe("cheerful");
    expect(normalizeDirection("[cheerful]")).toBe("cheerful");
    expect(normalizeDirection("[slow carefully]")).toBe("slow carefully");
    expect(normalizeDirection("")).toBe("");
    expect(normalizeDirection(null)).toBe("");
  });
});

describe("composeSpokenText", () => {
  it("returns the say text alone when direction is empty", () => {
    expect(composeSpokenText("Apple")).toBe("Apple");
    expect(composeSpokenText("  cat ", "   ")).toBe("cat");
  });

  it("prepends a bracketed Orpheus direction that is not spoken as prose", () => {
    expect(composeSpokenText("apple", "cheerful")).toBe("[cheerful] apple");
    expect(composeSpokenText("apple", "[whisper]")).toBe("[whisper] apple");
  });

  it("caps length to the Groq speech input limit", () => {
    const longSay = "a".repeat(TTS_MAX_SPOKEN_TEXT_CHARS);
    expect(composeSpokenText(longSay, "cheerful")).toHaveLength(TTS_MAX_SPOKEN_TEXT_CHARS);
  });
});

describe("parseSpokenText", () => {
  it("defaults to the fallback word with no direction", () => {
    expect(parseSpokenText(null, "Apple")).toEqual({ say: "apple", direction: "" });
    expect(parseSpokenText("   ", "Cat")).toEqual({ say: "cat", direction: "" });
  });

  it("splits a leading Orpheus direction from the say text", () => {
    expect(parseSpokenText("[cheerful] apple", "apple")).toEqual({
      say: "apple",
      direction: "cheerful",
    });
    expect(parseSpokenText("[slow carefully] xylophone", "x")).toEqual({
      say: "xylophone",
      direction: "slow carefully",
    });
  });

  it("treats plain stored text as say-only", () => {
    expect(parseSpokenText("apple", "apple")).toEqual({ say: "apple", direction: "" });
  });
});

describe("resolveSpokenText", () => {
  it("defaults to the normalized word when no override is stored", () => {
    expect(resolveSpokenText("Apple")).toBe("apple");
    expect(resolveSpokenText("  Cat ", null)).toBe("cat");
    expect(resolveSpokenText("dog", "   ")).toBe("dog");
  });

  it("uses a non-empty override so vocal directions can steer Orpheus", () => {
    expect(resolveSpokenText("apple", "[cheerful] apple")).toBe("[cheerful] apple");
  });

  it("caps length to the Groq speech input limit", () => {
    const long = "a".repeat(TTS_MAX_SPOKEN_TEXT_CHARS + 50);
    expect(resolveSpokenText("x", long)).toHaveLength(TTS_MAX_SPOKEN_TEXT_CHARS);
  });
});
