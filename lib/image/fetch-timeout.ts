/**
 * Abort hung provider calls so free-tier NIM 504s don't block admin for minutes.
 * Leaves headroom for Cloudflare fallback within a typical 60s route budget.
 */
export const IMAGE_GENERATE_FETCH_TIMEOUT_MS = 45_000;

export function imageGenerateAbortSignal(
  timeoutMs: number = IMAGE_GENERATE_FETCH_TIMEOUT_MS,
): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

export function isAbortOrTimeoutError(cause: unknown): boolean {
  return cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
}
