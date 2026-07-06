import * as React from "react";
import { cn } from "./cn";

// Hand-built: Base UI has no Stat primitive. Pure presentational; safe as a Server Component.

export type StatSize = "sm" | "md" | "lg";

const valueSizes: Record<StatSize, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
};

export type StatProps = React.ComponentProps<"div"> & {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Decorative leading icon/emoji — hidden from assistive tech. */
  icon?: React.ReactNode;
  size?: StatSize;
  valueClassName?: string;
  labelClassName?: string;
};

/** A designed number + label pairing — the building block for future HUD stats. */
export function Stat({
  label,
  value,
  icon,
  size = "md",
  className,
  valueClassName,
  labelClassName,
  ...props
}: StatProps) {
  return (
    <div className={cn("flex items-center gap-3", className)} {...props}>
      {icon ? (
        <span className="text-accent shrink-0" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div>
        <p
          className={cn(
            "text-foreground font-semibold tracking-tight tabular-nums",
            valueSizes[size],
            valueClassName,
          )}
        >
          {value}
        </p>
        <p className={cn("text-muted text-xs font-medium tracking-wide uppercase", labelClassName)}>
          {label}
        </p>
      </div>
    </div>
  );
}
