/**
 * Public surface of the image-generation layer: the `ImageGenerator` **interface** and its
 * option/result types. Obtain an instance via `getImageGenerator()` in `lib/image/server.ts`.
 * The NVIDIA concrete and `MockImageGenerator` are imported from their own paths — never
 * re-exported here.
 */
export type { ImageGenerator } from "./image-generator";
export type { ImageGenerateOptions, ImageGenerateResult } from "./types";
