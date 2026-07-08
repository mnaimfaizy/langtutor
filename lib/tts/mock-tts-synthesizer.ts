import type { TtsSynthesizer } from "./tts-synthesizer";
import type { TtsSynthesizeOptions, TtsSynthesizeResult } from "./types";

/** Canned response for {@link MockTtsSynthesizer} — everything is optional. */
export interface MockTtsSynthesizerOptions {
  data?: Uint8Array;
  mimeType?: string;
}

/**
 * Offline {@link TtsSynthesizer} for tests. Touches no network, so store-miss/store-hit
 * flows are unit-testable without a provider API key.
 */
export class MockTtsSynthesizer implements TtsSynthesizer {
  readonly calls: Array<{ text: string; options?: TtsSynthesizeOptions }> = [];

  constructor(private readonly opts: MockTtsSynthesizerOptions = {}) {}

  async synthesize(text: string, options?: TtsSynthesizeOptions): Promise<TtsSynthesizeResult> {
    this.calls.push({ text, options });
    return {
      data: this.opts.data ?? new Uint8Array([1, 2, 3]),
      mimeType: this.opts.mimeType ?? "audio/wav",
    };
  }
}
