import { cn } from "./cn";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "from-surface-2 via-surface-3 to-surface-2 rounded-md bg-gradient-to-r bg-[length:200%_100%] motion-safe:animate-[shimmer_1.8s_ease-in-out_infinite] motion-reduce:animate-pulse",
        className,
      )}
      aria-hidden="true"
    />
  );
}
