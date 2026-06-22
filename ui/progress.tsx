"use client";

import * as React from "react";
import { Progress as BaseProgress } from "@base-ui/react/progress";
import { cn } from "./cn";

export type ProgressProps = Omit<React.ComponentProps<typeof BaseProgress.Root>, "className"> & {
  className?: string;
  trackClassName?: string;
  indicatorClassName?: string;
};

export function Progress({
  className,
  trackClassName,
  indicatorClassName,
  ...props
}: ProgressProps) {
  return (
    <BaseProgress.Root className={cn("w-full", className)} {...props}>
      <BaseProgress.Track
        className={cn("bg-foreground/10 h-2 w-full overflow-hidden rounded-full", trackClassName)}
      >
        <BaseProgress.Indicator
          className={cn("bg-accent h-full rounded-full transition-all", indicatorClassName)}
        />
      </BaseProgress.Track>
    </BaseProgress.Root>
  );
}
