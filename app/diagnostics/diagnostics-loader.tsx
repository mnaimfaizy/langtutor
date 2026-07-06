"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/ui/skeleton";

function DiagnosticsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6 sm:py-10">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export const DiagnosticsClientLazy = dynamic(
  () => import("./diagnostics-client").then((m) => ({ default: m.DiagnosticsClient })),
  { ssr: false, loading: DiagnosticsSkeleton },
);
