import { describe, expect, it } from "vitest";

import { resolveTtsOptions } from "@/lib/tts/speech-synthesis";

const VOICES = [
  { voiceURI: "Google UK English Female" },
  { voiceURI: "Microsoft Aria Online (Natural) - English (United States)" },
];

describe("resolveTtsOptions", () => {
  it("defaults to rate 1 when no options given", () => {
    expect(resolveTtsOptions({}, VOICES).rate).toBe(1);
  });

  it("clamps rate below 0.1 to 0.1", () => {
    expect(resolveTtsOptions({ rate: 0 }, VOICES).rate).toBe(0.1);
    expect(resolveTtsOptions({ rate: -5 }, VOICES).rate).toBe(0.1);
  });

  it("clamps rate above 10 to 10", () => {
    expect(resolveTtsOptions({ rate: 15 }, VOICES).rate).toBe(10);
  });

  it("passes through an in-range rate unchanged", () => {
    expect(resolveTtsOptions({ rate: 1.5 }, VOICES).rate).toBe(1.5);
    expect(resolveTtsOptions({ rate: 0.75 }, VOICES).rate).toBe(0.75);
  });

  it("returns null voice when voiceUri is absent", () => {
    expect(resolveTtsOptions({}, VOICES).voice).toBeNull();
  });

  it("returns the matching voice object by URI", () => {
    const result = resolveTtsOptions({ voiceUri: "Google UK English Female" }, VOICES);
    expect(result.voice).toEqual({ voiceURI: "Google UK English Female" });
  });

  it("returns null when voiceUri does not match any voice", () => {
    const result = resolveTtsOptions({ voiceUri: "Nonexistent Voice" }, VOICES);
    expect(result.voice).toBeNull();
  });

  it("preserves the concrete voice type from the input array", () => {
    const typed = [{ voiceURI: "Foo", name: "Foo Voice", lang: "en-GB" }];
    const result = resolveTtsOptions({ voiceUri: "Foo" }, typed);
    expect(result.voice?.lang).toBe("en-GB");
  });
});
