import "server-only";

import { z } from "zod";

import type { ImageConfig } from "./config";
import type { ImageGenerator } from "./image-generator";
import type { ImageGenerateOptions, ImageGenerateResult } from "./types";

const DEFAULT_WIDTH = 512;
const DEFAULT_HEIGHT = 512;

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
    const width = options.width ?? DEFAULT_WIDTH;
    const height = options.height ?? DEFAULT_HEIGHT;
    const seed = options.seed ?? 0;

    const url = `${this.config.baseURL}/${this.config.model}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, width, height, seed }),
    });

    if (!response.ok) {
      throw new Error(`NVIDIA NIM image request failed (${response.status})`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error("NVIDIA NIM image response was not valid JSON");
    }

    const parsed = NimImageResponse.safeParse(body);
    if (!parsed.success) {
      throw new Error("NVIDIA NIM image response failed validation");
    }

    const b64 = parsed.data.artifacts[0]!.base64;
    const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    return { data, mimeType: "image/jpeg", width, height, seed };
  }
}
