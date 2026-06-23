"use client";

import { useEffect, useState } from "react";

import { getContentRepository } from "@/lib/registry";
import { loadSeedIfEmpty } from "@/lib/content/seed";

interface SeedStatus {
  passages: number;
  cards: number;
}

/**
 * Loads the starter seed into IndexedDB on first run (Phase 1.8).
 * Renders nothing until the seed is ready, then shows a minimal offline-ready
 * indicator. The `data-testid="seed-ready"` attribute is used by the e2e suite.
 */
export function SeedBootstrap() {
  const [status, setStatus] = useState<SeedStatus | null>(null);

  useEffect(() => {
    let active = true;
    const repo = getContentRepository();

    void loadSeedIfEmpty(repo)
      .then(async () => {
        if (!active) return;
        const [passages, cards] = await Promise.all([
          repo.queryContent({ source: "seed" }),
          repo.getAllCards(),
        ]);
        setStatus({ passages: passages.length, cards: cards.length });
      })
      .catch(() => {
        // IndexedDB unavailable (SSR edge case) — fail silently.
      });

    return () => {
      active = false;
    };
  }, []);

  if (!status) return null;

  return (
    <div
      data-testid="seed-ready"
      className="border-border/50 bg-success/5 text-success border-b px-6 py-1.5 text-center text-xs"
    >
      {status.passages} passages · {status.cards} cards ready offline
    </div>
  );
}
