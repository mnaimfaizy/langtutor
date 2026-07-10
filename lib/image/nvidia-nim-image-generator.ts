import "server-only";

import { z } from "zod";

import type { ImageConfig } from "./config";
import { ImageProviderError } from "./errors";
import type { ImageGenerator } from "./image-generator";
import { DEFAULT_NVIDIA_IMAGE_SIZE, snapNvidiaFluxSize } from "./nvidia-sizes";
import type { ImageGenerateOptions, ImageGenerateResult } from "./types";

const DEFAULT_STEPS = 4;

/** NVIDIA NIM GenAI image response — Zod-parsed at the boundary (hard rule #3). */
const NimImageResponse = z.object({
  artifacts: z
    .array(
      z.object({
        base64: z.string().min(1),
        finishReason: z.string().optional(),
      }),
    )
    .min(1),
});

/**
 * {@link ImageGenerator} backed by NVIDIA's hosted GenAI API (FLUX.1-schnell).
 * Server-only: never import this from client code or feature modules.
 */
export class NvidiaNimImageGenerator implements ImageGenerator {
  constructor(private readonly config: ImageConfig) {}

  async generate(prompt: string, options: ImageGenerateOptions = {}): Promise<ImageGenerateResult> {
    const width = snapNvidiaFluxSize(options.width ?? DEFAULT_NVIDIA_IMAGE_SIZE);
    const height = snapNvidiaFluxSize(options.height ?? DEFAULT_NVIDIA_IMAGE_SIZE);
    const seed = options.seed ?? 0;
    const steps = Math.min(Math.max(options.steps ?? DEFAULT_STEPS, 1), 4);

    const url = `${this.config.baseURL}/${this.config.model}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, width, height, seed, steps }),
      });
    } catch (cause) {
      throw new ImageProviderError("NVIDIA NIM image request failed (network)", {
        provider: "nvidia",
        cause,
      });
    }

    if (!response.ok) {
      throw new ImageProviderError(`NVIDIA NIM image request failed (${response.status})`, {
        status: response.status,
        provider: "nvidia",
      });
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      throw new ImageProviderError("NVIDIA NIM image response was not valid JSON", {
        provider: "nvidia",
        cause,
      });
    }

    const parsed = NimImageResponse.safeParse(body);
    if (!parsed.success) {
      throw new ImageProviderError("NVIDIA NIM image response failed validation", {
        provider: "nvidia",
      });
    }

    const b64 = parsed.data.artifacts[0]!.base64;
    const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    return { data, mimeType: "image/jpeg", width, height, seed };
  }
}
