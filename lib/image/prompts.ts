/** Deterministic seed derived from a word so repeat generations are stable pre-cache. */
export function wordImageSeed(word: string): number {
  let hash = 0;
  for (const char of word) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) % 2_147_483_647;
}

/**
 * Prompt template for pre-A1 kid vocabulary illustrations (ADR 0016).
 *
 * FLUX.1-schnell (Cloudflare / NIM) does **not** support negative prompts. It also
 * tends to render quoted strings as literal on-image text — so we never wrap the
 * word in quotes, and we state the desired result positively (picture-only).
 */
export function buildKidIllustrationPrompt(word: string): string {
  const subject = word.toLowerCase().trim();
  return [
    `A simple colorful children's book illustration of a single ${subject},`,
    "large and close-up so the subject fills most of the frame with only a thin white margin,",
    "centered, friendly shapes, plain white background,",
    "purely pictorial with no caption, no title, no labels, no letters, no watermark.",
  ].join(" ");
}

/**
 * Effective prompt for an image generate/regenerate (ADR 0023).
 * Uses a non-empty stored/override prompt when present; otherwise the kid template.
 */
export function resolveKidIllustrationPrompt(
  word: string,
  storedOrOverride?: string | null,
): string {
  const trimmed = storedOrOverride?.trim();
  return trimmed && trimmed.length > 0
    ? trimmed
    : buildKidIllustrationPrompt(word.toLowerCase().trim());
}
