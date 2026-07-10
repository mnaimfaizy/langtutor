import { ImageProviderError, isImageFallbackStatus } from "./errors";
import type { ImageGenerator } from "./image-generator";
import type { ImageGenerateOptions, ImageGenerateResult } from "./types";

/**
 * Tries `primary`, then `fallback` when the primary fails with a retryable status
 * (404 / 429 / 5xx) or a network/parse error without a status.
 */
export class FallbackImageGenerator implements ImageGenerator {
  constructor(
    private readonly primary: ImageGenerator,
    private readonly fallback: ImageGenerator,
  ) {}

  async generate(prompt: string, options?: ImageGenerateOptions): Promise<ImageGenerateResult> {
    try {
      return await this.primary.generate(prompt, options);
    } catch (err) {
      if (!shouldTryFallback(err)) throw err;
      try {
        return await this.fallback.generate(prompt, options);
      } catch (fallbackErr) {
        throw fallbackErr instanceof ImageProviderError
          ? fallbackErr
          : new ImageProviderError(
              fallbackErr instanceof Error ? fallbackErr.message : "Image fallback failed",
              { provider: "fallback", cause: fallbackErr },
            );
      }
    }
  }
}

function shouldTryFallback(err: unknown): boolean {
  if (err instanceof ImageProviderError) {
    return isImageFallbackStatus(err.status);
  }
  // Unknown errors (e.g. unexpected throw) — do not silently swap providers.
  return false;
}
