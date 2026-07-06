export type { ExperienceMode } from "@/lib/db/schema";
export { DEFAULT_EXPERIENCE_MODE } from "@/lib/db/schema";

export type ColorScheme = "light" | "dark";

/** Root `data-palette` values — four families from ADR 0017 / PRD #36. */
export type PaletteName = "adult-light" | "adult-dark" | "kid-bright" | "kid-dark";
