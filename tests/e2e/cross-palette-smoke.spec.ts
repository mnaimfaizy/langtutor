/**
 * Issue #51 (UI/UX revamp slice 10) — cross-palette e2e smoke sweep. Closes out PRD #36's
 * Definition of Done: every major page must render its key landmarks under both the
 * adult-dark and kid-bright palettes (the two palettes exercised by this smoke suite —
 * see cross-palette-a11y.spec.ts for the full four-palette contrast/motion/focus checks).
 */
import { type Page, expect, test } from "./fixtures";

type SmokePalette = {
  name: "adult-dark" | "kid-bright";
  mode: "adult" | "kid";
  colorScheme: "light" | "dark";
};

// adult-dark = adult mode + dark scheme; kid-bright = kid mode + light scheme
// (see lib/theme/resolve-palette.ts).
const SMOKE_PALETTES: SmokePalette[] = [
  { name: "adult-dark", mode: "adult", colorScheme: "dark" },
  { name: "kid-bright", mode: "kid", colorScheme: "light" },
];

interface MajorPage {
  path: string;
  /** Asserted via role=heading level=1, unless `testId` is given instead. */
  heading?: string;
  testId?: string;
}

const MAJOR_PAGES: MajorPage[] = [
  { path: "/", heading: "Lang-Tutor" },
  { path: "/reading", heading: "Reading" },
  { path: "/writing", heading: "Writing" },
  { path: "/listening", heading: "Listening" },
  { path: "/speaking", heading: "Speaking" },
  // Review has no static h1 across every phase (loading/empty/reviewing/summary) — its
  // root wrapper testid is the one landmark guaranteed to be present in all of them.
  { path: "/review", testId: "review-session" },
  { path: "/deck", heading: "Add words" },
  { path: "/diagnostics", heading: "Diagnostics" },
  { path: "/settings", heading: "Settings" },
  { path: "/admin/media", heading: "Media review" },
  { path: "/admin/users", heading: "User management" },
];

/**
 * Switches the signed-in admin's experience mode and the emulated system color scheme,
 * then saves the mode server-side. Saving (rather than just live-previewing) matters
 * because every subsequent page in the sweep is a full navigation (`page.goto`), which
 * re-runs the server-rendered palette bootstrap script from the stored profile.
 */
async function setPalette(page: Page, palette: SmokePalette): Promise<void> {
  await page.emulateMedia({ colorScheme: palette.colorScheme });
  await page.goto("/settings");
  await page.getByTestId(`experience-mode-btn-${palette.mode}`).click();
  await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
  await page.getByTestId("btn-save-experience-mode").click();
  await expect(page.getByRole("status")).toHaveText("Appearance saved.");
}

test.describe("cross-palette smoke: authenticated pages", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("/api/test/reset");
  });

  for (const palette of SMOKE_PALETTES) {
    test(`${palette.name}: every major page renders its landmarks`, async ({ page }) => {
      test.setTimeout(90_000);
      await setPalette(page, palette);

      for (const target of MAJOR_PAGES) {
        await page.goto(target.path);
        await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
        await expect(page.locator("header")).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();

        if (target.testId) {
          await expect(page.getByTestId(target.testId)).toBeVisible();
        } else {
          await expect(page.getByRole("heading", { name: target.heading, level: 1 })).toBeVisible();
        }
      }
    });
  }
});

test.describe("cross-palette smoke: unauthenticated auth screens", () => {
  // Auth screens are reached before sign-in — drop the shared session storage state.
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const palette of SMOKE_PALETTES) {
    test(`${palette.colorScheme} color scheme: login and sign-up render correctly`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: palette.colorScheme });

      // Unauthenticated visitors have no stored experience mode, so the bootstrap always
      // resolves the adult family (see getCurrentExperienceMode) — kid-bright is only
      // reachable once signed in, which auth screens by definition precede.
      await page.goto("/login");
      await expect(page.locator("html")).toHaveAttribute("data-palette", /^adult-/);
      await expect(page.locator("header")).toBeVisible();
      await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

      await page.goto("/sign-up");
      await expect(page.locator("html")).toHaveAttribute("data-palette", /^adult-/);
      await expect(page.locator("header")).toBeVisible();
      await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
    });
  }
});
