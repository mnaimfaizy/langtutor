/** Deterministic seed derived from a word so repeat generations are stable pre-cache. */
export function wordImageSeed(word: string): number {
  let hash = 0;
  for (const char of word) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) % 2_147_483_647;
}

/**
 * Seed for admin regenerate — must differ from {@link wordImageSeed} so Cloudflare's
 * seed+prompt safety filter can clear a prior NSFW 400 without changing the prompt.
 */
export function regenerateWordImageSeed(word: string, entropy: number = Date.now()): number {
  const base = wordImageSeed(word.toLowerCase().trim());
  const jitter = Math.abs(entropy | 0) % 1_000_000_007;
  return (base + jitter + 1) % 2_147_483_647;
}

/**
 * Prompt template for pre-A1 kid vocabulary illustrations (ADR 0016).
 *
 * FLUX.1-schnell (Cloudflare / NIM) does **not** support negative prompts. It also
 * tends to render quoted strings as literal on-image text — so we never wrap the
 * word in quotes, and we state the desired result positively (picture-only).
 *
 * When @sense is provided (from a shared-path draft), use it as the drawable
 * subject so ambiguous tokens like "mat" / "pat" illustrate the intended meaning.
 */
export function buildKidIllustrationPrompt(word: string, sense?: string | null): string {
  const normalized = word.toLowerCase().trim();
  const trimmedSense = sense?.trim();
  const subject =
    trimmedSense && trimmedSense.length > 0
      ? trimmedSense
      : normalized;
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
  sense?: string | null,
): string {
  const trimmed = storedOrOverride?.trim();
  return trimmed && trimmed.length > 0
    ? trimmed
    : buildKidIllustrationPrompt(word.toLowerCase().trim(), sense);
}
