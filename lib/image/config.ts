import "server-only";

import {
  DEFAULT_NVIDIA_IMAGE_MODEL,
  getNvidiaNimApiKey,
  NVIDIA_GENAI_BASE_URL,
} from "@/lib/ai/nvidia";

/** Server-only image-generation configuration (ADR 0016). */
export interface ImageConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export function loadImageConfig(): ImageConfig {
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
