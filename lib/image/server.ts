import "server-only";

import { loadImageConfig } from "./config";
import type { ImageGenerator } from "./image-generator";
import { NvidiaNimImageGenerator } from "./nvidia-nim-image-generator";

/**
 * Server-only composition for the image-generation seam (ADR 0016). Imported **only** by
 * route handlers under `app/api/image/*` — never by client code (the `server-only` import
 * makes that a build error).
 */
export async function getImageGenerator(): Promise<ImageGenerator> {
  return new NvidiaNimImageGenerator(loadImageConfig());
}
