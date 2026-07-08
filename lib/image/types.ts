/** Options for {@link ImageGenerator.generate}. */
export interface ImageGenerateOptions {
  width?: number;
  height?: number;
  /** When set, the provider uses this seed for reproducible output. */
  seed?: number;
}

/** Image bytes plus basic metadata returned by {@link ImageGenerator}. */
export interface ImageGenerateResult {
  data: Uint8Array;
  mimeType: string;
  width: number;
  height: number;
  seed?: number;
}
