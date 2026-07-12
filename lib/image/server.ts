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
 * - `auto` (default) — Cloudflare primary, NVIDIA NIM on 404/429/5xx/network/timeout when
 *   both are configured (free-tier NIM is unreliable for interactive admin regenerate)
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

  if (cloudflare && nvidia) {
    return new FallbackImageGenerator(
      new CloudflareWorkersAiImageGenerator(cloudflare),
      new NvidiaNimImageGenerator(nvidia),
    );
  }
  if (cloudflare) return new CloudflareWorkersAiImageGenerator(cloudflare);
  if (nvidia) return new NvidiaNimImageGenerator(nvidia);

  throw new Error(
    "No image generator configured — set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN and/or NVIDIA_NIM_API_KEY in .env.local",
  );
}
