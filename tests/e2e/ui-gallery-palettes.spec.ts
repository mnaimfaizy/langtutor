import { expect, test } from "@playwright/test";

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
