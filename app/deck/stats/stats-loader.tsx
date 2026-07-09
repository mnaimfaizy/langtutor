"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/ui/skeleton";

/** Serializable card row passed from the server component. */
export interface StatsCardItem {
  dueIso: string;
  lastReviewIso?: string;
  suspended?: boolean;
}

function StatsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6 sm:py-10">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export const StatsClientLazy = dynamic(
  () => import("./stats-client").then((m) => ({ default: m.StatsClient })),
  { ssr: false, loading: StatsSkeleton },
);
