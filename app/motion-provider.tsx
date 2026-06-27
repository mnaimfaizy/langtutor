"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";

/**
 * App-wide framer-motion configuration. `reducedMotion="user"` honours the
 * visitor's `prefers-reduced-motion` setting — disabling transform/layout
 * animations for those who ask for it (an accessibility requirement per
 * stack-conventions), while keeping opacity cross-fades. E2e tests emulate
 * `prefers-reduced-motion: reduce` so card/page transitions don't race the
 * test runner's clicks.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
