"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/ui/skeleton";

function ReviewSkeleton() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-4">
        <Skeleton className="h-2 w-full" />
        <div className="border-border rounded-2xl border p-8">
          <Skeleton className="mx-auto h-8 w-32" />
          <Skeleton className="mt-8 h-10 w-full" />
        </div>
      </div>
    </div>
  );
}

export const ReviewSessionLazy = dynamic(
  () => import("./review-session").then((m) => ({ default: m.ReviewSession })),
  { ssr: false, loading: ReviewSkeleton },
);
