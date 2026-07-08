import { expect, test } from "@playwright/test";

test("collection screen lists creatures and achievements", async ({ page }) => {
  await page.goto("/collection");
  await expect(page.getByRole("heading", { name: "Collection", level: 1 })).toBeVisible();
  await expect(page.getByTestId("collection-screen")).toBeVisible();
  await expect(page.getByTestId("collection-creatures")).toBeVisible();
  await expect(page.getByTestId("collection-achievements")).toBeVisible();
  await expect(page.getByTestId("collectible-card-creature-fox")).toBeVisible();
  await expect(page.getByTestId("collectible-card-first_review")).toBeVisible();
});

test("home links to the collection screen", async ({ page }) => {
  await page.goto("/home");
  await page.getByTestId("btn-collection").click();
  await expect(page).toHaveURL(/\/collection$/);
});

test("HUD links to the collection screen", async ({ page }) => {
  await page.goto("/home");
  await page.getByTestId("hud-collection").click();
  await expect(page).toHaveURL(/\/collection$/);
});
