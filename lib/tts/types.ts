import type { TtsOptions } from "./speech-synthesis";

/** Alias for {@link TtsOptions} at the synthesizer boundary. */
export type TtsSynthesizeOptions = TtsOptions;

/** Audio bytes plus MIME type returned by {@link TtsSynthesizer}. */
export interface TtsSynthesizeResult {
  data: Uint8Array;
  mimeType: string;
}
