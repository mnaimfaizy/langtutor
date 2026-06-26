import { expect, test as setup } from "@playwright/test";

export const ADMIN_EMAIL = "admin@langtutor.test";
export const ADMIN_PASSWORD = "TestPassword1!";
export const AUTH_FILE = "tests/e2e/.auth/user.json";

setup("authenticate as admin", async ({ page }) => {
  // Bootstrap the first admin; 409 means already bootstrapped — proceed to sign-in.
  await page.request.post("/api/auth/bootstrap", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("/");

  await page.context().storageState({ path: AUTH_FILE });
});
