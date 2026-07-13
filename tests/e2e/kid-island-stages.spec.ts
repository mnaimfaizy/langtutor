/**
 * Issue #127 — Kid Island shows four pre-A1 stages with multi-unit Alphabet runway and
 * intentional placeholder chrome for later shores (not a flat checklist).
 */
import { expect, test } from "./fixtures";

import { switchToKidMode, completeOnboardingToHome } from "./pre-a1-mastery-helpers";

test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset");
});

test("kid island groups the shared starter into four stages", async ({ page }) => {
  await completeOnboardingToHome(page);
  await switchToKidMode(page);

  const island = page.getByTestId("kid-island-home");
  await expect(island).toBeVisible({ timeout: 30_000 });

  const stages = page.getByTestId("kid-island-stages");
  await expect(stages).toBeVisible();
  await expect(page.getByTestId("kid-island-stage-alphabet")).toHaveAttribute(
    "data-richness",
    "rich",
  );
  await expect(page.getByTestId("kid-island-stage-phonics")).toHaveAttribute(
    "data-richness",
    "placeholder",
  );
  await expect(page.getByTestId("kid-island-stage-picture-words")).toHaveAttribute(
    "data-richness",
    "placeholder",
  );
  await expect(page.getByTestId("kid-island-stage-listen-tap")).toHaveAttribute(
    "data-richness",
    "placeholder",
  );

  await expect(page.getByTestId("kid-island-stage-alphabet")).toContainText("Letter Shore");
  await expect(page.getByTestId("kid-island-stage-phonics")).toContainText("Preview");

  // Portrait + landscape maps both mount in the DOM (one CSS-hidden); assert via the strip
  // and a single visible unit label rather than duplicate map-node testids.
  await expect(page.getByRole("link", { name: /Meet the letters/i }).first()).toBeVisible();
  await expect(page.getByTestId("kid-island-shore-phonics").first()).toContainText("Preview");
  await expect(page.getByTestId("kid-island-unit--3").first()).toHaveAttribute(
    "data-richness",
    "placeholder",
  );
});
