"use client";

import * as React from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { motion, useReducedMotion } from "framer-motion";
import { resolveMotionPreset } from "@/lib/motion";
import { cn } from "./cn";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./button";

const MotionPopoverTrigger = motion.create(BasePopover.Trigger);

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
  const reducedMotion = useReducedMotion() ?? false;
  const press = resolveMotionPreset("press", reducedMotion);
  return (
    <MotionPopoverTrigger
      className={buttonClassName({ variant, size, className })}
      whileTap={press.whileTap}
      transition={press.transition}
      {...props}
    />
  );
}

export type PopoverInlineTriggerProps = Omit<
  React.ComponentProps<typeof BasePopover.Trigger>,
  "className"
> & { className?: string };

/** Inline word-style trigger — no button chrome, highlights on hover. */
export function PopoverInlineTrigger({ className, ...props }: PopoverInlineTriggerProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const press = resolveMotionPreset("press", reducedMotion);
  return (
    <MotionPopoverTrigger
      className={cn(
        "hover:text-accent focus-visible:ring-accent focus-visible:shadow-glow cursor-pointer rounded-sm px-0.5 transition-[colors,box-shadow] focus-visible:ring-1 focus-visible:outline-none",
        className,
      )}
      whileTap={press.whileTap}
      transition={press.transition}
      {...props}
    />
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
            "border-glass-border bg-glass text-foreground w-64 rounded-xl border p-4 text-sm shadow-lg backdrop-blur-lg transition-all duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
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
