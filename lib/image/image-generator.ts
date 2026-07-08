import type { ImageGenerateOptions, ImageGenerateResult } from "./types";

/**
 * Image-generation seam (ADR 0016). Feature/server code imports **this interface**; the
 * concrete (`NvidiaNimImageGenerator`) is wired in `lib/image/server.ts`. "Move to a
 * different image provider later" = swap the concrete there, not at any call site.
 *
 * The concrete only ever runs server-side (route handlers under `app/api/image/*`); the
 * browser reaches it through those same-origin routes, never directly.
 */
export interface ImageGenerator {
  /** Generate an image from a text prompt. */
  generate(prompt: string, options?: ImageGenerateOptions): Promise<ImageGenerateResult>;
}
