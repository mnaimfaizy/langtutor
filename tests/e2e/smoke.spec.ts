import { expect, test } from "@playwright/test";

test("home page renders the brand and skills", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Lang-Tutor", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reading", level: 2 })).toBeVisible();
});

test("can navigate to the settings page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
});
