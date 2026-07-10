import "server-only";

import { z } from "zod";

import { CLOUDFLARE_AI_BASE_URL, DEFAULT_CLOUDFLARE_IMAGE_MODEL } from "@/lib/ai/cloudflare";

import { ImageProviderError } from "./errors";
import type { ImageGenerator } from "./image-generator";
import type { ImageGenerateOptions, ImageGenerateResult } from "./types";

/** Workers AI FLUX.1-schnell is billed/documented around 512×512 tiles. */
export const DEFAULT_CLOUDFLARE_IMAGE_SIZE = 512;
const DEFAULT_STEPS = 4;

/** Cloudflare Workers AI REST envelope — Zod-parsed at the boundary (hard rule #3). */
const CloudflareImageResponse = z
  .object({
    success: z.boolean().optional(),
    result: z
      .object({
        image: z.string().min(1),
      })
      .optional(),
    image: z.string().min(1).optional(),
    errors: z
      .array(z.object({ message: z.string().optional(), code: z.number().optional() }))
      .optional(),
  })
  .refine((body) => Boolean(body.result?.image ?? body.image), {
    message: "missing image base64",
  });

export interface CloudflareImageConfig {
  accountId: string;
  apiToken: string;
  model?: string;
}

/**
 * {@link ImageGenerator} backed by Cloudflare Workers AI (FLUX.1-schnell).
 * Server-only: never import this from client code or feature modules.
 *
 * Note: the REST model accepts `prompt` / `steps` / `seed` only — width/height are
 * not sent; result metadata uses {@link DEFAULT_CLOUDFLARE_IMAGE_SIZE} unless the
 * caller passed explicit dimensions for bookkeeping.
 */
export class CloudflareWorkersAiImageGenerator implements ImageGenerator {
  constructor(private readonly config: CloudflareImageConfig) {}

  async generate(prompt: string, options: ImageGenerateOptions = {}): Promise<ImageGenerateResult> {
    const seed = options.seed ?? 0;
    const steps = Math.min(Math.max(options.steps ?? DEFAULT_STEPS, 1), 8);
    const width = options.width ?? DEFAULT_CLOUDFLARE_IMAGE_SIZE;
    const height = options.height ?? DEFAULT_CLOUDFLARE_IMAGE_SIZE;
    const model = this.config.model ?? DEFAULT_CLOUDFLARE_IMAGE_MODEL;
    const url = `${CLOUDFLARE_AI_BASE_URL}/${this.config.accountId}/ai/run/${model}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, steps, seed }),
      });
    } catch (cause) {
      throw new ImageProviderError("Cloudflare Workers AI image request failed (network)", {
        provider: "cloudflare",
        cause,
      });
    }

    if (!response.ok) {
      throw new ImageProviderError(
        `Cloudflare Workers AI image request failed (${response.status})`,
        { status: response.status, provider: "cloudflare" },
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      throw new ImageProviderError("Cloudflare Workers AI image response was not valid JSON", {
        provider: "cloudflare",
        cause,
      });
    }

    const parsed = CloudflareImageResponse.safeParse(body);
    if (!parsed.success) {
      throw new ImageProviderError("Cloudflare Workers AI image response failed validation", {
        provider: "cloudflare",
      });
    }

    const b64 = parsed.data.result?.image ?? parsed.data.image;
    if (!b64) {
      throw new ImageProviderError("Cloudflare Workers AI image response missing image", {
        provider: "cloudflare",
      });
    }

    const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return { data, mimeType: "image/jpeg", width, height, seed };
  }
}
