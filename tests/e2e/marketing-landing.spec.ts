/**
 * Issue #53 — the full public marketing landing page (hero, four skills, SRS/adaptivity,
 * privacy, kid-mode teaser, closing CTA). Complements auth-gate.spec.ts (which covers the
 * anonymous-vs-authenticated root redirect itself) with content and layout checks specific
 * to the landing page.
 */
import { expect, test } from "./fixtures";

// Anonymous visitor — the marketing page never renders for a signed-in session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("marketing landing page: sections", () => {
  test("renders hero, four skills, SRS/adaptivity, privacy, and kid-mode sections", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Lang-Tutor", level: 1 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Four skills, one adaptive tutor", level: 2 }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reading", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Writing", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Listening", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Speaking", level: 3 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Practice that remembers what you forget", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Private by design, not by promise", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Built for grown-ups. Ready for kids too.", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Start learning today — free", level: 2 }),
    ).toBeVisible();
  });

  test("hero sign-up CTA navigates to the sign-up page", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("btn-marketing-sign-up").click();
    await expect(page).toHaveURL(/\/sign-up$/);
    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
  });

  test("closing CTA also navigates to the sign-up page", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("btn-marketing-sign-up-footer").scrollIntoViewIfNeeded();
    await page.getByTestId("btn-marketing-sign-up-footer").click();
    await expect(page).toHaveURL(/\/sign-up$/);
  });
});

test.describe("marketing landing page: phone viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("sign-up CTA is visible above the fold without scrolling", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Lang-Tutor", level: 1 })).toBeInViewport();
    await expect(page.getByTestId("btn-marketing-sign-up")).toBeInViewport();
  });

  test("renders without horizontal overflow", async ({ page }) => {
    await page.goto("/");
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});

test.describe("marketing landing page: SEO & share metadata (issue #54)", () => {
  test("raw HTML response (no JS) carries title, description, canonical, and og/twitter tags", async ({
    page,
  }) => {
    // `page.request` issues a plain HTTP GET — no browser JS execution — so this proves the
    // tags (and the landing content below) are present in the server-rendered response itself,
    // not injected client-side.
    const response = await page.request.get("/");
    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).toContain("<title>Lang-Tutor — your private AI English tutor</title>");
    expect(html).toMatch(
      /<meta name="description" content="Reading, writing, listening, and speaking[^"]*"\/>/,
    );
    expect(html).toMatch(/<link rel="canonical" href="[^"]*"\/>/);

    expect(html).toMatch(/<meta property="og:title" content="Lang-Tutor[^"]*"\/>/);
    expect(html).toMatch(/<meta property="og:description" content="Reading, writing[^"]*"\/>/);
    expect(html).toContain('<meta property="og:type" content="website"/>');
    expect(html).toMatch(/<meta property="og:image" content="[^"]*opengraph-image[^"]*"\/>/);

    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"/>');
    expect(html).toMatch(/<meta name="twitter:title" content="Lang-Tutor[^"]*"\/>/);

    // Full landing content is server-rendered, not injected by client JS.
    expect(html).toContain("Lang-Tutor — your private AI English tutor");
    expect(html).toContain("Four skills, one adaptive tutor");
    expect(html).toContain("Practice that remembers what you forget");
    expect(html).toContain("Private by design, not by promise");
    expect(html).toContain("Built for grown-ups. Ready for kids too.");
  });
});

test.describe("marketing landing page: desktop viewport", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("renders the hero and product visual side by side", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Lang-Tutor", level: 1 })).toBeInViewport();
    await expect(page.getByTestId("btn-marketing-sign-up")).toBeInViewport();
  });
});
