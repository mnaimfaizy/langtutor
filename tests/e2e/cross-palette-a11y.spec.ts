/**
 * Issue #51 (UI/UX revamp slice 10) — cross-palette accessibility sweep. Complements
 * cross-palette-smoke.spec.ts (landmark checks in adult-dark/kid-bright) with the
 * remaining Definition-of-Done checks for PRD #36: token-pair contrast in all four
 * palettes, calm variants under `prefers-reduced-motion`, and visible keyboard focus.
 */
import { expect, test } from "@playwright/test";

import { contrastRatio, meetsWcagAa } from "../../lib/theme/contrast";
import type { Rgb } from "../../lib/theme/contrast";

const ALL_PALETTES = ["adult-light", "adult-dark", "kid-bright", "kid-dark"] as const;

const SMOKE_PALETTES = [
  { name: "adult-dark" as const, mode: "adult" as const, colorScheme: "dark" as const },
  { name: "kid-bright" as const, mode: "kid" as const, colorScheme: "light" as const },
];

function hexToRgb(hex: string): Rgb {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

test.describe("cross-palette contrast: token-critical pairs", () => {
  test("text/background and accent/accent-foreground meet WCAG AA in every palette", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Lang-Tutor", level: 1 })).toBeVisible();

    for (const palette of ALL_PALETTES) {
      // Read the raw --background/--foreground/--accent/--accent-foreground custom
      // properties for each palette directly off document.documentElement. This checks
      // the token definitions themselves (app/globals.css), independent of whether any
      // particular component happens to render a solid accent/accent-foreground pair on
      // the current page.
      const tokens = await page.evaluate((paletteName) => {
        document.documentElement.setAttribute("data-palette", paletteName);
        const style = getComputedStyle(document.documentElement);
        const read = (name: string) => style.getPropertyValue(name).trim();
        return {
          background: read("--background"),
          foreground: read("--foreground"),
          accent: read("--accent"),
          accentForeground: read("--accent-foreground"),
        };
      }, palette);

      const textRatio = contrastRatio(hexToRgb(tokens.foreground), hexToRgb(tokens.background));
      expect(textRatio, `text/background contrast for ${palette}`).toBeGreaterThanOrEqual(4.5);
      expect(meetsWcagAa(hexToRgb(tokens.foreground), hexToRgb(tokens.background))).toBe(true);

      const accentRatio = contrastRatio(hexToRgb(tokens.accentForeground), hexToRgb(tokens.accent));
      expect(
        accentRatio,
        `accent/accent-foreground contrast for ${palette}`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(meetsWcagAa(hexToRgb(tokens.accentForeground), hexToRgb(tokens.accent))).toBe(true);
    }
  });
});

test.describe("cross-palette motion: reduced-motion swaps in calm variants", () => {
  test("skeleton shimmer becomes a calm pulse under prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/dev/ui");
    await expect(page.getByRole("heading", { name: "UI gallery", level: 1 })).toBeVisible();

    const skeleton = page
      .locator("section", { hasText: "Skeleton" })
      .locator("div.flex > div")
      .first();
    await expect(skeleton).toBeVisible();
    await expect(skeleton).toHaveCSS("animation-name", "shimmer");

    // Same element, same page — only the OS-level motion preference changes. The
    // motion-safe:/motion-reduce: Tailwind variants (ui/skeleton.tsx) should swap which
    // keyframe applies without any JS re-render.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(skeleton).toHaveCSS("animation-name", "pulse");
  });
});

test.describe("cross-palette focus: keyboard focus stays visible", () => {
  for (const palette of SMOKE_PALETTES) {
    test(`${palette.name}: tabbing through the home page keeps a visible focus ring`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: palette.colorScheme });
      await page.goto("/settings");
      await page.getByTestId(`experience-mode-btn-${palette.mode}`).click();
      await page.getByTestId("btn-save-experience-mode").click();
      await expect(page.getByRole("status")).toHaveText("Appearance saved.");

      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
      await expect(page.getByRole("heading", { name: "Lang-Tutor", level: 1 })).toBeVisible();

      let sawFocusableElement = false;
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");

        const focusState = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const style = getComputedStyle(el);
          return {
            matchesFocusVisible: el.matches(":focus-visible"),
            boxShadow: style.boxShadow,
            outlineStyle: style.outlineStyle,
          };
        });
        if (!focusState) continue;
        sawFocusableElement = true;

        // focus-visible:ring-* (button-styles.ts / select-pill.tsx) renders the ring via
        // box-shadow, not the native outline — so a real ring is present whenever the
        // box-shadow is non-default, regardless of outline-style.
        const hasVisibleRing =
          focusState.boxShadow !== "none" || focusState.outlineStyle !== "none";
        expect(focusState.matchesFocusVisible, `element ${i} should be :focus-visible`).toBe(true);
        expect(hasVisibleRing, `element ${i} should render a visible focus ring`).toBe(true);
      }

      expect(sawFocusableElement).toBe(true);
    });
  }
});
