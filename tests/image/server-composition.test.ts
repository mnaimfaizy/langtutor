import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("getImageGenerator composition", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses FallbackImageGenerator in auto mode when both providers are configured", async () => {
    vi.stubEnv("IMAGE_GENERATOR_PROVIDER", "auto");
    vi.stubEnv("NVIDIA_NIM_API_KEY", "nvapi-test");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cfut_test");

    const { getImageGenerator } = await import("@/lib/image/server");
    const { FallbackImageGenerator } = await import("@/lib/image/fallback-image-generator");

    const gen = await getImageGenerator();
    expect(gen).toBeInstanceOf(FallbackImageGenerator);
  });

  it("uses Cloudflare only when IMAGE_GENERATOR_PROVIDER=cloudflare", async () => {
    vi.stubEnv("IMAGE_GENERATOR_PROVIDER", "cloudflare");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cfut_test");
    vi.stubEnv("NVIDIA_NIM_API_KEY", "");

    const { getImageGenerator } = await import("@/lib/image/server");
    const { CloudflareWorkersAiImageGenerator } =
      await import("@/lib/image/cloudflare-workers-ai-image-generator");

    const gen = await getImageGenerator();
    expect(gen).toBeInstanceOf(CloudflareWorkersAiImageGenerator);
  });
});
