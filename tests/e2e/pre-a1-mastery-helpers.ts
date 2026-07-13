/**
 * Shared helpers for pre-A1 chapter mastery-gate e2e (issue #120).
 *
 * Uses the default admin storageState + authenticated `/api/test/reset` (same pattern as
 * goals.spec / onboarding.spec). Avoids cleared-storage signup — that path is flaky for
 * goals navigation and leaves new users without a server-seeded deck.
 */
import { type Page, expect } from "./fixtures";

import { LISTEN_TAP_ROUNDS } from "@/lib/listen-tap/vocab";
import { PICTURE_MATCH_ROUNDS } from "@/lib/picture-match/vocab";
import { preA1ExamItemCount } from "@/lib/path/exam";
import {
  PRE_A1_FIRST_PATH_INDEX,
  buildBundledSharedPathUnitTemplates,
} from "@/lib/path/shared-path-catalog";

export const BATCH_SIZE = 6;
export const ALPHABET_LENGTH = 26;
export const EXAM_ITEM_COUNT = preA1ExamItemCount();

/** Minimal valid WAV — enough for <audio> in Chromium. */
export const TINY_WAV = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
  0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
  0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00,
]);

/** 1×1 transparent PNG — picture-match / alphabet / listen-tap never hit ImageGenerator. */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Stub audio + image resolve (same pattern as picture-match / listen-tap activity specs). */
export async function stubActivityAudio(page: Page): Promise<void> {
  await page.route("**/api/audio/resolve**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: TINY_WAV,
    });
  });
  await page.route("**/api/image/resolve**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: TINY_PNG,
    });
  });
}

/**
 * Placement quiz → goals → home for the authed admin user after `/api/test/reset`
 * (profile wiped; cards re-seeded for this user).
 */
export async function completeOnboardingToHome(page: Page): Promise<void> {
  await page.goto("/onboarding");
  await expect(page.getByTestId("quiz-intro")).toBeVisible();
  await page.getByTestId("quiz-start-btn").click();
  await expect(page.getByTestId("quiz-quizzing")).toBeVisible();
  for (let i = 0; i < BATCH_SIZE; i++) {
    await page.getByTestId("btn-unknown").click();
  }
  await expect(page.getByTestId("quiz-result")).toBeVisible();
  await expect(page.getByTestId("quiz-result-level")).toHaveText("A1");
  await page.getByTestId("btn-save-level").click();
  await expect(page.getByTestId("goals-picker")).toBeVisible();
  await page.getByTestId("goal-btn-general").click();
  await page.getByTestId("btn-save-goals").click();
  await page.waitForURL("/home");
  await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });
  // Backbone must exist before pre-A1 sync — otherwise settings can seed only −4…−1.
  await expect(page.getByTestId("learning-path")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("unit-0")).toBeVisible({ timeout: 30_000 });
}

/** Adult: opt into pre-A1 + set progression mode. */
export async function configureAdultPreA1(
  page: Page,
  progressionMode: "strict" | "open" = "strict",
): Promise<void> {
  await page.goto("/settings");
  await expect(page.getByTestId("experience-mode-btn-adult")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await expect(page.getByTestId("pre-a1-settings-section")).toBeVisible();
  await page.getByTestId("enable-pre-a1-checkbox").check();
  await page.getByTestId("btn-save-pre-a1").click();
  await expect(page.getByTestId("pre-a1-settings-section").getByRole("status")).toHaveText(
    "Beginner path updated.",
  );

  await expect(page.getByTestId("progression-mode-section")).toBeVisible();
  await page.getByTestId(`progression-mode-btn-${progressionMode}`).click();
  await page.getByTestId("btn-save-progression-mode").click();
  await expect(page.getByTestId("progression-mode-section").getByRole("status")).toHaveText(
    "Progression mode saved.",
  );

  await page.goto("/home");
  await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("learning-path")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(`unit-${PRE_A1_FIRST_PATH_INDEX}`)).toHaveAttribute(
    "data-status",
    "available",
    {
      timeout: 30_000,
    },
  );
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "locked", {
    timeout: 30_000,
  });
}

/** Switch the authed profile to kid mode (seeds pre-A1; hides progression settings). */
export async function switchToKidMode(page: Page): Promise<void> {
  await page.goto("/settings");
  // Wait for the mount profile hydrate to finish — otherwise a late getProfile()
  // can overwrite a kid selection / post-save state back to adult.
  await expect(page.getByTestId("progression-mode-section")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("btn-save-progression-mode")).toBeEnabled();

  await page.getByTestId("experience-mode-btn-kid").click();
  await expect(page.getByTestId("experience-mode-btn-kid")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-palette", /^kid-/);
  await expect(page.getByTestId("progression-mode-section")).toHaveCount(0);

  await page.getByTestId("btn-save-experience-mode").click();
  await expect(page.getByTestId("experience-mode-section").getByRole("status")).toHaveText(
    "Appearance saved.",
  );

  // Reload asserts persistence (same pattern as experience-mode.spec).
  await page.reload();
  await expect(page.getByTestId("experience-mode-btn-kid")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("progression-mode-section")).toHaveCount(0);

  await page.goto("/home");
  await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });
}

type PreA1Index = number;

/**
 * Opens a specific pre-A1 unit from the standard path, or the current unit via kid-island Play!.
 *
 * Prefer `goto` over Link clicks — PageTransition AnimatePresence `mode="wait"` plus Motion
 * hydration under reduced-motion often leaves soft-nav stuck on `/home`.
 */
async function openPreA1Unit(page: Page, index: PreA1Index): Promise<string> {
  await page.goto("/home");
  await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });

  const island = page.getByTestId("kid-island-home");
  const learningPath = page.getByTestId("learning-path");
  await expect(island.or(learningPath)).toBeVisible({ timeout: 30_000 });

  if (await island.isVisible()) {
    const play = page.getByRole("link", { name: /^Play!$/ });
    await expect(play).toBeVisible({ timeout: 15_000 });
    const href = await play.getAttribute("href");
    expect(href).toMatch(/^\/path\/\d+/);
    await page.goto(href!);
  } else {
    const unit = page.getByTestId(`unit-${index}`);
    await expect(unit).toHaveAttribute("data-status", /^(available|in-progress)$/, {
      timeout: 30_000,
    });
    const unitId = await unit.getAttribute("data-unit-id");
    expect(unitId).toMatch(/^\d+$/);
    await page.goto(`/path/${unitId}`);
  }

  await expect(page).toHaveURL(/\/path\/\d+/, { timeout: 15_000 });
  await expect(page.getByTestId("btn-start-activity-0")).toBeVisible({ timeout: 15_000 });
  const match = page.url().match(/\/path\/(\d+)/);
  expect(match?.[1]).toMatch(/^\d+$/);
  return match![1]!;
}

/** Jump straight into a pre-A1 activity — avoids soft-nav races from the unit Start button. */
async function startPreA1Activity(
  page: Page,
  index: PreA1Index,
  activityPath: "alphabet" | "phonics" | "picture-match" | "listen-tap",
  activityIndex = 0,
): Promise<void> {
  const unitId = await openPreA1Unit(page, index);
  await page.goto(`/${activityPath}?unit=${unitId}&activity=${activityIndex}`);
}

async function completeAlphabetActivity(page: Page): Promise<void> {
  await expect(page.getByTestId("alphabet-letter")).toHaveText("A");
  for (let i = 0; i < ALPHABET_LENGTH - 1; i++) {
    const next = String.fromCharCode(65 + i + 1);
    await page.getByTestId("btn-alphabet-next").click();
    await expect(page.getByTestId("alphabet-letter")).toHaveText(next);
  }
  await page.getByTestId("btn-alphabet-next").click();
}

async function completePhonicsActivity(page: Page): Promise<void> {
  await expect(page.getByTestId("phonics-choices")).toBeVisible();
  for (let i = 0; i < ALPHABET_LENGTH; i++) {
    const letter = String.fromCharCode(97 + i);
    await page.getByTestId(`phonics-choice-${letter}`).click();
    await expect(page.getByTestId("phonics-feedback")).toBeVisible();
    await page.getByTestId("btn-phonics-next").click();
    if (i < ALPHABET_LENGTH - 1) {
      await expect(page.getByTestId("phonics-feedback")).toHaveCount(0);
      await expect(page.getByTestId("phonics-choices")).toBeVisible();
    }
  }
}

async function completePictureMatchActivity(page: Page): Promise<void> {
  await expect(page.getByTestId("picture-match-choices")).toBeVisible();
  for (let i = 0; i < PICTURE_MATCH_ROUNDS.length; i++) {
    const target = PICTURE_MATCH_ROUNDS[i]!.targetWord;
    await page.getByTestId(`picture-match-choice-${target}`).click();
    await expect(page.getByTestId("picture-match-feedback")).toBeVisible();
    await page.getByTestId("btn-picture-match-next").click();
    if (i < PICTURE_MATCH_ROUNDS.length - 1) {
      await expect(page.getByTestId("picture-match-feedback")).toHaveCount(0);
      await expect(page.getByTestId("picture-match-choices")).toBeVisible();
    }
  }
}

async function completeListenTapActivity(page: Page): Promise<void> {
  await expect(page.getByTestId("listen-tap-choices")).toBeVisible();
  for (let i = 0; i < LISTEN_TAP_ROUNDS.length; i++) {
    const target = LISTEN_TAP_ROUNDS[i]!.targetWord;
    await page.getByTestId(`listen-tap-choice-${target}`).click();
    await expect(page.getByTestId("listen-tap-feedback")).toBeVisible();
    await page.getByTestId("btn-listen-tap-next").click();
    if (i < LISTEN_TAP_ROUNDS.length - 1) {
      await expect(page.getByTestId("listen-tap-feedback")).toHaveCount(0);
      await expect(page.getByTestId("listen-tap-choices")).toBeVisible();
    }
  }
}

async function completeCatalogUnit(
  page: Page,
  pathIndex: number,
  activities: readonly { skill: string }[],
): Promise<void> {
  for (let activityIndex = 0; activityIndex < activities.length; activityIndex++) {
    const skill = activities[activityIndex]!.skill;
    const activityPath =
      skill === "picture-match"
        ? "picture-match"
        : skill === "listen-tap"
          ? "listen-tap"
          : skill === "phonics"
            ? "phonics"
            : "alphabet";
    await startPreA1Activity(page, pathIndex, activityPath, activityIndex);
    if (activityPath === "alphabet") await completeAlphabetActivity(page);
    else if (activityPath === "phonics") await completePhonicsActivity(page);
    else if (activityPath === "picture-match") await completePictureMatchActivity(page);
    else await completeListenTapActivity(page);
  }
  await expect(page.getByTestId("unit-complete-message")).toBeVisible({ timeout: 20_000 });
}

/** Completes every shared-starter pre-A1 unit (standard path or kid island). */
export async function completeAllPreA1Units(page: Page): Promise<void> {
  const templates = buildBundledSharedPathUnitTemplates();
  for (const template of templates) {
    await completeCatalogUnit(page, template.pathIndex, template.activities);
  }
  // Starter catalog only marks Alphabet ready — exam gate needs all four stages (issue #128).
  await markSharedStagesReadyForExam(page, true);
  await page.goto("/home");
  await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("learning-path")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("unit--1")).toHaveAttribute("data-status", "completed", {
    timeout: 30_000,
  });
  // Gate CTA must appear once pre-A1 is done, stages are ready, and the gate is not passed.
  await expect(page.getByTestId("chapter-gate-pending-cta")).toBeVisible({ timeout: 30_000 });
}

/** Admin enrichment bar for e2e — marks every shared pre-A1 stage ready (or not). */
export async function markSharedStagesReadyForExam(
  page: Page,
  readyForExam: boolean,
): Promise<void> {
  const res = await page.request.post("/api/test/shared-path-stages-ready", {
    data: { readyForExam },
  });
  expect(res.ok()).toBe(true);
}

export async function expectGatePendingCta(
  page: Page,
  opts: { title: RegExp | string; gateStatus?: string },
): Promise<void> {
  const cta = page.getByTestId("chapter-gate-pending-cta");
  await expect(cta).toBeVisible({ timeout: 30_000 });
  if (opts.gateStatus) {
    await expect(cta).toHaveAttribute("data-gate-status", opts.gateStatus);
  }
  await expect(cta).toContainText(opts.title);
}

/**
 * Opens the pre-A1 exam from the home CTA.
 *
 * Uses `goto` after asserting the CTA href — client Link + AnimatePresence `mode="wait"`
 * (and Motion hydration under reduced-motion) can leave soft-nav stuck on `/home` while
 * Playwright waits for the exam player.
 */
export async function openChapterExamFromCta(page: Page): Promise<void> {
  const cta = page.getByTestId("chapter-gate-pending-cta");
  await expect(cta).toBeVisible({ timeout: 30_000 });
  await expect(cta).toHaveAttribute("href", "/path/exam/pre-a1");
  await page.goto("/path/exam/pre-a1");
  await expect(page).toHaveURL(/\/path\/exam\/pre-a1\/?$/);

  // Fill is stubbed; still allow a brief loading phase before answering UI.
  const player = page.getByTestId("pre-a1-exam-player");
  const paused = page.getByTestId("pre-a1-exam-paused");
  const error = page.getByTestId("pre-a1-exam-error");
  await expect(player.or(paused).or(error)).toBeVisible({ timeout: 20_000 });
  await expect(player).toBeVisible({ timeout: 5_000 });
}

/** Opens the review checklist from the failed_review CTA (same goto pattern as the exam). */
export async function openChapterReviewFromCta(page: Page): Promise<void> {
  const cta = page.getByTestId("chapter-gate-pending-cta");
  await expect(cta).toBeVisible({ timeout: 30_000 });
  await expect(cta).toHaveAttribute("href", "/path/exam/pre-a1/review");
  await page.goto("/path/exam/pre-a1/review");
  await expect(page).toHaveURL(/\/path\/exam\/pre-a1\/review\/?$/);
  await expect(page.getByTestId("pre-a1-review-checklist")).toBeVisible({ timeout: 20_000 });
}

/** Opens the exam when fill is down and no buffer exists — expects the pause UI. */
export async function openChapterExamPausedFromCta(page: Page): Promise<void> {
  const cta = page.getByTestId("chapter-gate-pending-cta");
  await expect(cta).toBeVisible({ timeout: 30_000 });
  await expect(cta).toHaveAttribute("href", "/path/exam/pre-a1");
  await page.goto("/path/exam/pre-a1");
  await expect(page.getByTestId("pre-a1-exam-paused")).toBeVisible({ timeout: 20_000 });
}

/** Answer every exam item. Stub fill uses answerIndex 0 as correct. */
export async function answerAllExamItems(page: Page, optionIndex: 0 | 1 | 2 | 3): Promise<void> {
  for (let i = 0; i < EXAM_ITEM_COUNT; i++) {
    await page.getByTestId(`pre-a1-exam-item-${i}-opt-${optionIndex}`).click();
  }
}

export async function submitExam(page: Page): Promise<void> {
  await page.getByTestId("pre-a1-exam-submit").click();
  await expect(page.getByTestId("pre-a1-exam-result")).toBeVisible({ timeout: 20_000 });
}

export async function completeReviewChecklist(page: Page): Promise<void> {
  await expect(page.getByTestId("pre-a1-review-checklist")).toBeVisible();
  const items = page
    .getByTestId("pre-a1-review-items")
    .locator("[data-testid^='pre-a1-review-item-']");
  const count = await items.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const testId = await item.getAttribute("data-testid");
    expect(testId).toBeTruthy();
    const id = testId!.replace("pre-a1-review-item-", "");
    await page.getByTestId(`pre-a1-review-done-${id}`).click();
    await expect(item).toHaveAttribute("data-done", "true");
  }

  await expect(page.getByTestId("pre-a1-review-retake")).toBeVisible();
}
