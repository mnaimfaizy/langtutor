/**
 * Spoken-text helpers for TTS generate/regenerate (ADR 0044).
 * Orpheus English steers delivery with bracketed vocal directions that are not
 * spoken as prose, e.g. `[cheerful] apple` speaks only "apple".
 */

/** Groq Orpheus speech `input` character limit. */
export const TTS_MAX_SPOKEN_TEXT_CHARS = 200;

/** Max length for a vocal direction (1–2 words per Groq guidance). */
export const TTS_MAX_DIRECTION_CHARS = 40;

/** Admin UI draft: what to say + optional Orpheus direction (without brackets). */
export type SpokenTextParts = {
  say: string;
  direction: string;
};

/** Common Orpheus English directions from Groq docs (not exhaustive). */
export const ORPHEUS_DIRECTION_PRESETS = [
  "cheerful",
  "friendly",
  "warm",
  "casual",
  "whisper",
  "excited",
  "dramatic",
  "deadpan",
  "professionally",
  "confidently",
  "singsong",
  "breathy",
  "slow carefully",
] as const;

const LEADING_DIRECTION = /^\[([^\]]+)\]\s*([\s\S]*)$/;

/**
 * Normalize a direction for composition: strip wrapping brackets, collapse
 * whitespace. Empty when nothing usable remains.
 */
export function normalizeDirection(raw?: string | null): string {
  let value = raw?.trim() ?? "";
  if (!value) return "";
  while (value.startsWith("[") && value.endsWith("]") && value.length > 2) {
    value = value.slice(1, -1).trim();
  }
  value = value.replace(/\s+/g, " ").trim();
  return value.slice(0, TTS_MAX_DIRECTION_CHARS);
}

/**
 * Build the exact Orpheus `input`: optional `[direction]` then the say text.
 * Free-form prose must not go in `direction` — it would be spoken.
 */
export function composeSpokenText(say: string, direction?: string | null): string {
  const spoken = say.trim();
  if (!spoken) return "";
  const dir = normalizeDirection(direction);
  const text = dir ? `[${dir}] ${spoken}` : spoken;
  return text.slice(0, TTS_MAX_SPOKEN_TEXT_CHARS);
}

/**
 * Split a stored TTS prompt into say + direction for the admin draft UI.
 * Leading `[direction]` is treated as a vocal tag; everything after is say text.
 */
export function parseSpokenText(
  storedOrOverride: string | null | undefined,
  fallbackSay: string,
): SpokenTextParts {
  const fallback = fallbackSay.toLowerCase().trim();
  const trimmed = storedOrOverride?.trim();
  if (!trimmed) {
    return { say: fallback, direction: "" };
  }
  const match = LEADING_DIRECTION.exec(trimmed);
  if (match) {
    const direction = normalizeDirection(match[1]);
    const say = match[2]?.trim() || fallback;
    return { say, direction };
  }
  return { say: trimmed, direction: "" };
}

/**
 * Effective text sent to the TTS provider.
 * Uses a non-empty stored/override prompt when present; otherwise the normalized word.
 */
export function resolveSpokenText(word: string, storedOrOverride?: string | null): string {
  const trimmed = storedOrOverride?.trim();
  const text = trimmed && trimmed.length > 0 ? trimmed : word.toLowerCase().trim();
  return text.slice(0, TTS_MAX_SPOKEN_TEXT_CHARS);
}
