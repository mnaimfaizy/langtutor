import type { ColorScheme, ExperienceMode, PaletteName } from "./types";

const PALETTE_BY_MODE: Record<ExperienceMode, Record<ColorScheme, PaletteName>> = {
  adult: { light: "adult-light", dark: "adult-dark" },
  kid: { light: "kid-bright", dark: "kid-dark" },
};

/** Maps experience mode + light/dark preference to a root `data-palette` value. */
export function resolvePalette(mode: ExperienceMode, scheme: ColorScheme): PaletteName {
  return PALETTE_BY_MODE[mode][scheme];
}
