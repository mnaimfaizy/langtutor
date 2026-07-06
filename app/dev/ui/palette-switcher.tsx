"use client";

import { useState } from "react";
import type { PaletteName } from "@/lib/theme";
import { Button } from "@/ui";

const PALETTES: { name: PaletteName; label: string }[] = [
  { name: "adult-light", label: "Adult · Light" },
  { name: "adult-dark", label: "Adult · Dark" },
  { name: "kid-bright", label: "Kid · Bright" },
  { name: "kid-dark", label: "Kid · Dark" },
];

/**
 * Dev-only control that flips the root `data-palette` attribute so the whole page
 * (gallery included) re-renders live under each of the four palette token sets.
 */
export function PaletteSwitcher() {
  // Deterministic initial value (matches the no-JS/SSR fallback in globals.css) avoids a
  // hydration mismatch; the highlighted button syncs to the real palette on first click.
  const [active, setActive] = useState<PaletteName>("adult-light");

  function select(name: PaletteName) {
    document.documentElement.setAttribute("data-palette", name);
    setActive(name);
  }

  return (
    <div
      data-testid="palette-switcher"
      className="border-border bg-card sticky top-0 z-10 -mx-6 mb-10 flex flex-wrap items-center gap-2 border-b px-6 py-3"
    >
      <span className="text-muted mr-2 text-xs font-semibold tracking-wide uppercase">Palette</span>
      {PALETTES.map(({ name, label }) => (
        <Button
          key={name}
          data-testid={`palette-switcher-${name}`}
          variant={active === name ? "primary" : "secondary"}
          size="sm"
          onClick={() => select(name)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
