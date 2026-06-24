import { expect, test } from "@playwright/test";

test("diagnostics: page renders heading and empty state on fresh install", async ({ page }) => {
  await page.goto("/diagnostics");
  await expect(page.getByRole("heading", { name: "Diagnostics", level: 1 })).toBeVisible();
  // Fresh browser context has no error events, so empty state is shown.
  await expect(page.getByTestId("diagnostics-empty")).toBeVisible({ timeout: 10_000 });
});

test("diagnostics: all four skill tabs are present", async ({ page }) => {
  await page.goto("/diagnostics");
  for (const skill of ["reading", "writing", "listening", "speaking"]) {
    await expect(page.getByTestId(`skill-tab-${skill}`)).toBeVisible();
  }
});

test("diagnostics: skill tabs are switchable", async ({ page }) => {
  await page.goto("/diagnostics");
  // Reading tab is active by default (aria-selected).
  await expect(page.getByTestId("skill-tab-reading")).toHaveAttribute("aria-selected", "true");
  // Click writing tab.
  await page.getByTestId("skill-tab-writing").click();
  await expect(page.getByTestId("skill-tab-writing")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("skill-tab-reading")).toHaveAttribute("aria-selected", "false");
});

test("home: diagnostics link navigates to /diagnostics", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("btn-diagnostics").click();
  await expect(page).toHaveURL(/\/diagnostics$/);
  await expect(page.getByRole("heading", { name: "Diagnostics", level: 1 })).toBeVisible();
});
