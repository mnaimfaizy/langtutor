"use client";

import * as React from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { cn } from "./cn";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./button";

export function Popover(props: React.ComponentProps<typeof BasePopover.Root>) {
  return <BasePopover.Root {...props} />;
}

export type PopoverTriggerProps = Omit<
  React.ComponentProps<typeof BasePopover.Trigger>,
  "className"
> & {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function PopoverTrigger({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: PopoverTriggerProps) {
  return (
    <BasePopover.Trigger className={buttonClassName({ variant, size, className })} {...props} />
  );
}

export type PopoverContentProps = Omit<
  React.ComponentProps<typeof BasePopover.Popup>,
  "className"
> & {
  className?: string;
  sideOffset?: number;
};

export function PopoverContent({
  className,
  children,
  sideOffset = 8,
  ...props
}: PopoverContentProps) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner sideOffset={sideOffset}>
        <BasePopover.Popup
          className={cn(
            "border-border bg-card text-foreground w-64 rounded-xl border p-4 text-sm shadow-lg transition-all duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}
