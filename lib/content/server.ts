import "server-only";

import type { ContentValidator } from "./content-validator";
import { LocalContentValidator } from "./content-validator";
import { loadCefrData } from "@/lib/lexicon/data-loader";

let _validator: ContentValidator | undefined;

/**
 * Server-only composition root for the {@link ContentValidator} seam. Returns the
 * lazily-constructed {@link LocalContentValidator} singleton — CEFR data (~3 MB) is
 * loaded from disk once and reused across requests. Mirrors `lib/llm/server.ts`.
 *
 * Import only from server contexts (route handlers under `app/api/*`); never from
 * client components or `lib/registry.ts`.
 */
export function getContentValidator(): ContentValidator {
  if (!_validator) {
    _validator = new LocalContentValidator(loadCefrData());
  }
  return _validator;
}
