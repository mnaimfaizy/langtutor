import { expect, test } from "@playwright/test";

import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./auth-constants";

// Run these tests without the global auth storage state so we can test the gate itself.
test.use({ storageState: { cookies: [], origins: [] } });

test("anonymous visitor sees the public marketing shell at the root — no redirect to /login", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Lang-Tutor", level: 1 })).toBeVisible();
  await expect(page.getByTestId("btn-marketing-sign-up")).toBeVisible();
  await expect(page.getByTestId("btn-marketing-login")).toBeVisible();
});

test("anonymous visitor to a protected route is redirected to /login", async ({ page }) => {
  await page.goto("/reading");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});

test("after login, the visitor lands on the module hub", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL("/home");
  await expect(page.getByRole("heading", { name: "Lang-Tutor", level: 1 })).toBeVisible();

  // Authenticated visit to the root redirects to the module hub instead of
  // showing the marketing shell.
  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Lang-Tutor", level: 1 })).toBeVisible();
});
