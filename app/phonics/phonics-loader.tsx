"use client";

import dynamic from "next/dynamic";

import { Card } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

function PhonicsSkeleton() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg space-y-4">
        <Skeleton className="h-2 w-full" />
        <Card className="rounded-2xl p-10">
          <Skeleton className="mx-auto h-10 w-40" />
          <div className="mt-8 grid grid-cols-2 gap-3">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        </Card>
      </div>
    </div>
  );
}

export const PhonicsSessionLazy = dynamic(
  () => import("./phonics-session").then((m) => ({ default: m.PhonicsSession })),
  { ssr: false, loading: PhonicsSkeleton },
);
