import Link from "next/link";
import type { ComponentProps } from "react";

import { buttonClassName } from "./button-styles";
import { cn } from "./cn";

// Hand-built: a ghost-button `<Link>` with a leading chevron, used at the top of every
// module detail page to return to the module's picker/library. Pure presentational and
// Server-Component safe (no "use client" — Button's motion wrapper isn't needed here).

export type BackLinkProps = ComponentProps<typeof Link> & { label: string };

export function BackLink({ label, className, ...props }: BackLinkProps) {
  return (
    <Link
      {...props}
      className={cn(
        buttonClassName({ variant: "ghost", size: "sm", className: "-ml-2.5 gap-1.5" }),
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
        aria-hidden
      >
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
      {label}
    </Link>
  );
}
