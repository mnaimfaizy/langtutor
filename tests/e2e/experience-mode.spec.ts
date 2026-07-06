/**
 * Slice 3 of the UI/UX revamp (issue #45) — experience mode end-to-end.
 * Verifies the Settings toggle switches the root palette live and that the choice
 * survives a reload (i.e. the server-rendered bootstrap picks up the stored mode).
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset");
});

test("experience mode: defaults to adult for a fresh profile", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByTestId("experience-mode-section")).toBeVisible();
  await expect(page.getByTestId("experience-mode-btn-adult")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("html")).toHaveAttribute("data-palette", /^adult-/);
});

test("experience mode: switching to kid changes the palette live and persists across reload", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(page.getByTestId("experience-mode-section")).toBeVisible();

  // Selecting "Kid" switches the palette immediately, before saving.
  await page.getByTestId("experience-mode-btn-kid").click();
  await expect(page.locator("html")).toHaveAttribute("data-palette", /^kid-/);

  await page.getByTestId("btn-save-experience-mode").click();
  await expect(page.getByRole("status")).toHaveText("Appearance saved.");

  // Reload: the server-rendered bootstrap script must already know the stored mode —
  // no flash back to adult before the client re-applies it.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-palette", /^kid-/);
  await expect(page.getByTestId("experience-mode-btn-kid")).toHaveAttribute("aria-pressed", "true");

  // Navigating elsewhere keeps the palette (whole app switches, not just Settings).
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-palette", /^kid-/);
});

test("experience mode: switching back to adult restores the premium-dark family", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByTestId("experience-mode-btn-kid").click();
  await page.getByTestId("btn-save-experience-mode").click();
  await expect(page.getByRole("status")).toHaveText("Appearance saved.");

  await page.getByTestId("experience-mode-btn-adult").click();
  await expect(page.locator("html")).toHaveAttribute("data-palette", /^adult-/);
  await page.getByTestId("btn-save-experience-mode").click();
  await expect(page.getByRole("status")).toHaveText("Appearance saved.");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-palette", /^adult-/);
});
