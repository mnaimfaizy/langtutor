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
}
