import * as React from "react";
import { cn } from "./cn";

// Hand-built: Base UI has no Card primitive. Pure presentational; safe as a Server Component.

export type CardVariant = "surface" | "glass";

const cardVariants: Record<CardVariant, string> = {
  surface: "border-border bg-card",
  glass: "border-glass-border bg-glass backdrop-blur-lg",
};

export type CardProps = React.ComponentProps<"div"> & { variant?: CardVariant };

export function Card({ className, variant = "surface", ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-xl border p-5 shadow-sm", cardVariants[variant], className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-foreground text-sm font-semibold", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-muted mt-1 text-sm leading-6", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-4", className)} {...props} />;
}
