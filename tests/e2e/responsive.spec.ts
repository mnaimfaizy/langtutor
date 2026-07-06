/**
 * Issue #48 (UI/UX revamp slice 7) — responsive pass for the app shell, auth screens,
 * and home hub. Verifies phone-width layouts stay usable: no horizontal scroll and
 * touch targets meet a reasonable minimum size.
 */
import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 375, height: 812 };
const MIN_TOUCH_TARGET_PX = 36;

async function expectNoHorizontalScroll(page: import("@playwright/test").Page) {
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalScroll).toBe(false);
}

test.describe("phone-width layout: authenticated shell", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("home page renders without horizontal overflow and keeps nav tap targets usable", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Lang-Tutor", level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);

    const settingsLink = page.getByRole("link", { name: "Settings" });
    await expect(settingsLink).toBeVisible();
    const box = await settingsLink.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  });

  test("settings page renders without horizontal overflow", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

/**
 * Issue #50 (UI/UX revamp slice 9) — responsive pass for the deck, diagnostics,
 * settings, and admin pages.
 */
test.describe("phone-width layout: deck, diagnostics, and admin", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("deck page renders without horizontal overflow and add-word form is usable", async ({
    page,
  }) => {
    await page.goto("/deck");
    await expect(page.getByRole("heading", { name: "Add words", level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);

    const wordInput = page.getByTestId("word-input");
    await expect(wordInput).toBeVisible();
    const box = await wordInput.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  });

  test("diagnostics page renders without horizontal overflow and skill tabs are usable", async ({
    page,
  }) => {
    await page.goto("/diagnostics");
    await expect(page.getByRole("heading", { name: "Diagnostics", level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);

    const readingTab = page.getByTestId("skill-tab-reading");
    await expect(readingTab).toBeVisible();
    const box = await readingTab.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  });

  test("admin users page renders without horizontal overflow", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "User management", level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe("phone-width layout: auth screens", () => {
  // Auth screens are reached unauthenticated — drop the shared session storage state.
  test.use({ viewport: PHONE_VIEWPORT, storageState: { cookies: [], origins: [] } });

  test("login page renders without horizontal overflow and inputs are reachable", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expectNoHorizontalScroll(page);

    const emailInput = page.getByLabel("Email");
    await expect(emailInput).toBeVisible();
    const box = await emailInput.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  });

  test("sign-up page renders without horizontal overflow", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
