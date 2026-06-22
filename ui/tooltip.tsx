"use client";

import * as React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { cn } from "./cn";

export type TooltipProps = {
  /** The element that triggers the tooltip (e.g. a Button). */
  children: React.ReactElement;
  /** Tooltip body content. */
  content: React.ReactNode;
  className?: string;
  sideOffset?: number;
};

export function Tooltip({ children, content, className, sideOffset = 8 }: TooltipProps) {
  return (
    <BaseTooltip.Provider>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger render={children} />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner sideOffset={sideOffset}>
            <BaseTooltip.Popup
              className={cn(
                "border-border bg-card text-foreground rounded-md border px-2 py-1 text-xs shadow-md",
                className,
              )}
            >
              {content}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
}
