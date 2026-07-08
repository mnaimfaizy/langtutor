import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

// Issue #64 — QA gate: mode/palette sweep for the guided path's own screens (the journey/home,
// the unit player, and the offline graceful-pause state) across all four palettes (kid/adult ×
// light/dark). Complements tests/e2e/cross-palette-smoke.spec.ts (module-hub landmark sweep) and
// tests/e2e/cross-palette-a11y.spec.ts (token contrast + generic focus check) — neither visits
// the path/home or unit-player routes. Token contrast itself is not re-checked here: the
// --background/--foreground/--accent tokens cross-palette-a11y.spec.ts asserts against
// document.documentElement are the same tokens every screen in this app renders through, so that
// generic check already covers these screens too. This spec adds what's specific to the path:
// its own landmarks, its kid/adult heading register, and that keyboard focus stays visible in
// each of the three states, in all four palettes.
const BATCH_SIZE = 6; // WORDS_PER_BATCH (5) + 1 pseudoword — see onboarding.spec.ts

interface Palette {
  name: "adult-light" | "adult-dark" | "kid-bright" | "kid-dark";
  mode: "adult" | "kid";
  colorScheme: "light" | "dark";
}

const ALL_PALETTES: Palette[] = [
  { name: "adult-light", mode: "adult", colorScheme: "light" },
  { name: "adult-dark", mode: "adult", colorScheme: "dark" },
  { name: "kid-bright", mode: "kid", colorScheme: "light" },
  { name: "kid-dark", mode: "kid", colorScheme: "dark" },
];

const HEADING_BY_MODE: Record<Palette["mode"], string> = {
  adult: "Your learning path",
  kid: "Your adventure map",
};

test.beforeEach(async ({ request, page }) => {
  test.setTimeout(180_000);
  await request.post("/api/test/reset");
  // The pause state (ADR 0015, issue #61) needs a not-yet-buffered activity to attempt
  // generation against an unreachable provider — mock every generate endpoint to fail the same
  // way the real routes do when the Mac can't be reached (503, matching /api/llm/health's own
  // unreachable status). Prior art: tests/e2e/path-buffer.spec.ts.
  await page.route("**/api/reading/generate", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/writing/generate", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
});

/** Completes onboarding, anchoring the path at A1, and waits for the seed (due cards). */
async function setupWithSeed(page: Page) {
  await page.goto("/onboarding");
  await page.getByTestId("quiz-start-btn").click();
  await expect(page.getByTestId("quiz-quizzing")).toBeVisible();
  for (let i = 0; i < BATCH_SIZE; i++) {
    await page.getByTestId("btn-unknown").click();
  }
  await page.getByTestId("btn-save-level").click();
  await expect(page.getByTestId("goals-picker")).toBeVisible();
  await page.getByTestId("goal-btn-general").click();
  await page.getByTestId("btn-save-goals").click();
  await page.waitForURL("/home");
  await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });
}

/** Rates every due card as "good" until the review session reaches its summary. */
async function rateAllDueCardsGood(page: Page): Promise<void> {
  const summary = page.getByTestId("review-summary");
  const reveal = page.getByTestId("btn-reveal");
  const rateGood = page.getByTestId("btn-rate-good");
  const progress = page.getByTestId("review-progress");

  for (let i = 0; i < 40; i++) {
    if (await summary.isVisible()) return;
    await expect(reveal.or(summary)).toBeVisible({ timeout: 10_000 });
    if (await summary.isVisible()) return;

    const text = (await progress.textContent()) ?? "";
    const [posStr, totalStr] = text.split("/").map((s) => s.trim());
    const isLast = Number(posStr) >= Number(totalStr);

    await reveal.click();
    await expect(rateGood).toBeVisible({ timeout: 10_000 });
    await rateGood.click();

    if (isLast) {
      await expect(summary).toBeVisible({ timeout: 10_000 });
      return;
    }
  }
}

/** Switches the signed-in admin's experience mode and the emulated system color scheme, then
 * saves server-side (matters because every check below is a full navigation). */
async function setPalette(page: Page, palette: Palette): Promise<void> {
  await page.emulateMedia({ colorScheme: palette.colorScheme });
  await page.goto("/settings");
  await page.getByTestId(`experience-mode-btn-${palette.mode}`).click();
  await page.getByTestId("btn-save-experience-mode").click();
  await expect(page.getByRole("status")).toHaveText("Appearance saved.");
  await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
}

/** Tabs through the page a few times and asserts at least one focused element renders a
 * visible :focus-visible ring — same check as cross-palette-a11y.spec.ts, applied here to the
 * guided-path screens specifically. */
async function expectVisibleFocusSomewhere(page: Page): Promise<void> {
  let sawVisibleRing = false;
  for (let i = 0; i < 8 && !sawVisibleRing; i++) {
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
    if (!focusState?.matchesFocusVisible) continue;
    sawVisibleRing = focusState.boxShadow !== "none" || focusState.outlineStyle !== "none";
  }
  expect(sawVisibleRing).toBe(true);
}

test("journey, unit player, and pause state render distinct, accessible visuals across all four palettes", async ({
  page,
}) => {
  await setupWithSeed(page);

  const firstUnit = page.getByTestId("unit-0");
  const unitId = await firstUnit.getAttribute("data-unit-id");
  expect(unitId).toBeTruthy();

  // Complete the offline-safe review activity once so re-entering the unit lands on an
  // activity (listening) that actually needs generation — the one that reaches the pause state.
  await firstUnit.click();
  await page.waitForURL(`/path/${unitId}`);
  await page.getByTestId("btn-start-activity-0").click();
  await page.waitForURL(`/review?unit=${unitId}&activity=0`);
  await rateAllDueCardsGood(page);
  await expect(page.getByTestId("review-summary")).toBeVisible();
  await page.getByTestId("btn-back-to-unit-or-home").click();
  await page.waitForURL(`/path/${unitId}`);

  for (const palette of ALL_PALETTES) {
    await setPalette(page, palette);

    // ── Journey (home): kid/adult register is visibly distinct, landmarks present ───────
    await page.goto("/home");
    await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await expect(page.getByTestId("learning-path")).toHaveAttribute(
      "data-experience-mode",
      palette.mode,
    );
    await expect(page.getByRole("heading", { name: HEADING_BY_MODE[palette.mode] })).toBeVisible();
    await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "in-progress");
    await expectVisibleFocusSomewhere(page);

    // ── Unit player: same landmarks, activity list renders ──────────────────────────────
    await page.goto(`/path/${unitId}`);
    await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByTestId("unit-activities")).toBeVisible();
    await expect(page.getByTestId("unit-activity-1")).toContainText("Up next");
    await expectVisibleFocusSomewhere(page);

    // ── Pause state: offline-graceful pause renders correctly in every palette too ──────
    await page.getByTestId("btn-start-activity-1").click();
    const paused = page.getByTestId("path-paused");
    await expect(paused).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByTestId("btn-review-instead")).toBeVisible();
    await expect(page.getByTestId("btn-browse-cached")).toBeVisible();
    await expectVisibleFocusSomewhere(page);

    // Back to the ready unit view before the next palette in the sweep.
    await page.getByTestId("btn-retry-unit").click();
    await expect(page.getByTestId("unit-activities")).toBeVisible();
  }
});
