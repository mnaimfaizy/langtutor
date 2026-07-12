/**
 * Issue #120 — Playwright e2e for the pre-A1 chapter mastery gate with Mac stubs.
 *
 * Covers: happy pass unlock, strict fail → review → retake, adult open fail-without-block,
 * buffered score + deferred report, pause when fill unreachable, kid vs adult CTA copy.
 *
 * Uses default admin storageState + authenticated reset (goals.spec / onboarding.spec pattern).
 * HITL: run `pnpm test:e2e` locally — do not execute these specs inside the Docker sandbox.
 */
import { type Page, expect, test } from "./fixtures";
import { stubExamFillFailure, stubExamFillSuccess, stubExamReportFailure } from "./stub-mac-apis";

import {
  answerAllExamItems,
  completeAllPreA1Units,
  completeOnboardingToHome,
  completeReviewChecklist,
  configureAdultPreA1,
  expectGatePendingCta,
  openChapterExamFromCta,
  openChapterExamPausedFromCta,
  openChapterReviewFromCta,
  stubActivityAudio,
  submitExam,
  switchToKidMode,
} from "./pre-a1-mastery-helpers";

test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

test.beforeEach(async ({ page, request }) => {
  test.setTimeout(480_000);
  const res = await request.post("/api/test/reset");
  expect(res.ok()).toBe(true);
  await stubActivityAudio(page);
});

async function setupAdultAtGate(page: Page, progressionMode: "strict" | "open"): Promise<void> {
  await completeOnboardingToHome(page);
  await configureAdultPreA1(page, progressionMode);
  await completeAllPreA1Units(page);
}

test("strict pass unlocks A1 and shows the teacher report", async ({ page }) => {
  await setupAdultAtGate(page, "strict");

  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "locked");
  await expectGatePendingCta(page, {
    title: "Chapter gate pending",
    gateStatus: "pending",
  });

  await openChapterExamFromCta(page);
  await answerAllExamItems(page, 0);
  await submitExam(page);

  await expect(page.getByTestId("pre-a1-exam-outcome")).toContainText(/you passed/i);
  await expect(page.getByTestId("pre-a1-exam-unlocked")).toBeVisible();
  await expect(page.getByTestId("pre-a1-exam-report-ready")).toBeVisible();
  await expect(page.getByTestId("pre-a1-exam-report-headline")).toHaveText("E2E teacher report");

  await page.goto("/home");
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "available");
  await expect(page.getByTestId("chapter-gate-pending-cta")).toHaveCount(0);
});

test("strict fail assigns review; retake after checklist pass unlocks A1", async ({ page }) => {
  await setupAdultAtGate(page, "strict");

  await openChapterExamFromCta(page);
  await answerAllExamItems(page, 1);
  await submitExam(page);

  await expect(page.getByTestId("pre-a1-exam-outcome")).toContainText(/not quite/i);
  await expect(page.getByTestId("pre-a1-exam-review-assigned")).toBeVisible();
  await expect(page.getByTestId("pre-a1-exam-review-preview")).toBeVisible();
  await expect(page.getByTestId("pre-a1-exam-report-ready")).toBeVisible();

  await page.goto("/home");
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "locked");
  await expectGatePendingCta(page, {
    title: "Review assignment waiting",
    gateStatus: "failed_review",
  });

  await openChapterReviewFromCta(page);
  await completeReviewChecklist(page);

  await page.goto("/home");
  await expectGatePendingCta(page, {
    title: "Retake available",
    gateStatus: "ready_retake",
  });

  await openChapterExamFromCta(page);
  await expect(page.getByRole("heading", { name: /retake/i })).toBeVisible();
  await answerAllExamItems(page, 0);
  await submitExam(page);

  await expect(page.getByTestId("pre-a1-exam-outcome")).toContainText(/passed the retake/i);
  await expect(page.getByTestId("pre-a1-exam-unlocked")).toBeVisible();

  await page.goto("/home");
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "available");
  await expect(page.getByTestId("chapter-gate-pending-cta")).toHaveCount(0);
});

test("adult open fail leaves A1 open with report and exam CTA", async ({ page }) => {
  await setupAdultAtGate(page, "open");

  await expectGatePendingCta(page, {
    title: "Chapter exam available",
    gateStatus: "pending",
  });

  await openChapterExamFromCta(page);
  await answerAllExamItems(page, 1);
  await submitExam(page);

  await expect(page.getByTestId("pre-a1-exam-outcome")).toContainText(/not quite/i);
  await expect(page.getByTestId("pre-a1-exam-open-fail")).toBeVisible();
  await expect(page.getByTestId("pre-a1-exam-review-assigned")).toHaveCount(0);
  await expect(page.getByTestId("pre-a1-exam-report-ready")).toBeVisible();

  await page.goto("/home");
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "available");
  await expectGatePendingCta(page, {
    title: "Chapter exam available",
    gateStatus: "pending",
  });
});

test("buffered exam scores when fill is down and defers the teacher report", async ({ page }) => {
  await setupAdultAtGate(page, "strict");

  // Replenish already stored a stub fill. Fail live fill + report so the player
  // uses the buffer and queues a deferred coaching note (issue #118).
  await stubExamFillFailure(page);
  await stubExamReportFailure(page);

  await openChapterExamFromCta(page);
  await expect(page.getByText(/buffered exam offline/i)).toBeVisible();

  await answerAllExamItems(page, 0);
  await submitExam(page);

  await expect(page.getByTestId("pre-a1-exam-outcome")).toContainText(/you passed/i);
  await expect(page.getByTestId("pre-a1-exam-unlocked")).toBeVisible();
  await expect(page.getByTestId("pre-a1-exam-report-deferred")).toBeVisible();

  await page.goto("/home");
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "available");
});

test("pause UI when fill is unreachable and no exam is buffered", async ({ page }) => {
  await completeOnboardingToHome(page);
  await configureAdultPreA1(page, "strict");

  // Fail fill for the whole remaining flow so replenish cannot create a buffer.
  await stubExamFillFailure(page);
  await completeAllPreA1Units(page);

  await expectGatePendingCta(page, { title: "Chapter gate pending", gateStatus: "pending" });
  await openChapterExamPausedFromCta(page);
  await expect(page.getByTestId("pre-a1-exam-pause-retry")).toBeVisible();

  await page.goto("/home");
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "locked");

  // Restore fill so a retry can proceed (sanity that pause is not a free unlock).
  await stubExamFillSuccess(page);
  await openChapterExamFromCta(page);
});

test("kid CTA copy after pre-A1; kids have no progression-mode setting", async ({ page }) => {
  await completeOnboardingToHome(page);
  await switchToKidMode(page);

  await completeAllPreA1Units(page);

  // Island hands off to standard home once pre-A1 is complete.
  await expect(page.getByTestId("learning-path")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "locked");
  await expectGatePendingCta(page, {
    title: "Chapter check waiting",
    gateStatus: "pending",
  });
});
