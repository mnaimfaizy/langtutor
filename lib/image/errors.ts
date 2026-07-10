/**
 * Typed failure from an {@link ImageGenerator} concrete. Carries the upstream HTTP
 * status when available so {@link FallbackImageGenerator} can decide whether to try
 * the next provider (404 / 429 / 5xx) without parsing message strings.
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
export function isImageFallbackStatus(status: number | undefined): boolean {
  if (status === undefined) return true; // network / parse failures
  return status === 404 || status === 429 || status >= 500;
}
