import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NvidiaNimImageGenerator } from "@/lib/image/nvidia-nim-image-generator";

describe("NvidiaNimImageGenerator", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends snapped 1024 size and steps, returns artifacts[0].base64", async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff]);
    const b64 = Buffer.from(jpegBytes).toString("base64");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ artifacts: [{ base64: b64, finishReason: "SUCCESS" }] }), {
        status: 200,
      }),
    );

    const gen = new NvidiaNimImageGenerator({
      apiKey: "nvapi-test",
      baseURL: "https://ai.api.nvidia.com/v1/genai",
      model: "black-forest-labs/flux.1-schnell",
    });
    const result = await gen.generate("an apple", { width: 512, height: 512, seed: 42 });

    expect(result.data).toEqual(jpegBytes);
    expect(result.width).toBe(768); // nearest allowed to 512
    expect(result.height).toBe(768);
    expect(result.provider).toBe("nvidia");
    expect(result.durationMs).toBeTypeOf("number");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init.body))).toEqual({
      prompt: "an apple",
      width: 768,
      height: 768,
      seed: 42,
      steps: 4,
    });
  });

  it("throws ImageProviderError with status on 504", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 504 }));
    const gen = new NvidiaNimImageGenerator({
      apiKey: "nvapi-test",
      baseURL: "https://ai.api.nvidia.com/v1/genai",
      model: "black-forest-labs/flux.1-schnell",
    });
    await expect(gen.generate("x")).rejects.toMatchObject({
      status: 504,
      provider: "nvidia",
    });
  });

  it("maps TimeoutError to a timeout ImageProviderError", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new DOMException("The operation was aborted", "TimeoutError"),
    );
    const gen = new NvidiaNimImageGenerator({
      apiKey: "nvapi-test",
      baseURL: "https://ai.api.nvidia.com/v1/genai",
      model: "black-forest-labs/flux.1-schnell",
    });
    await expect(gen.generate("x")).rejects.toMatchObject({
      message: "NVIDIA NIM image request timed out",
      provider: "nvidia",
    });
  });
});
