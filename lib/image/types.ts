/** Concrete provider ids reported on {@link ImageGenerateResult} for admin timing. */
export type ImageProviderId = "nvidia" | "cloudflare" | "mock";

/** Options for {@link ImageGenerator.generate}. */
export interface ImageGenerateOptions {
  width?: number;
  height?: number;
  /** When set, the provider uses this seed for reproducible output. */
  seed?: number;
  /** Diffusion steps (provider-clamped; NIM max 4, Cloudflare max 8). */
  steps?: number;
}

/** Image bytes plus basic metadata returned by {@link ImageGenerator}. */
export interface ImageGenerateResult {
  data: Uint8Array;
  mimeType: string;
  width: number;
  height: number;
  seed?: number;
  /** Which concrete provider produced this result (admin diagnostics). */
  provider?: ImageProviderId;
  /** Wall-clock ms for the provider call (or total when fallback was used). */
  durationMs?: number;
  /** True when {@link FallbackImageGenerator} served via the secondary provider. */
  usedFallback?: boolean;
}
