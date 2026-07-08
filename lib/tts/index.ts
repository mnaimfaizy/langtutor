/**
 * Public surface of the TTS layer: the `TtsSynthesizer` **interface**, option/result types,
 * and browser-side helpers. Obtain a synthesizer via `getTtsSynthesizer()` in
 * `lib/tts/server.ts`. The Groq concrete and `MockTtsSynthesizer` are imported from their
 * own paths — never re-exported here.
 */
export type { TtsOptions } from "./speech-synthesis";
export { GROQ_ORPHEUS_VOICES, resolveTtsOptions } from "./speech-synthesis";
export type { TtsSynthesizer } from "./tts-synthesizer";
export type { TtsSynthesizeOptions, TtsSynthesizeResult } from "./types";
