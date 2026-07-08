"use client";

import { useEffect } from "react";

import { getContentRepository } from "@/lib/registry";

import { playCelebrationSound, type CelebrationSoundKind } from "./celebration-sounds";

/**
 * Plays a bundled celebration sound on mount when the learner has not muted sounds.
 * Reads the per-profile preference from IndexedDB via the content repository.
 */
export function useCelebrationSoundOnMount(kind: CelebrationSoundKind): void {
  useEffect(() => {
    let active = true;
    void getContentRepository()
      .getSettings()
      .then((settings) => {
        if (!active || settings.soundMuted) return;
        playCelebrationSound(kind);
      });
    return () => {
      active = false;
    };
  }, [kind]);
}
