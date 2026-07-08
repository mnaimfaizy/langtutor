"use client";

import dynamic from "next/dynamic";

import { Card } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

function AlphabetSkeleton() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg space-y-4">
        <Skeleton className="h-2 w-full" />
        <Card className="rounded-2xl p-10">
          <Skeleton className="mx-auto h-24 w-24" />
          <Skeleton className="mx-auto mt-8 size-48 rounded-xl" />
          <Skeleton className="mx-auto mt-8 h-10 w-40" />
        </Card>
      </div>
    </div>
  );
}

export const AlphabetSessionLazy = dynamic(
  () => import("./alphabet-session").then((m) => ({ default: m.AlphabetSession })),
  { ssr: false, loading: AlphabetSkeleton },
);
