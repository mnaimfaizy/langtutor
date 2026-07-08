"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { resolveMotionPreset } from "@/lib/motion";
import type { CollectibleDef } from "@/lib/gamification/collectibles";
import { cn } from "./cn";

const AUTO_DISMISS_MS = 4_000;

export type CollectibleToastProps = {
  collectible: CollectibleDef;
  onDismiss: () => void;
  className?: string;
};

/**
 * Lightweight "you earned X" moment — calm enter/exit, no full-screen treatment (issue #83).
 */
export function CollectibleToast({ collectible, onDismiss, className }: CollectibleToastProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const enter = resolveMotionPreset("enter", reducedMotion);

  React.useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      data-testid="collectible-toast"
      initial={enter.initial}
      animate={enter.animate}
      exit={enter.exit}
      transition={enter.transition}
      className={cn(
        "bg-surface-2 border-border shadow-glow fixed bottom-6 left-1/2 z-50 flex max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl border px-4 py-3",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- bundled static SVG art */}
      <img
        src={collectible.imageSrc}
        alt=""
        width={48}
        height={48}
        className="bg-accent/10 size-12 shrink-0 rounded-lg object-contain p-1"
      />
      <div className="min-w-0">
        <p className="text-foreground text-sm font-semibold">You earned {collectible.label}!</p>
        <p className="text-muted truncate text-xs">{collectible.description}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-muted hover:text-foreground ml-1 shrink-0 text-xs"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </motion.div>
  );
}

export type CollectibleToastHostProps = {
  collectible: CollectibleDef | null;
  onDismiss: () => void;
};

/** AnimatePresence wrapper so toasts can exit smoothly. */
export function CollectibleToastHost({ collectible, onDismiss }: CollectibleToastHostProps) {
  return (
    <AnimatePresence>
      {collectible ? (
        <CollectibleToast key={collectible.id} collectible={collectible} onDismiss={onDismiss} />
      ) : null}
    </AnimatePresence>
  );
}
