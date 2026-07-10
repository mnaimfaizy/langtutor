import "server-only";

import {
  getImageGeneratorProviderMode,
  loadCloudflareImageConfig,
  loadNvidiaImageConfig,
  tryLoadCloudflareImageConfig,
  tryLoadNvidiaImageConfig,
} from "./config";
import { CloudflareWorkersAiImageGenerator } from "./cloudflare-workers-ai-image-generator";
import { FallbackImageGenerator } from "./fallback-image-generator";
import type { ImageGenerator } from "./image-generator";
import { NvidiaNimImageGenerator } from "./nvidia-nim-image-generator";

/**
 * Server-only composition for the image-generation seam (ADR 0016). Imported **only** by
 * route handlers under `app/api/image/*` — never by client code (the `server-only` import
 * makes that a build error).
 *
 * Provider selection via `IMAGE_GENERATOR_PROVIDER`:
 * - `nvidia` — NVIDIA NIM only
 * - `cloudflare` — Cloudflare Workers AI only
 * - `auto` (default) — NIM primary, Cloudflare on 404/429/5xx/network when both configured
 */
export async function getImageGenerator(): Promise<ImageGenerator> {
  const mode = getImageGeneratorProviderMode();

  if (mode === "nvidia") {
    return new NvidiaNimImageGenerator(loadNvidiaImageConfig());
  }

  if (mode === "cloudflare") {
    return new CloudflareWorkersAiImageGenerator(loadCloudflareImageConfig());
  }

  const nvidia = tryLoadNvidiaImageConfig();
  const cloudflare = tryLoadCloudflareImageConfig();

  if (nvidia && cloudflare) {
    return new FallbackImageGenerator(
      new NvidiaNimImageGenerator(nvidia),
      new CloudflareWorkersAiImageGenerator(cloudflare),
    );
  }
  if (nvidia) return new NvidiaNimImageGenerator(nvidia);
  if (cloudflare) return new CloudflareWorkersAiImageGenerator(cloudflare);

  throw new Error(
    "No image generator configured — set NVIDIA_NIM_API_KEY and/or CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN in .env.local",
  );
}
