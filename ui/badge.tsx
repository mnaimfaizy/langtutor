import * as React from "react";
import { cn } from "./cn";

// Hand-built: Base UI has no Badge primitive. Pure presentational; safe as a Server Component.

export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger" | "gradient";
export type BadgeSize = "sm" | "md";

const variants: Record<BadgeVariant, string> = {
  neutral: "border-border bg-foreground/[0.06] text-foreground",
  accent: "border-accent/30 bg-accent/15 text-accent",
  success: "border-success/30 bg-success/15 text-success",
  warning: "border-warning/30 bg-warning/15 text-warning",
  danger: "border-danger/30 bg-danger/15 text-danger",
  gradient:
    "from-gradient-from via-gradient-via to-gradient-to text-gradient-foreground border-transparent bg-gradient-to-r shadow-glow",
};

const sizes: Record<BadgeSize, string> = {
  sm: "h-5 px-2 text-[11px]",
  md: "h-6 px-2.5 text-xs",
};

export type BadgeProps = React.ComponentProps<"span"> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
};

export function Badge({ variant = "neutral", size = "md", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-full border font-medium whitespace-nowrap",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
