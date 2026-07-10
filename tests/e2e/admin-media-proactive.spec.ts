/**
 * Issue #111 — admin proactive image generate: free-text already-exists rejection
 * and curriculum gap helper listing after a purge.
 *
 * Does not call the live ImageGenerator (provider may be unconfigured in sandbox).
 * Happy-path generate is covered by unit tests with MockImageGenerator.
 */
import { expect, test } from "./fixtures";

test.describe("admin image proactive generate", () => {
  test.beforeEach(async ({ request }) => {
    const reset = await request.post("/api/test/reset");
    expect(reset.ok()).toBe(true);
  });

  test.afterEach(async ({ request }) => {
    await request.post("/api/test/media-asset", {
      data: { action: "restore-pack", key: "apple" },
    });
  });

  test("rejects free-text generate when the key already exists", async ({ page }) => {
    await page.goto("/admin/media");
    await expect(page.getByRole("heading", { name: "Media review" })).toBeVisible();
    await expect(page.getByTestId("media-proactive-generate")).toBeVisible();
    // Wait for approved list to settle so concurrent preview actions don't starve generate.
    await expect(page.getByText("apple", { exact: true }).first()).toBeVisible();

    await page.getByTestId("media-proactive-word").fill("Apple");
    await page.getByTestId("media-proactive-submit").click();

    await expect(page.getByTestId("media-banner")).toContainText(/already exists/i, {
      timeout: 60_000,
    });
    await expect(page.getByTestId("media-banner")).toContainText(/regenerate/i);
  });

  test("curriculum gap helper lists a purged pre-A1 word", async ({ page, request }) => {
    const purge = await request.post("/api/test/media-asset", {
      data: { action: "purge", key: "apple" },
    });
    expect(purge.ok()).toBe(true);

    await page.goto("/admin/media");
    await expect(page.getByTestId("media-curriculum-gaps")).toBeVisible();
    await expect(page.getByTestId("media-gap-apple")).toBeVisible();
    await expect(page.getByTestId("media-gap-generate-apple")).toBeVisible();
  });
});
