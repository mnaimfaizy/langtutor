"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { resolveMotionPreset } from "@/lib/motion";

/**
 * Wraps the layout's children with a route-keyed entrance preset — gives every
 * page change a short cross-fade instead of an instant jump. Uses `mode="wait"`
 * so the old page fully exits before the new one enters, preventing overlapping
 * content during quick navigations.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion() ?? false;
  const enter = resolveMotionPreset("enter", reducedMotion);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className="flex min-h-full flex-col"
        initial={enter.initial}
        animate={enter.animate}
        exit={enter.exit}
        transition={enter.transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
