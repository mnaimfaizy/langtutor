"use client";

import * as React from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { cn } from "./cn";

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
  return (
    <BaseTabs.Tab
      className={cn(
        "text-muted hover:text-foreground data-[selected]:bg-accent data-[selected]:text-accent-foreground cursor-default rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        className,
      )}
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
