import * as React from "react";
import { cn } from "./cn";

// Hand-built: Base UI has no Card primitive. Pure presentational; safe as a Server Component.

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("border-border bg-card rounded-xl border p-5 shadow-sm", className)}
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
