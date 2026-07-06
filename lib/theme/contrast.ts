/** An sRGB color in the 0–255 range per channel. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0–1) for an sRGB color. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

/** WCAG contrast ratio (1–21) between two sRGB colors, order-independent. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2.1 AA threshold: 4.5:1 for normal text, 3:1 for large text (≥18pt / 14pt bold). */
export function meetsWcagAa(a: Rgb, b: Rgb, largeText = false): boolean {
  return contrastRatio(a, b) >= (largeText ? 3 : 4.5);
}

/** Parses a CSS `rgb()`/`rgba()` string (as returned by `getComputedStyle`) into an {@link Rgb}. */
export function parseRgbString(value: string): Rgb {
  const match = /rgba?\(([^)]+)\)/.exec(value);
  if (!match) throw new Error(`Cannot parse color as rgb()/rgba(): ${value}`);
  const [r, g, b] = match[1].split(",").map((part) => parseFloat(part.trim()));
  if (r === undefined || g === undefined || b === undefined) {
    throw new Error(`Cannot parse color as rgb()/rgba(): ${value}`);
  }
  return { r, g, b };
}
