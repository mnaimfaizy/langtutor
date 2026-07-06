import { resolvePalette } from "./resolve-palette";
import type { ExperienceMode } from "./types";

/**
 * Sets the root `data-palette` attribute for `mode`, honoring the current system
 * light/dark preference. Client-only (reads `window`/`document`) — call it from event
 * handlers or effects, e.g. so a Settings toggle switches the palette live.
 */
export function applyPalette(mode: ExperienceMode): void {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute(
    "data-palette",
    resolvePalette(mode, dark ? "dark" : "light"),
  );
}
