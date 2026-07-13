/**
 * Issue #75 — QA gate for the pre-A1 workstream: seeded media-store assets with the
 * ImageGenerator unreachable, admin approval visibility, kid-mode palette sweep across
 * all four activity types, and handoff from the last pre-A1 unit into unit 0.
 */
import { type Page, expect, test } from "./fixtures";

import { PRE_A1_FIRST_PATH_INDEX } from "@/lib/path/shared-path-catalog";
import { stubMacApis } from "./stub-mac-apis";

import { ALPHABET_ENTRIES } from "@/lib/alphabet/vocab";
import { LISTEN_TAP_ROUNDS } from "@/lib/listen-tap/vocab";
import { PICTURE_MATCH_OPTION_WORDS, PICTURE_MATCH_ROUNDS } from "@/lib/picture-match/vocab";

import { AUTH_FILE } from "./auth-constants";

const BATCH_SIZE = 6;
const ALPHABET_LENGTH = 26;
const PICTURE_MATCH_ROUND_COUNT = PICTURE_MATCH_ROUNDS.length;
const LISTEN_TAP_ROUND_COUNT = LISTEN_TAP_ROUNDS.length;

const PACK_WORDS = new Set(PICTURE_MATCH_OPTION_WORDS.map((word) => word.toLowerCase()));

const KID_PALETTES = [
  { name: "kid-bright" as const, colorScheme: "light" as const },
  { name: "kid-dark" as const, colorScheme: "dark" as const },
];

const TINY_WAV = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
  0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
  0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00,
]);

test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
  storageState: { cookies: [], origins: [] },
});

test.beforeEach(async ({ page, request }) => {
  test.setTimeout(360_000);
  await request.post("/api/test/reset");

  await page.route("**/api/audio/resolve**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: TINY_WAV,
    });
  });

  // Pack-first: curated illustrations continue to the real store route; everything else
  // simulates an unreachable ImageGenerator (502, matching /api/image/resolve on failure).
  await page.route("**/api/image/resolve**", async (route) => {
    const url = new URL(route.request().url());
    const word = (url.searchParams.get("word") ?? "").toLowerCase();
    if (PACK_WORDS.has(word)) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "Image resolution failed" }),
    });
  });
});

async function signUpKid(page: Page): Promise<void> {
  const email = `prea1-qa-${Date.now()}@example.com`;
  await page.goto("/sign-up");
  await page.getByTestId("signup-mode-btn-kid").click();
  await page.getByTestId("signup-mode-continue").click();
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill("TestPassword1!");
  await page.locator("#confirm").fill("TestPassword1!");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("/onboarding");
}

async function completeOnboardingToHome(page: Page): Promise<void> {
  await page.goto("/onboarding");
  await page.getByTestId("quiz-start-btn").click();
  for (let i = 0; i < BATCH_SIZE; i++) {
    await page.getByTestId("btn-unknown").click();
  }
  await page.getByTestId("btn-save-level").click();
  await page.getByTestId("goal-btn-general").click();
  await page.getByTestId("btn-save-goals").click();
  await page.waitForURL("/home");
  await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });
}

async function setKidPalette(page: Page, palette: (typeof KID_PALETTES)[number]): Promise<void> {
  await page.emulateMedia({ colorScheme: palette.colorScheme });
  await page.goto("/settings");
  await page.getByTestId("experience-mode-btn-kid").click();
  await page.getByTestId("btn-save-experience-mode").click();
  await expect(page.getByRole("status")).toHaveText("Appearance saved.");
  await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
}

async function expectImageNotLoaded(page: Page, testId: string): Promise<void> {
  const status = await page.getByTestId(testId).evaluate(async (img: HTMLImageElement) => {
    const src = img.currentSrc || img.getAttribute("src");
    if (!src) return 0;
    const response = await fetch(src);
    return response.status;
  });
  expect(status).not.toBe(200);
}

async function expectImageLoaded(page: Page, testId: string): Promise<void> {
  await expect
    .poll(
      async () => {
        return page.getByTestId(testId).evaluate(async (img: HTMLImageElement) => {
          const src = img.currentSrc || img.getAttribute("src");
          if (!src) return 0;
          const response = await fetch(src);
          return response.status;
        });
      },
      { timeout: 15_000 },
    )
    .toBe(200);
}

async function completeAlphabetUnit(page: Page): Promise<void> {
  await page.getByTestId(`unit-${PRE_A1_FIRST_PATH_INDEX}`).click();
  await page.getByTestId("btn-start-activity-0").click();
  for (let i = 0; i < ALPHABET_LENGTH - 1; i++) {
    await page.getByTestId("btn-alphabet-next").click();
  }
  await page.getByTestId("btn-alphabet-next").click();
  await expect(page.getByTestId("unit-complete-message")).toBeVisible();
  await page.goto("/home");
}

async function completePhonicsUnit(page: Page): Promise<void> {
  await page.getByTestId("unit--3").click();
  await page.getByTestId("btn-start-activity-0").click();
  for (let i = 0; i < ALPHABET_LENGTH; i++) {
    const letter = String.fromCharCode(97 + i);
    await page.getByTestId(`phonics-choice-${letter}`).click();
    await page.getByTestId("btn-phonics-next").click();
  }
  await expect(page.getByTestId("unit-complete-message")).toBeVisible();
  await page.goto("/home");
}

async function completePictureMatchUnit(page: Page): Promise<void> {
  await page.getByTestId("unit--2").click();
  await page.getByTestId("btn-start-activity-0").click();
  for (let i = 0; i < PICTURE_MATCH_ROUND_COUNT; i++) {
    const target = PICTURE_MATCH_ROUNDS[i]!.targetWord;
    await page.getByTestId(`picture-match-choice-${target}`).click();
    await page.getByTestId("btn-picture-match-next").click();
  }
  await expect(page.getByTestId("unit-complete-message")).toBeVisible();
  await page.goto("/home");
}

async function completeListenTapUnit(page: Page): Promise<void> {
  await page.getByTestId("unit--1").click();
  await page.getByTestId("btn-start-activity-0").click();
  for (let i = 0; i < LISTEN_TAP_ROUND_COUNT; i++) {
    const target = LISTEN_TAP_ROUNDS[i]!.targetWord;
    await page.getByTestId(`listen-tap-choice-${target}`).click();
    await page.getByTestId("btn-listen-tap-next").click();
  }
  await expect(page.getByTestId("unit-complete-message")).toBeVisible();
  await page.goto("/home");
}

test("seeded pack images render while the image generator is unreachable", async ({
  page,
  request,
}) => {
  await signUpKid(page);
  await completeOnboardingToHome(page);

  const restoreApple = await page.request.post("/api/test/media-asset", {
    data: { action: "restore-pack", key: "apple" },
  });
  expect(restoreApple.ok()).toBe(true);

  const appleResolve = await request.get("/api/image/resolve?word=apple&style=kid-illustration");
  expect(appleResolve.ok()).toBe(true);

  const generatorDownStatus = await page.evaluate(async () => {
    const response = await fetch("/api/image/resolve?word=xylophone&style=kid-illustration");
    return response.status;
  });
  expect(generatorDownStatus).toBe(502);

  await page.getByTestId(`unit-${PRE_A1_FIRST_PATH_INDEX}`).click();
  await page.getByTestId("btn-start-activity-0").click();

  await expect(page.getByTestId("alphabet-letter")).toHaveText("A");
  await expect(page.getByTestId("alphabet-picture")).toBeVisible();
  await page.getByTestId("btn-alphabet-listen").click();
});

test("pending asset is hidden from learners until admin approval", async ({ browser }) => {
  test.setTimeout(480_000);

  let kidContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  let adminContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;

  // This file clears storageState (kid signup), so the default `request` fixture is
  // unauthenticated — put-pending would 302 to /login and leave the curated-pack
  // apple approved (no Approve button). Seed via an admin-authed context instead.
  const seedContext = await browser.newContext({
    storageState: AUTH_FILE,
    serviceWorkers: "block",
  });
  try {
    const seedPage = await seedContext.newPage();
    const putPending = await seedPage.request.post("/api/test/media-asset", {
      data: { action: "put-pending", key: "apple" },
    });
    expect(putPending.ok()).toBe(true);
  } finally {
    await seedContext.close();
  }

  try {
    kidContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      permissions: ["microphone"],
      // Manual contexts do not inherit playwright.config `use` — must block SW
      // so stubMacApis page.route handlers actually intercept /api/llm/*.
      serviceWorkers: "block",
    });
    const kidPage = await kidContext.newPage();
    await stubMacApis(kidPage);
    await kidPage.route("**/api/audio/resolve**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "audio/wav",
        body: TINY_WAV,
      });
    });
    // Match beforeEach: pack words hit the real store; everything else 502.
    await kidPage.route("**/api/image/resolve**", async (route) => {
      const url = new URL(route.request().url());
      const word = (url.searchParams.get("word") ?? "").toLowerCase();
      if (PACK_WORDS.has(word)) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Image resolution failed" }),
      });
    });

    await signUpKid(kidPage);
    await completeOnboardingToHome(kidPage);
    await kidPage.getByTestId(`unit-${PRE_A1_FIRST_PATH_INDEX}`).click();
    await kidPage.getByTestId("btn-start-activity-0").click();
    await expect(kidPage.getByTestId("alphabet-letter")).toHaveText("A");
    await expectImageNotLoaded(kidPage, "alphabet-picture");

    adminContext = await browser.newContext({
      storageState: AUTH_FILE,
      serviceWorkers: "block",
    });
    const adminPage = await adminContext.newPage();
    await stubMacApis(adminPage);
    await adminPage.goto("/admin/media");
    await expect(adminPage.getByRole("heading", { name: "Media review" })).toBeVisible();
    await expect(adminPage.getByText("apple", { exact: true })).toBeVisible();
    await adminPage.getByRole("button", { name: "Approve" }).first().click();
    await expect(adminPage.getByRole("status")).toContainText('Approved "apple".');

    await kidPage.reload();
    await expect(kidPage.getByTestId("alphabet-letter")).toHaveText("A");
    await expectImageLoaded(kidPage, "alphabet-picture");
  } finally {
    if (kidContext) {
      try {
        await kidContext.close();
      } catch {
        // ignore teardown-time context close errors
      }
    }
    if (adminContext) {
      try {
        await adminContext.close();
      } catch {
        // ignore teardown-time context close errors
      }
    }
    const restoreContext = await browser.newContext({
      storageState: AUTH_FILE,
      serviceWorkers: "block",
    });
    try {
      const restorePage = await restoreContext.newPage();
      await restorePage.request.post("/api/test/media-asset", {
        data: { action: "restore-pack", key: "apple" },
      });
    } catch {
      // request context may be disposed if the test runner is tearing down
    } finally {
      await restoreContext.close();
    }
  }
});

const ACTIVITY_SWEEP = [
  {
    skill: "alphabet",
    path: "/alphabet",
    start: async (page: Page) => {
      await expect(page.getByTestId("alphabet-letter")).toBeVisible();
      await expect(page.getByTestId("alphabet-picture")).toBeVisible();
      await page.getByTestId("btn-alphabet-listen").click();
    },
  },
  {
    skill: "phonics",
    path: "/phonics",
    start: async (page: Page) => {
      await expect(page.getByTestId("phonics-choices")).toBeVisible();
      await page.getByTestId(`phonics-choice-${ALPHABET_ENTRIES[0]!.letter}`).click();
      await expect(page.getByTestId("phonics-feedback")).toBeVisible();
    },
  },
  {
    skill: "picture-match",
    path: "/picture-match",
    start: async (page: Page) => {
      await expect(page.getByTestId("picture-match-choices")).toBeVisible();
      const target = PICTURE_MATCH_ROUNDS[0]!.targetWord;
      await page.getByTestId(`picture-match-choice-${target}`).click();
      await expect(page.getByTestId("picture-match-feedback")).toBeVisible();
    },
  },
  {
    skill: "listen-tap",
    path: "/listen-tap",
    start: async (page: Page) => {
      await expect(page.getByTestId("listen-tap-choices")).toBeVisible();
      const target = LISTEN_TAP_ROUNDS[0]!.targetWord;
      await page.getByTestId(`listen-tap-choice-${target}`).click();
      await expect(page.getByTestId("listen-tap-feedback")).toBeVisible();
    },
  },
] as const;

test("four pre-A1 activity types render and accept input in both kid palettes", async ({
  page,
}) => {
  await signUpKid(page);
  await completeOnboardingToHome(page);

  for (const palette of KID_PALETTES) {
    await setKidPalette(page, palette);

    for (const activity of ACTIVITY_SWEEP) {
      await page.goto(activity.path);
      await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
      await activity.start(page);
    }
  }
});

test("completing every pre-A1 unit leaves A1 locked until the chapter gate passes", async ({
  page,
}) => {
  await signUpKid(page);
  await completeOnboardingToHome(page);

  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "locked");

  await completeAlphabetUnit(page);
  await completePhonicsUnit(page);
  await completePictureMatchUnit(page);
  await completeListenTapUnit(page);

  // Placeholders alone: chapter growing, A1 locked, no exam CTA (issue #128).
  await page.goto("/home");
  await expect(page.getByTestId("unit--1")).toHaveAttribute("data-status", "completed");
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "locked");
  await expect(page.getByTestId("chapter-growing-banner")).toBeVisible();
  await expect(page.getByTestId("chapter-gate-pending-cta")).toHaveCount(0);

  // Once stages are admin-ready, the exam CTA appears and A1 stays locked until pass.
  const ready = await page.request.post("/api/test/shared-path-stages-ready", {
    data: { readyForExam: true },
  });
  expect(ready.ok()).toBe(true);
  await page.goto("/home");
  await expect(page.getByTestId("chapter-gate-pending-cta")).toBeVisible();
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "locked");
});
