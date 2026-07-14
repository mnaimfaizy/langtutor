import { describe, expect, it, vi } from "vitest";

import { ImageProviderError } from "@/lib/image/errors";
import { FallbackImageGenerator } from "@/lib/image/fallback-image-generator";
import type { ImageGenerator } from "@/lib/image/image-generator";
import type { ImageGenerateResult } from "@/lib/image/types";

function okResult(tag: number): ImageGenerateResult {
  return {
    data: new Uint8Array([tag]),
    mimeType: "image/jpeg",
    width: 1024,
    height: 1024,
    seed: 1,
  };
}

function stub(generate: ImageGenerator["generate"]): ImageGenerator {
  return { generate };
}

describe("FallbackImageGenerator", () => {
  it("returns the primary result when primary succeeds", async () => {
    const primary = stub(vi.fn().mockResolvedValue(okResult(1)));
    const fallback = stub(vi.fn().mockResolvedValue(okResult(2)));
    const gen = new FallbackImageGenerator(primary, fallback);

    const result = await gen.generate("apple");
    expect(result.data).toEqual(new Uint8Array([1]));
    expect(fallback.generate).not.toHaveBeenCalled();
  });

  it("falls through to the secondary provider on primary 504", async () => {
    const primary = stub(
      vi.fn().mockRejectedValue(
        new ImageProviderError("NVIDIA NIM image request failed (504)", {
          status: 504,
          provider: "nvidia",
        }),
      ),
    );
    const fallback = stub(vi.fn().mockResolvedValue(okResult(9)));
    const gen = new FallbackImageGenerator(primary, fallback);

    const result = await gen.generate("apple", { seed: 7 });
    expect(result.data).toEqual(new Uint8Array([9]));
    expect(result.usedFallback).toBe(true);
    expect(result.durationMs).toBeTypeOf("number");
    expect(fallback.generate).toHaveBeenCalledWith("apple", { seed: 7 });
  });

  it("does not fall through on 422 validation errors", async () => {
    const err = new ImageProviderError("NVIDIA NIM image request failed (422)", {
      status: 422,
      provider: "nvidia",
    });
    const primary = stub(vi.fn().mockRejectedValue(err));
    const fallback = stub(vi.fn().mockResolvedValue(okResult(2)));
    const gen = new FallbackImageGenerator(primary, fallback);

    await expect(gen.generate("apple")).rejects.toBe(err);
    expect(fallback.generate).not.toHaveBeenCalled();
  });

  it("falls through on Cloudflare NSFW 400 so auto mode can try NVIDIA", async () => {
    const primary = stub(
      vi.fn().mockRejectedValue(
        new ImageProviderError(
          "Cloudflare Workers AI image request failed (400): code 3030 — Input prompt contains NSFW content",
          { status: 400, provider: "cloudflare" },
        ),
      ),
    );
    const fallback = stub(vi.fn().mockResolvedValue(okResult(4)));
    const gen = new FallbackImageGenerator(primary, fallback);

    const result = await gen.generate("floor mat");
    expect(result.data).toEqual(new Uint8Array([4]));
    expect(result.usedFallback).toBe(true);
  });

  it("does not fall through on generic 400 without NSFW/safety signal", async () => {
    const err = new ImageProviderError("Cloudflare Workers AI image request failed (400)", {
      status: 400,
      provider: "cloudflare",
    });
    const primary = stub(vi.fn().mockRejectedValue(err));
    const fallback = stub(vi.fn().mockResolvedValue(okResult(2)));
    const gen = new FallbackImageGenerator(primary, fallback);

    await expect(gen.generate("x")).rejects.toBe(err);
    expect(fallback.generate).not.toHaveBeenCalled();
  });

  it("falls through on network errors without a status", async () => {
    const primary = stub(
      vi.fn().mockRejectedValue(
        new ImageProviderError("NVIDIA NIM image request failed (network)", {
          provider: "nvidia",
        }),
      ),
    );
    const fallback = stub(vi.fn().mockResolvedValue(okResult(3)));
    const gen = new FallbackImageGenerator(primary, fallback);

    await expect(gen.generate("x")).resolves.toMatchObject({ data: new Uint8Array([3]) });
  });
});
