/**
 * Hosted NVIDIA FLUX.1-schnell only accepts these widths/heights (OpenAPI enum).
 * 512 is rejected with HTTP 422.
 */
export const NVIDIA_FLUX_ALLOWED_SIZES = [
  768, 832, 896, 960, 1024, 1088, 1152, 1216, 1280, 1344,
] as const;

export type NvidiaFluxSize = (typeof NVIDIA_FLUX_ALLOWED_SIZES)[number];

export const DEFAULT_NVIDIA_IMAGE_SIZE: NvidiaFluxSize = 1024;

const ALLOWED = new Set<number>(NVIDIA_FLUX_ALLOWED_SIZES);

/** Snap to an allowed FLUX size; prefer exact match, else nearest, else 1024. */
export function snapNvidiaFluxSize(value: number | undefined): NvidiaFluxSize {
  if (value !== undefined && ALLOWED.has(value)) {
    return value as NvidiaFluxSize;
  }
  if (value === undefined) return DEFAULT_NVIDIA_IMAGE_SIZE;

  let best: NvidiaFluxSize = DEFAULT_NVIDIA_IMAGE_SIZE;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const size of NVIDIA_FLUX_ALLOWED_SIZES) {
    const dist = Math.abs(size - value);
    if (dist < bestDist) {
      best = size;
      bestDist = dist;
    }
  }
  return best;
}
