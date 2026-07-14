/**
 * Typed failure from an {@link ImageGenerator} concrete. Carries the upstream HTTP
 * status when available so {@link FallbackImageGenerator} can decide whether to try
 * the next provider (404 / 429 / 5xx / Cloudflare safety 400) without parsing
 * message strings alone.
 */
export class ImageProviderError extends Error {
  readonly status?: number;
  readonly provider: string;

  constructor(message: string, options: { status?: number; provider: string; cause?: unknown }) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ImageProviderError";
    this.status = options.status;
    this.provider = options.provider;
  }
}

/** Statuses that warrant trying the next image provider in `auto` mode. */
export function isImageFallbackStatus(status: number | undefined, message?: string): boolean {
  if (status === undefined) return true; // network / parse failures
  if (status === 404 || status === 429 || status >= 500) return true;
  // Cloudflare Workers AI returns HTTP 400 + code 3030 for seed/prompt safety rejects.
  // Those are worth trying NVIDIA in auto mode (same prompt often succeeds there).
  if (status === 400 && message !== undefined && /nsfw|3030|safety/i.test(message)) {
    return true;
  }
  return false;
}
