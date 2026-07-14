/**
 * Issue #132 — Playwright e2e for shared pre-A1 cache + exam readiness (Mac stubs).
 *
 * Covers: shared starter titles match the bundled catalog, chapter-growing while stages
 * are not ready, admin mark-ready unlocking the exam CTA, seeded pending draft → approve,
 * and stubbed `/api/path/shared-draft` never contacting live Ollama.
 *
 * HITL: run `pnpm test:e2e` locally/CI — do not execute these specs inside the agent sandbox.
 */
import type { Browser } from "@playwright/test";
import { type Page, expect, test } from "./fixtures";
import { MOCK_SHARED_PATH_PENDING_TEMPLATE, stubMacApis } from "./stub-mac-apis";

import {
  PRE_A1_FIRST_PATH_INDEX,
  PRE_A1_UNIT_COUNT,
  buildBundledSharedPathUnitTemplates,
} from "@/lib/path/shared-path-catalog";
import { shortUnitTitle } from "@/lib/path/stages";
import { PRE_A1_STAGE_IDS } from "@/lib/db";

import { AUTH_FILE } from "./auth-constants";
import {
  completeOnboardingToHome,
  configureAdultPreA1,
  expectGatePendingCta,
  stubActivityAudio,
} from "./pre-a1-mastery-helpers";

const E2E_PENDING_ID = MOCK_SHARED_PATH_PENDING_TEMPLATE.id;

test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

test.beforeEach(async ({ page, request }) => {
  test.setTimeout(180_000);
  const res = await request.post("/api/test/reset");
  expect(res.ok()).toBe(true);
  await stubActivityAudio(page);
});

async function openAdminSharedPath(page: Page): Promise<void> {
  await page.goto("/admin/path");
  await expect(page.getByRole("heading", { name: "Shared path cache" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("shared-path-stages")).toBeVisible();
}

async function markAllStagesReadyViaAdminUi(page: Page): Promise<void> {
  await openAdminSharedPath(page);
  for (const stageId of PRE_A1_STAGE_IDS) {
    const row = page.getByTestId(`shared-path-stage-${stageId}`);
    await expect(row).toBeVisible();
    if ((await row.getAttribute("data-ready")) === "true") continue;
    await page.getByTestId(`shared-path-ready-${stageId}`).click();
    await expect(row).toHaveAttribute("data-ready", "true", { timeout: 15_000 });
  }
  await expect(page.getByTestId("shared-path-banner")).toContainText(/ready for exam/i);
}

async function seedPendingSharedDraft(browser: Browser): Promise<void> {
  const seed = await browser.newContext({
    storageState: AUTH_FILE,
    serviceWorkers: "block",
  });
  try {
    const page = await seed.newPage();
    await stubMacApis(page);
    const res = await page.request.post("/api/test/shared-path-template", {
      data: { action: "put-pending", id: E2E_PENDING_ID },
    });
    expect(res.ok()).toBe(true);
  } finally {
    await seed.close();
  }
}

/** Seed completed pre-A1 + locked A1 without playing Alphabet runways. */
async function markPreA1UnitsCompleted(page: Page): Promise<void> {
  const res = await page.request.post("/api/test/pre-a1-units-complete");
  expect(res.ok()).toBe(true);
}

test("shared starter titles match the bundled catalog for every learner path", async ({ page }) => {
  await completeOnboardingToHome(page);
  await configureAdultPreA1(page, "strict");

  const expected = buildBundledSharedPathUnitTemplates().map((t) => shortUnitTitle(t.title));
  expect(expected).toHaveLength(PRE_A1_UNIT_COUNT);

  for (let i = 0; i < PRE_A1_UNIT_COUNT; i++) {
    const index = PRE_A1_FIRST_PATH_INDEX + i;
    const node = page.getByTestId(`unit-${index}`);
    await expect(node).toBeVisible({ timeout: 30_000 });
    await expect(node).toContainText(expected[i]!);
    if (i >= 3) {
      await expect(node).toHaveAttribute("data-richness", "placeholder");
    }
  }

  await expect(page.getByTestId(`unit-${PRE_A1_FIRST_PATH_INDEX}`)).toHaveAttribute(
    "data-status",
    "available",
  );
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "locked");
});

test("completed pre-A1 shows chapter-growing until admin marks stages ready", async ({ page }) => {
  await completeOnboardingToHome(page);
  await configureAdultPreA1(page, "strict");
  await markPreA1UnitsCompleted(page);

  await page.goto("/home");
  await expect(page.getByTestId("unit--1")).toHaveAttribute("data-status", "completed", {
    timeout: 30_000,
  });
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "locked");
  await expect(page.getByTestId("chapter-growing-banner")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("chapter-gate-pending-cta")).toHaveCount(0);

  await markAllStagesReadyViaAdminUi(page);

  await page.goto("/home");
  await expect(page.getByTestId("chapter-growing-banner")).toHaveCount(0);
  await expectGatePendingCta(page, {
    title: "Chapter gate pending",
    gateStatus: "pending",
  });
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "locked");
});

test("admin approves a seeded shared pending draft; shared-draft route stays stubbed", async ({
  page,
  browser,
}) => {
  await seedPendingSharedDraft(browser);

  await openAdminSharedPath(page);
  const pendingRow = page.getByTestId(`shared-path-template-${E2E_PENDING_ID}`);
  await expect(page.getByTestId("shared-path-pending")).toBeVisible();
  await expect(pendingRow).toBeVisible();
  await expect(pendingRow).toHaveAttribute("data-approval", "pending");
  await expect(pendingRow).toContainText("E2E draft");
  await expect(page.getByTestId(`shared-path-vocab-${E2E_PENDING_ID}`)).toBeVisible();
  await expect(page.getByTestId(`shared-path-vocab-word-${E2E_PENDING_ID}-cat`)).toHaveAttribute(
    "data-image",
    "missing",
  );
  await expect(page.getByTestId(`shared-path-media-summary-${E2E_PENDING_ID}`)).toContainText(
    /need image and\/or audio/i,
  );
  await expect(page.getByTestId(`shared-path-try-${E2E_PENDING_ID}`)).toHaveAttribute(
    "href",
    `/phonics?previewTemplate=${E2E_PENDING_ID}`,
  );

  await page.getByTestId(`shared-path-approve-${E2E_PENDING_ID}`).click();
  await expect(page.getByTestId("shared-path-banner")).toContainText(/Approved/i);
  await expect(
    page.getByTestId("shared-path-approved").getByTestId(`shared-path-template-${E2E_PENDING_ID}`),
  ).toBeVisible();
  await expect(
    page.getByTestId("shared-path-pending").getByTestId(`shared-path-template-${E2E_PENDING_ID}`),
  ).toHaveCount(0);

  // Mac isolation: browser POST is intercepted by stubMacApis (no live Ollama).
  const stubbed = await page.evaluate(async () => {
    const res = await fetch("/api/path/shared-draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "draft", stageId: "phonics" }),
    });
    return { status: res.status, body: await res.json() };
  });
  expect(stubbed.status).toBe(200);
  expect(stubbed.body.template.id).toBe(MOCK_SHARED_PATH_PENDING_TEMPLATE.id);
  expect(stubbed.body.template.approvalStatus).toBe("pending");
});
