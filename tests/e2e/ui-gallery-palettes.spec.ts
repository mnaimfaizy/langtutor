import { expect, test } from "./fixtures";

import { contrastRatio, parseRgbString } from "../../lib/theme/contrast";

const PALETTES = ["adult-light", "adult-dark", "kid-bright", "kid-dark"] as const;

const AA_NORMAL_TEXT_RATIO = 4.5;

test("gallery renders every palette without console errors and stays WCAG AA compliant", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto("/dev/ui");
  await expect(page.getByRole("heading", { name: "UI gallery", level: 1 })).toBeVisible();

  for (const palette of PALETTES) {
    await page.getByTestId(`palette-switcher-${palette}`).click();
    await expect(page.locator("html")).toHaveAttribute("data-palette", palette);

    // Elevated variants (gradient button, glass card) render and stay interactive.
    await expect(page.getByTestId("button-gradient")).toBeVisible();
    await expect(page.getByTestId("card-surface")).toBeVisible();
    await expect(page.getByTestId("card-glass")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Reading" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // New primitives (badge, avatar, stat, progress-ring) render with the right roles/content.
    const mediumRing = page.getByTestId("progress-ring-md");
    await expect(mediumRing).toBeVisible();
    await expect(mediumRing).toHaveAttribute("role", "progressbar");
    await expect(mediumRing).toHaveAttribute("aria-valuenow", "66");
    await expect(mediumRing).toHaveAttribute("aria-valuemin", "0");
    await expect(mediumRing).toHaveAttribute("aria-valuemax", "100");
    await expect(mediumRing.getByText("66%")).toBeVisible();

    const levelRing = page.getByTestId("progress-ring-lg");
    await expect(levelRing).toHaveAttribute("aria-valuenow", "4");
    await expect(levelRing).toHaveAttribute("aria-valuemax", "10");

    await expect(page.getByTestId("badge-neutral")).toHaveText("Neutral");
    await expect(page.getByTestId("badge-gradient")).toBeVisible();

    await expect(page.getByTestId("avatar-initials")).toHaveText("AB");
    await expect(page.getByTestId("avatar-image")).toBeVisible();

    const xpStat = page.getByTestId("stat-xp");
    await expect(xpStat).toContainText("1240");
    await expect(xpStat).toContainText("Total XP");

    const bodyColors = await page.evaluate(() => {
      const style = getComputedStyle(document.body);
      return { color: style.color, backgroundColor: style.backgroundColor };
    });
    const bodyRatio = contrastRatio(
      parseRgbString(bodyColors.color),
      parseRgbString(bodyColors.backgroundColor),
    );
    expect(bodyRatio, `body text vs background contrast for ${palette}`).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT_RATIO,
    );

    const accentSample = page.getByTestId("glow-sample");
    const accentColors = await accentSample.evaluate((el) => {
      const style = getComputedStyle(el);
      return { color: style.color, backgroundColor: style.backgroundColor };
    });
    const accentRatio = contrastRatio(
      parseRgbString(accentColors.color),
      parseRgbString(accentColors.backgroundColor),
    );
    expect(
      accentRatio,
      `accent vs accent-foreground contrast for ${palette}`,
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_RATIO);
  }

  expect(consoleErrors, `console errors: ${consoleErrors.join("; ")}`).toEqual([]);
});
