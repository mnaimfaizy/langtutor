import { cn } from "./cn";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("bg-foreground/8 animate-pulse rounded-md", className)} aria-hidden="true" />
  );
}
