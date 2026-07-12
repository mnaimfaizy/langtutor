import type { ImageGenerator } from "./image-generator";
import type { ImageGenerateOptions, ImageGenerateResult } from "./types";

/** Canned response for {@link MockImageGenerator} — everything is optional. */
export interface MockImageGeneratorOptions {
  data?: Uint8Array;
  mimeType?: string;
  width?: number;
  height?: number;
  seed?: number;
}

/**
 * Offline {@link ImageGenerator} for tests. Touches no network, so store-miss/store-hit
 * flows are unit-testable without a provider API key.
 */
export class MockImageGenerator implements ImageGenerator {
  readonly calls: Array<{ prompt: string; options?: ImageGenerateOptions }> = [];

  constructor(private readonly opts: MockImageGeneratorOptions = {}) {}

  async generate(prompt: string, options?: ImageGenerateOptions): Promise<ImageGenerateResult> {
    this.calls.push({ prompt, options });
    return {
      data: this.opts.data ?? new Uint8Array([1, 2, 3]),
      mimeType: this.opts.mimeType ?? "image/png",
      width: options?.width ?? this.opts.width ?? 1024,
      height: options?.height ?? this.opts.height ?? 1024,
      seed: options?.seed ?? this.opts.seed,
      provider: "mock",
      durationMs: 0,
    };
  }
}
