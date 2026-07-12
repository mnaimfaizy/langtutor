import { describe, expect, it, vi } from "vitest";

import {
  formatImageGenerateTiming,
  timingFromImageResult,
  withProviderTiming,
} from "@/lib/image/timing";

describe("formatImageGenerateTiming", () => {
  it("returns empty string when duration is missing", () => {
    expect(formatImageGenerateTiming({})).toBe("");
    expect(formatImageGenerateTiming({ provider: "nvidia" })).toBe("");
  });

  it("formats durations and includes provider", () => {
    expect(formatImageGenerateTiming({ provider: "nvidia", durationMs: 12400 })).toBe(
      "12s via nvidia",
    );
    expect(formatImageGenerateTiming({ provider: "cloudflare", durationMs: 2400 })).toBe(
      "2.4s via cloudflare",
    );
  });

  it("marks fallback attempts", () => {
    expect(
      formatImageGenerateTiming({
        provider: "cloudflare",
        durationMs: 24100,
        usedFallback: true,
      }),
    ).toBe("24s via cloudflare (fallback)");
  });
});

describe("withProviderTiming", () => {
  it("attaches provider and rounded durationMs", async () => {
    vi.spyOn(performance, "now").mockReturnValueOnce(100).mockReturnValueOnce(250.7);

    const result = await withProviderTiming("nvidia", async () => ({
      data: new Uint8Array([1]),
      mimeType: "image/jpeg",
      width: 1024,
      height: 1024,
    }));

    expect(result.provider).toBe("nvidia");
    expect(result.durationMs).toBe(151);
    expect(timingFromImageResult(result)).toEqual({
      provider: "nvidia",
      durationMs: 151,
      usedFallback: undefined,
    });
  });
});
