import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CloudflareWorkersAiImageGenerator } from "@/lib/image/cloudflare-workers-ai-image-generator";
import { ImageProviderError } from "@/lib/image/errors";

describe("CloudflareWorkersAiImageGenerator", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts prompt/steps/seed and returns decoded JPEG bytes from result.image", async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff]);
    const b64 = Buffer.from(jpegBytes).toString("base64");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, result: { image: b64 } }), { status: 200 }),
      );

    const gen = new CloudflareWorkersAiImageGenerator({
      accountId: "abc123accountid00000000000000000",
      apiToken: "cfut_test",
    });
    const result = await gen.generate("an apple", { seed: 42, steps: 4 });

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.data).toEqual(jpegBytes);
    expect(result.seed).toBe(42);
    expect(result.provider).toBe("cloudflare");
    expect(result.durationMs).toBeTypeOf("number");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/abc123accountid00000000000000000/ai/run/@cf/black-forest-labs/flux-1-schnell",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer cfut_test",
        }),
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      prompt: "an apple",
      steps: 4,
      seed: 42,
    });
  });

  it("throws ImageProviderError with status on non-OK responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 429 }));
    const gen = new CloudflareWorkersAiImageGenerator({
      accountId: "abc",
      apiToken: "tok",
    });
    await expect(gen.generate("x")).rejects.toMatchObject({
      name: "ImageProviderError",
      status: 429,
      provider: "cloudflare",
    } satisfies Partial<ImageProviderError>);
  });
});
