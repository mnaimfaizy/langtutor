"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import type { Achievement, CollectibleGrant } from "@/lib/db";
import { buildCollectionCatalogue, resolveCollectionEarned } from "@/lib/gamification/collection";
import { getContentRepository } from "@/lib/registry";
import { CollectibleCard } from "@/ui";

export function CollectionScreen() {
  const pathname = usePathname();
  const [grants, setGrants] = useState<CollectibleGrant[] | null>(null);
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);

  useEffect(() => {
    if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/sign-up"))
      return;

    let active = true;
    const repo = getContentRepository();

    void (async () => {
      const [collectibles, gamification] = await Promise.all([
        repo.getCollectibles(),
        repo.getGamification(),
      ]);
      if (!active) return;
      setGrants(collectibles);
      setAchievements(gamification?.achievements ?? []);
    })();

    return () => {
      active = false;
    };
  }, [pathname]);

  const catalogue = useMemo(() => buildCollectionCatalogue(), []);
  const earnedById = useMemo(
    () => resolveCollectionEarned(grants ?? [], achievements ?? []),
    [grants, achievements],
  );

  if (grants === null || achievements === null) {
    return (
      <p className="text-muted text-sm" data-testid="collection-loading">
        Loading your collection…
      </p>
    );
  }

  const creatures = catalogue.filter((item) => item.kind === "creature");
  const badges = catalogue.filter((item) => item.kind === "achievement");
  const earnedCount = catalogue.filter((item) => earnedById.get(item.id)?.earned).length;

  return (
    <div data-testid="collection-screen">
      <p className="text-muted text-sm tabular-nums" data-testid="collection-progress">
        {earnedCount} of {catalogue.length} collected
      </p>

      <section className="mt-8" data-testid="collection-creatures">
        <h2 className="text-foreground mb-3 text-lg font-semibold tracking-tight">Creatures</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {creatures.map((item) => {
            const state = earnedById.get(item.id);
            return (
              <li key={item.id}>
                <CollectibleCard
                  id={item.id}
                  icon={item.icon}
                  label={item.label}
                  description={item.description}
                  imageSrc={item.imageSrc}
                  earned={state?.earned ?? false}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10" data-testid="collection-achievements">
        <h2 className="text-foreground mb-3 text-lg font-semibold tracking-tight">Achievements</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {badges.map((item) => {
            const state = earnedById.get(item.id);
            return (
              <li key={item.id}>
                <CollectibleCard
                  id={item.id}
                  icon={item.icon}
                  label={item.label}
                  description={item.description}
                  earned={state?.earned ?? false}
                />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
