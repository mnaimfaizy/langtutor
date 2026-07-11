"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { ensurePath } from "@/lib/path/seed";
import { shouldShowKidIsland } from "@/lib/path/pre-a1";
import { getContentRepository } from "@/lib/registry";
import { Skeleton } from "@/ui";
import { KidIslandHome } from "./island";

type Decision = "loading" | "kid-island" | "standard";

/**
 * Kid-only Pre-A1 home gate (ADR 0016). Renders the illustrated island trail while a kid-mode
 * learner is still in the pre-A1 tier; hands off to the standard path home (`children`) the
 * moment `shouldShowKidIsland` says the learner reached unit 0 — same unlock state machine the
 * rest of the path already uses, so there's nothing extra to keep in sync between the two UIs.
 */
export function KidPreA1Gate({ children }: { children: ReactNode }) {
  const [decision, setDecision] = useState<Decision>("loading");

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const repo = getContentRepository();
        const profile = await repo.getProfile();
        if (!profile || profile.experienceMode !== "kid") {
          if (active) setDecision("standard");
          return;
        }

        await ensurePath(repo, {
          cefrLevel: profile.cefrLevel,
          goals: profile.goals ?? [],
          createdAt: profile.createdAt ?? new Date(),
          settings: profile.settings ?? {},
          experienceMode: profile.experienceMode,
        });
        const units = await repo.getUnits();
        if (active) setDecision(shouldShowKidIsland(profile, units) ? "kid-island" : "standard");
      } catch {
        // If the profile/path can't be loaded, fall back to the standard home rather than
        // getting stuck on a loading skeleton.
        if (active) setDecision("standard");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (decision === "loading") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full max-w-md" />
      </main>
    );
  }

  if (decision === "kid-island") return <KidIslandHome />;
  return <>{children}</>;
}
