import { cn } from "./cn";

// Pure class-string logic — deliberately NOT "use client" so Server Components (e.g. the
// site header, home hub) can call `buttonClassName()` directly to style a `<Link>` as a
// button without pulling in the interactive `<Button>` component (framer-motion, hooks).

export type ButtonVariant = "primary" | "secondary" | "ghost" | "gradient";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex cursor-default items-center justify-center gap-2 rounded-lg font-medium transition-[colors,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:shadow-glow disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:opacity-90 hover:shadow-glow",
  secondary: "border border-border bg-card text-foreground hover:bg-foreground/[0.04]",
  ghost: "text-foreground hover:bg-foreground/[0.06]",
  gradient:
    "from-gradient-from via-gradient-via to-gradient-to text-gradient-foreground bg-gradient-to-br hover:shadow-glow",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-base",
};

/** Shared class string for the button look — reused by trigger wrappers (Dialog/Popover)
 * and by Server Components that style a `<Link>` as a button (nav/CTA rows). */
export function buttonClassName(
  opts: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {},
): string {
  const { variant = "primary", size = "md", className } = opts;
  return cn(base, variants[variant], sizes[size], className);
}
