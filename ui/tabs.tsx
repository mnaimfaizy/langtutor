"use client";

import * as React from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { motion, useReducedMotion } from "framer-motion";
import { resolveMotionPreset } from "@/lib/motion";
import { cn } from "./cn";

const MotionTabsTab = motion.create(BaseTabs.Tab);

export function Tabs({
  className,
  ...props
}: Omit<React.ComponentProps<typeof BaseTabs.Root>, "className"> & { className?: string }) {
  return <BaseTabs.Root className={cn("w-full", className)} {...props} />;
}

export function TabsList({
  className,
  ...props
}: Omit<React.ComponentProps<typeof BaseTabs.List>, "className"> & { className?: string }) {
  return (
    <BaseTabs.List
      className={cn(
        "border-border bg-card inline-flex items-center gap-1 rounded-lg border p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTab({
  className,
  ...props
}: Omit<React.ComponentProps<typeof BaseTabs.Tab>, "className"> & { className?: string }) {
  const reducedMotion = useReducedMotion() ?? false;
  const press = resolveMotionPreset("press", reducedMotion);
  return (
    <MotionTabsTab
      className={cn(
        "text-muted hover:text-foreground data-[selected]:bg-accent data-[selected]:text-accent-foreground data-[selected]:shadow-glow cursor-default rounded-md px-3 py-1.5 text-sm font-medium transition-[colors,box-shadow]",
        className,
      )}
      whileTap={press.whileTap}
      transition={press.transition}
      {...props}
    />
  );
}

export function TabsPanel({
  className,
  ...props
}: Omit<React.ComponentProps<typeof BaseTabs.Panel>, "className"> & { className?: string }) {
  return <BaseTabs.Panel className={cn("text-foreground mt-4 text-sm", className)} {...props} />;
}
