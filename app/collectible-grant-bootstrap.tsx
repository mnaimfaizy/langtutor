"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import type { CollectibleDef } from "@/lib/gamification/collectibles";
import { grantCollectibleForUnit } from "@/lib/gamification/collectibles";
import { onUnitCompleted } from "@/lib/path/unit-events";
import { getContentRepository } from "@/lib/registry";
import { CollectibleToastHost } from "@/ui/collectible-toast";

/**
 * Subscribes to unit-completion events and grants the matching collectible idempotently.
 * Surfaces a lightweight toast when a new grant lands (issue #83).
 */
export function CollectibleGrantBootstrap() {
  const pathname = usePathname();
  const [toast, setToast] = useState<CollectibleDef | null>(null);
  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/sign-up")) {
      return;
    }

    const repo = getContentRepository();
    const unsubscribe = onUnitCompleted((event) => {
      void grantCollectibleForUnit(repo, event.unitId, event.unitIndex, event.completedAt).then(
        (def) => {
          if (def) setToast(def);
        },
      );
    });

    return unsubscribe;
  }, [pathname]);

  return <CollectibleToastHost collectible={toast} onDismiss={dismiss} />;
}
