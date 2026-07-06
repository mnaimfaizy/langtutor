import type { Cefr } from "@/lib/db";

/** Structurally compatible with `ui/badge`'s `BadgeVariant` without importing it (lib/ stays UI-free). */
export const CEFR_BADGE_VARIANT: Record<Cefr, "success" | "warning" | "danger"> = {
  A1: "success",
  A2: "success",
  B1: "warning",
  B2: "warning",
  C1: "danger",
  C2: "danger",
};
