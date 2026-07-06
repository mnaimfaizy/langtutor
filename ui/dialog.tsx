"use client";

import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { motion, useReducedMotion } from "framer-motion";
import { resolveMotionPreset } from "@/lib/motion";
import { cn } from "./cn";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./button";

const MotionDialogTrigger = motion.create(BaseDialog.Trigger);
const MotionDialogClose = motion.create(BaseDialog.Close);

export function Dialog(props: React.ComponentProps<typeof BaseDialog.Root>) {
  return <BaseDialog.Root {...props} />;
}

export type DialogTriggerProps = Omit<
  React.ComponentProps<typeof BaseDialog.Trigger>,
  "className"
> & {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function DialogTrigger({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: DialogTriggerProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const press = resolveMotionPreset("press", reducedMotion);
  return (
    <MotionDialogTrigger
      className={buttonClassName({ variant, size, className })}
      whileTap={press.whileTap}
      transition={press.transition}
      {...props}
    />
  );
}

export type DialogContentProps = Omit<
  React.ComponentProps<typeof BaseDialog.Popup>,
  "className"
> & {
  className?: string;
};

export function DialogContent({ className, children, ...props }: DialogContentProps) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 bg-black/40 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <BaseDialog.Popup
        className={cn(
          "border-glass-border bg-glass fixed top-1/2 left-1/2 w-[min(90vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6 shadow-xl backdrop-blur-lg transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          className,
        )}
        {...props}
      >
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

export function DialogTitle({
  className,
  ...props
}: Omit<React.ComponentProps<typeof BaseDialog.Title>, "className"> & { className?: string }) {
  return (
    <BaseDialog.Title
      className={cn("text-foreground text-lg font-semibold", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: Omit<React.ComponentProps<typeof BaseDialog.Description>, "className"> & {
  className?: string;
}) {
  return (
    <BaseDialog.Description
      className={cn("text-muted mt-2 text-sm leading-6", className)}
      {...props}
    />
  );
}

export type DialogCloseProps = Omit<React.ComponentProps<typeof BaseDialog.Close>, "className"> & {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function DialogClose({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: DialogCloseProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const press = resolveMotionPreset("press", reducedMotion);
  return (
    <MotionDialogClose
      className={buttonClassName({ variant, size, className })}
      whileTap={press.whileTap}
      transition={press.transition}
      {...props}
    />
  );
}
