/**
 * Public surface of the TTS layer: the `TtsSynthesizer` **interface**, option/result types,
 * and browser-side helpers. Obtain a synthesizer via `getTtsSynthesizer()` in
 * `lib/tts/server.ts`. The Groq concrete and `MockTtsSynthesizer` are imported from their
 * own paths — never re-exported here.
 */
export type { TtsOptions } from "./speech-synthesis";
export { GROQ_ORPHEUS_VOICES, resolveTtsOptions } from "./speech-synthesis";
export {
  composeSpokenText,
  normalizeDirection,
  ORPHEUS_DIRECTION_PRESETS,
  parseSpokenText,
  resolveSpokenText,
  TTS_MAX_DIRECTION_CHARS,
  TTS_MAX_SPOKEN_TEXT_CHARS,
} from "./prompts";
export type { SpokenTextParts } from "./prompts";
export type { AdminAudioGenerateOptions } from "./resolve-word-audio";
export type { TtsSynthesizer } from "./tts-synthesizer";
export type { TtsSynthesizeOptions, TtsSynthesizeResult } from "./types";
