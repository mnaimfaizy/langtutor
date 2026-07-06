"use client";

import * as React from "react";
import { Avatar as BaseAvatar } from "@base-ui/react/avatar";
import { cn } from "./cn";

export type AvatarSize = "sm" | "md" | "lg";

const sizes: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

export type AvatarProps = Omit<React.ComponentProps<typeof BaseAvatar.Root>, "className"> & {
  className?: string;
  size?: AvatarSize;
  src?: string;
  alt?: string;
  /** Shown while the image loads/fails, or whenever no `src` is given (e.g. initials). */
  fallback: React.ReactNode;
};

/** User or mascot placeholder. Falls back to initials/an icon when no image is available. */
export function Avatar({ className, size = "md", src, alt = "", fallback, ...props }: AvatarProps) {
  return (
    <BaseAvatar.Root
      className={cn(
        "border-border bg-surface-2 text-foreground relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border font-medium",
        sizes[size],
        className,
      )}
      {...props}
    >
      {src ? <BaseAvatar.Image src={src} alt={alt} className="h-full w-full object-cover" /> : null}
      <BaseAvatar.Fallback className="flex h-full w-full items-center justify-center">
        {fallback}
      </BaseAvatar.Fallback>
    </BaseAvatar.Root>
  );
}
