/**
 * Issue #110 — admin audio proactive generate: free-text already-exists rejection
 * and curriculum gap helper listing. Happy-path synthesize is covered by unit tests
 * with MockTtsSynthesizer (sandbox may lack GROQ_API_KEY).
 */
import { expect, test } from "./fixtures";

test.describe("admin audio proactive generate", () => {
  test.beforeEach(async ({ request }) => {
    const reset = await request.post("/api/test/reset");
    expect(reset.ok()).toBe(true);
  });

  test.afterEach(async ({ request }) => {
    await request.post("/api/test/media-asset", {
      data: { action: "purge", kind: "audio", key: "apple" },
    });
  });

  test("rejects free-text generate when the audio key already exists", async ({
    page,
    request,
  }) => {
    const seed = await request.post("/api/test/media-asset", {
      data: { action: "put-approved", kind: "audio", key: "apple" },
    });
    expect(seed.ok()).toBe(true);

    await page.goto("/admin/media/audio");
    await expect(page.getByRole("heading", { name: "Audio review" })).toBeVisible();
    await expect(page.getByTestId("audio-proactive-generate")).toBeVisible();
    await expect(page.getByText("apple", { exact: true }).first()).toBeVisible();

    await page.getByTestId("audio-proactive-word").fill("Apple");
    await page.getByTestId("audio-proactive-submit").click();

    await expect(page.getByTestId("audio-banner")).toContainText(/already exists/i, {
      timeout: 60_000,
    });
    await expect(page.getByTestId("audio-banner")).toContainText(/regenerate/i);
  });

  test("curriculum gap helper lists a missing pre-A1 audio word", async ({ page }) => {
    await page.goto("/admin/media/audio");
    await expect(page.getByTestId("audio-curriculum-gaps")).toBeVisible();
    await expect(page.getByTestId("audio-gap-apple")).toBeVisible();
    await expect(page.getByTestId("audio-gap-generate-apple")).toBeVisible();
    await expect(page.getByTestId("audio-gap-generate-apple")).toHaveText("Load");
  });

  test("proactive generate exposes say and direction fields", async ({ page }) => {
    await page.goto("/admin/media/audio");
    await expect(page.getByTestId("audio-proactive-say")).toBeVisible();
    await expect(page.getByTestId("audio-proactive-direction")).toBeVisible();
    await page.getByTestId("audio-proactive-word").fill("xylophone");
    await page.getByTestId("audio-proactive-word").blur();
    await expect(page.getByTestId("audio-proactive-say")).toHaveValue(/xylophone/i, {
      timeout: 15_000,
    });
    await page.getByTestId("audio-proactive-direction").fill("cheerful");
    await expect(page.getByTestId("audio-proactive-composed")).toContainText(
      "[cheerful] xylophone",
    );
  });

  test("edit loads an existing clip into the generate form without regenerating", async ({
    page,
    request,
  }) => {
    const seed = await request.post("/api/test/media-asset", {
      data: { action: "put-approved", kind: "audio", key: "apple" },
    });
    expect(seed.ok()).toBe(true);

    await page.goto("/admin/media/audio");
    await expect(page.getByText("apple", { exact: true }).first()).toBeVisible();
    await page.getByTestId("audio-edit-in-form").first().click();

    await expect(page.getByTestId("audio-banner")).toContainText(/Loaded "apple"/i, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("audio-proactive-word")).toHaveValue("apple");
    await expect(page.getByTestId("audio-proactive-say")).toHaveValue(/apple/i);
    await expect(page.getByTestId("audio-proactive-submit")).toHaveText(/Generate replacement/i);
  });
});
