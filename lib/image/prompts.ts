/** Deterministic seed derived from a word so repeat generations are stable pre-cache. */
export function wordImageSeed(word: string): number {
  let hash = 0;
  for (const char of word) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) % 2_147_483_647;
}

/** Prompt template for pre-A1 kid vocabulary illustrations (ADR 0016). */
export function buildKidIllustrationPrompt(word: string): string {
  return [
    `A simple, colorful children's book illustration of "${word}".`,
    "Friendly, clear subject on a plain white background.",
    "No text, no letters, no watermark.",
    "Suitable for preschool vocabulary learning.",
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
