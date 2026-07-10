import "server-only";

import {
  DEFAULT_CLOUDFLARE_IMAGE_MODEL,
  getCloudflareAccountId,
  getCloudflareApiToken,
} from "@/lib/ai/cloudflare";
import {
  DEFAULT_NVIDIA_IMAGE_MODEL,
  getNvidiaNimApiKey,
  NVIDIA_GENAI_BASE_URL,
} from "@/lib/ai/nvidia";

import type { CloudflareImageConfig } from "./cloudflare-workers-ai-image-generator";

/** Server-only NVIDIA image-generation configuration (ADR 0016). */
export interface ImageConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export type ImageGeneratorProviderMode = "nvidia" | "cloudflare" | "auto";

export function getImageGeneratorProviderMode(): ImageGeneratorProviderMode {
  const raw = process.env.IMAGE_GENERATOR_PROVIDER?.trim().toLowerCase();
  if (raw === "nvidia" || raw === "cloudflare" || raw === "auto") return raw;
  return "auto";
}

export function loadNvidiaImageConfig(): ImageConfig {
  const apiKey = getNvidiaNimApiKey();
  if (!apiKey) {
    throw new Error(
      "NVIDIA_NIM_API_KEY is not set — provision a key at build.nvidia.com and add it to .env.local",
    );
  }

  return {
    apiKey,
    baseURL: NVIDIA_GENAI_BASE_URL,
    model: DEFAULT_NVIDIA_IMAGE_MODEL,
  };
}

/** @deprecated Prefer {@link loadNvidiaImageConfig}; kept for existing call sites. */
export function loadImageConfig(): ImageConfig {
  return loadNvidiaImageConfig();
}

export function loadCloudflareImageConfig(): CloudflareImageConfig {
  const accountId = getCloudflareAccountId();
  const apiToken = getCloudflareApiToken();
  if (!accountId || !apiToken) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required for Cloudflare image generation",
    );
  }

  return {
    accountId,
    apiToken,
    model: DEFAULT_CLOUDFLARE_IMAGE_MODEL,
  };
}

export function tryLoadNvidiaImageConfig(): ImageConfig | undefined {
  const apiKey = getNvidiaNimApiKey();
  if (!apiKey) return undefined;
  return {
    apiKey,
    baseURL: NVIDIA_GENAI_BASE_URL,
    model: DEFAULT_NVIDIA_IMAGE_MODEL,
  };
}

export function tryLoadCloudflareImageConfig(): CloudflareImageConfig | undefined {
  const accountId = getCloudflareAccountId();
  const apiToken = getCloudflareApiToken();
  if (!accountId || !apiToken) return undefined;
  return {
    accountId,
    apiToken,
    model: DEFAULT_CLOUDFLARE_IMAGE_MODEL,
  };
}
