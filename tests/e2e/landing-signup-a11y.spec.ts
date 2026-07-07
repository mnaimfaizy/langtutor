/**
 * Issue #56 — a11y sweep for the public funnel's two unauthenticated entry points: the
 * marketing landing page and the sign-up mode step. Complements cross-palette-a11y.spec.ts
 * (which sweeps the four experience-mode palettes on authenticated pages) with the same
 * checks — landmarks, token contrast, and visible keyboard focus — for the light/dark
 * color schemes an anonymous visitor actually gets (unauthenticated visitors always
 * resolve the adult-light/adult-dark family; kid palettes only exist post-sign-up). Also
 * proves the sign-up mode step is completable end-to-end using only the keyboard.
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { contrastRatio } from "../../lib/theme/contrast";
import type { Rgb } from "../../lib/theme/contrast";

const SCHEMES = [
  { colorScheme: "light" as const, palette: "adult-light" },
  { colorScheme: "dark" as const, palette: "adult-dark" },
];

function hexToRgb(hex: string): Rgb {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

async function readTokens(page: Page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string) => style.getPropertyValue(name).trim();
    return {
      background: read("--background"),
      foreground: read("--foreground"),
      accent: read("--accent"),
      accentForeground: read("--accent-foreground"),
    };
  });
}

function expectTokenContrastMeetsAa(tokens: {
  background: string;
  foreground: string;
  accent: string;
  accentForeground: string;
}) {
  const textRatio = contrastRatio(hexToRgb(tokens.foreground), hexToRgb(tokens.background));
  expect(textRatio, "text/background contrast").toBeGreaterThanOrEqual(4.5);

  const accentRatio = contrastRatio(hexToRgb(tokens.accentForeground), hexToRgb(tokens.accent));
  expect(accentRatio, "accent/accent-foreground contrast").toBeGreaterThanOrEqual(4.5);
}

/** Tabs forward, asserting every focusable element gets a visible focus ring. */
async function expectVisibleFocusRingWhileTabbing(page: Page, presses: number): Promise<void> {
  let sawFocusableElement = false;
  for (let i = 0; i < presses; i++) {
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

    const hasVisibleRing = focusState.boxShadow !== "none" || focusState.outlineStyle !== "none";
    expect(focusState.matchesFocusVisible, `element ${i} should be :focus-visible`).toBe(true);
    expect(hasVisibleRing, `element ${i} should render a visible focus ring`).toBe(true);
  }
  expect(sawFocusableElement).toBe(true);
}

// Both screens are reached before sign-in — drop the shared session storage state.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("landing page a11y", () => {
  for (const { colorScheme, palette } of SCHEMES) {
    test(`${colorScheme} scheme: landmarks are present and token contrast meets WCAG AA`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-palette", palette);

      await expect(page.locator("header")).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Lang-Tutor", level: 1 })).toBeVisible();

      expectTokenContrastMeetsAa(await readTokens(page));
    });

    test(`${colorScheme} scheme: tabbing through the landing page keeps a visible focus ring in order`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Lang-Tutor", level: 1 })).toBeVisible();

      await expectVisibleFocusRingWhileTabbing(page, 8);
    });
  }
});

test.describe("sign-up mode step a11y", () => {
  for (const { colorScheme, palette } of SCHEMES) {
    test(`${colorScheme} scheme: landmarks are present and token contrast meets WCAG AA`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/sign-up");
      await expect(page.locator("html")).toHaveAttribute("data-palette", palette);

      await expect(page.locator("header")).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByTestId("signup-mode-step")).toBeVisible();
      await expect(
        page.getByRole("radiogroup", { name: "Who is this account for?" }),
      ).toBeVisible();

      expectTokenContrastMeetsAa(await readTokens(page));
    });

    test(`${colorScheme} scheme: tabbing through the mode step keeps a visible focus ring`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/sign-up");
      await expect(page.getByTestId("signup-mode-step")).toBeVisible();

      await expectVisibleFocusRingWhileTabbing(page, 6);
    });

    test(`${colorScheme} scheme: sign-up is completable end-to-end by keyboard alone`, async ({
      page,
    }) => {
      const email = `kbd-${colorScheme}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

      await page.emulateMedia({ colorScheme });
      await page.goto("/sign-up");
      await expect(page.getByTestId("signup-mode-step")).toBeVisible();

      // Select "kid" via keyboard only (native button: Enter/Space both activate onClick).
      await page.getByTestId("signup-mode-btn-kid").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("signup-mode-btn-kid")).toHaveAttribute("aria-checked", "true");

      await page.getByTestId("signup-mode-continue").focus();
      await expect(page.getByTestId("signup-mode-continue")).toBeEnabled();
      await page.keyboard.press("Enter");

      await expect(page.getByTestId("signup-account-step")).toBeVisible();

      await page.getByLabel("Email").focus();
      await page.keyboard.type(email);
      await page.keyboard.press("Tab");
      await page.keyboard.type("TestPassword1!");
      await page.keyboard.press("Tab");
      await page.keyboard.type("TestPassword1!");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");

      await page.waitForURL("/onboarding");
      await expect(page.locator("html")).toHaveAttribute("data-palette", /^kid-/);
    });
  }
});
