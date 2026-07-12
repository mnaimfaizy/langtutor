import type { ImageGenerateResult, ImageProviderId } from "./types";

/** Compact timing snapshot for admin banners and server logs. */
export type ImageGenerateTiming = {
  provider?: ImageProviderId;
  durationMs?: number;
  usedFallback?: boolean;
};

export function timingFromImageResult(result: ImageGenerateResult): ImageGenerateTiming {
  return {
    provider: result.provider,
    durationMs: result.durationMs,
    usedFallback: result.usedFallback,
  };
}

/** Human-readable fragment, e.g. `12.4s via nvidia` or `24s via cloudflare (fallback)`. */
export function formatImageGenerateTiming(timing: ImageGenerateTiming): string {
  if (timing.durationMs == null) return "";
  const seconds = timing.durationMs / 1000;
  const rounded = seconds >= 10 ? `${Math.round(seconds)}s` : `${seconds.toFixed(1)}s`;
  const provider = timing.provider ?? "unknown";
  const fallback = timing.usedFallback ? " (fallback)" : "";
  return `${rounded} via ${provider}${fallback}`;
}

export function logImageGenerate(
  context: { operation: string; word: string },
  timing: ImageGenerateTiming,
): void {
  console.info("[image-gen]", { ...context, ...timing });
}

/**
 * Time a provider HTTP round-trip and attach {@link ImageGenerateResult.provider} /
 * {@link ImageGenerateResult.durationMs}.
 */
export async function withProviderTiming(
  provider: ImageProviderId,
  run: () => Promise<Omit<ImageGenerateResult, "provider" | "durationMs" | "usedFallback">>,
): Promise<ImageGenerateResult> {
  const start = performance.now();
  const result = await run();
  return {
    ...result,
    provider,
    durationMs: Math.round(performance.now() - start),
  };
}
