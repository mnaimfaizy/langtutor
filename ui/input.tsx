"use client";

import * as React from "react";
import { Input as BaseInput } from "@base-ui/react/input";
import { cn } from "./cn";

export type InputProps = Omit<React.ComponentProps<typeof BaseInput>, "className"> & {
  className?: string;
};

export function Input({ className, ...props }: InputProps) {
  return (
    <BaseInput
      className={cn(
        "border-border bg-card text-foreground placeholder:text-muted focus-visible:border-accent focus-visible:ring-accent focus-visible:ring-offset-background focus-visible:shadow-glow h-10 w-full rounded-lg border px-3 text-sm transition-[colors,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
