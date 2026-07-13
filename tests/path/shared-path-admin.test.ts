/**
 * Issue #129 — admin shared-cache queue: approve / reject / ready-for-exam.
 * One shared mutation must affect every learner profile equally — no per-user queue.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Profile, SharedPathUnitTemplate } from "@/lib/db";
import * as schema from "@/lib/db/drizzle/schema";
import { SqliteContentRepository } from "@/lib/db/sqlite-content-repository";
import { arePreA1StagesReadyForExam } from "@/lib/path/chapter-gate";
import { ensurePath } from "@/lib/path/seed";
import {
  approveSharedPathUnitTemplate,
  rejectSharedPathUnitTemplate,
  setSharedPathStageReadyForExam,
} from "@/lib/path/shared-path-admin";
import {
  buildBundledSharedPathStages,
  ensureSharedPathCatalogSeeded,
  materializePreA1UnitsFromCatalog,
} from "@/lib/path/shared-path-catalog";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle/migrations");

let sqlite: ReturnType<typeof Database>;

beforeEach(() => {
  sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
});

afterEach(() => {
  sqlite.close();
});

function makeRepo(userId: string) {
  return new SqliteContentRepository(drizzle(sqlite, { schema }), userId);
}

function kidProfile(): Profile {
  return {
    goals: [],
    createdAt: new Date(0),
    settings: {},
    cefrLevel: "A1",
    experienceMode: "kid",
  };
}

function pendingDraft(overrides: Partial<SharedPathUnitTemplate> = {}): SharedPathUnitTemplate {
  const now = new Date("2026-07-13T00:00:00.000Z");
  return {
    id: "pre-a1.phonics.ai-draft",
    tier: "pre-A1",
    stageId: "phonics",
    stageOrder: 1,
    // After starter phonics placeholder (−3); unique pathIndex for the shared table.
    pathIndex: -30,
    title: "Pre-A1: Phonics — AI draft",
    teacherNote: "Pending admin review.",
    activities: [{ skill: "phonics" }],
    richness: "rich",
    approvalStatus: "pending",
    provenance: "ai-draft",
    targetVocab: ["cat"],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("shared path admin queue (issue #129)", () => {
  it("approve makes a draft visible to both learners; reject does not", async () => {
    const admin = makeRepo("admin");
    const learnerA = makeRepo("learner-a");
    const learnerB = makeRepo("learner-b");

    await ensureSharedPathCatalogSeeded(admin);
    const draft = pendingDraft();
    await admin.putSharedPathUnitTemplate(draft);

    // Pending: neither learner materializes the draft.
    const pendingCatalog = await learnerA.querySharedPathUnitTemplates({
      approvalStatus: "approved",
    });
    expect(pendingCatalog.some((t) => t.id === draft.id)).toBe(false);
    expect(
      materializePreA1UnitsFromCatalog(pendingCatalog).some((u) => u.title === draft.title),
    ).toBe(false);

    // Same shared read from learner B.
    expect(
      (await learnerB.querySharedPathUnitTemplates({ approvalStatus: "approved" })).some(
        (t) => t.id === draft.id,
      ),
    ).toBe(false);

    await approveSharedPathUnitTemplate(admin, draft.id);

    const approvedA = await learnerA.querySharedPathUnitTemplates({ approvalStatus: "approved" });
    const approvedB = await learnerB.querySharedPathUnitTemplates({ approvalStatus: "approved" });
    expect(approvedA.some((t) => t.id === draft.id)).toBe(true);
    expect(approvedB.some((t) => t.id === draft.id)).toBe(true);
    expect(materializePreA1UnitsFromCatalog(approvedA).some((u) => u.title === draft.title)).toBe(
      true,
    );
    expect(materializePreA1UnitsFromCatalog(approvedB).some((u) => u.title === draft.title)).toBe(
      true,
    );

    // Fresh kid seeds both pick up the newly approved shared unit (no per-user queue).
    await ensurePath(learnerA, kidProfile());
    await ensurePath(learnerB, kidProfile());
    const titlesA = (await learnerA.getUnits()).map((u) => u.title);
    const titlesB = (await learnerB.getUnits()).map((u) => u.title);
    expect(titlesA).toContain(draft.title);
    expect(titlesB).toContain(draft.title);

    // Reject a second draft — stays off both learners.
    const rejectedDraft = pendingDraft({
      id: "pre-a1.picture-words.ai-draft",
      stageId: "picture-words",
      pathIndex: -31,
      title: "Pre-A1: Picture words — rejected draft",
    });
    await admin.putSharedPathUnitTemplate(rejectedDraft);
    await rejectSharedPathUnitTemplate(admin, rejectedDraft.id);

    expect(
      (await learnerA.querySharedPathUnitTemplates({ approvalStatus: "approved" })).some(
        (t) => t.id === rejectedDraft.id,
      ),
    ).toBe(false);
    expect(
      (await learnerB.querySharedPathUnitTemplates({ approvalStatus: "approved" })).some(
        (t) => t.id === rejectedDraft.id,
      ),
    ).toBe(false);
    expect(
      (await admin.querySharedPathUnitTemplates({ approvalStatus: "rejected" })).some(
        (t) => t.id === rejectedDraft.id,
      ),
    ).toBe(true);
  });

  it("mark ready-for-exam is shared — both learners see the same enrichment bar", async () => {
    const admin = makeRepo("admin");
    const learnerA = makeRepo("learner-a");
    const learnerB = makeRepo("learner-b");

    for (const stage of buildBundledSharedPathStages()) {
      await admin.putSharedPathStage({ ...stage, readyForExam: false });
    }

    expect(arePreA1StagesReadyForExam(await learnerA.getSharedPathStages())).toBe(false);
    expect(arePreA1StagesReadyForExam(await learnerB.getSharedPathStages())).toBe(false);

    for (const stage of buildBundledSharedPathStages()) {
      await setSharedPathStageReadyForExam(admin, stage.id, true);
    }

    const stagesA = await learnerA.getSharedPathStages();
    const stagesB = await learnerB.getSharedPathStages();
    expect(arePreA1StagesReadyForExam(stagesA)).toBe(true);
    expect(arePreA1StagesReadyForExam(stagesB)).toBe(true);
    expect(stagesA.map((s) => ({ id: s.id, readyForExam: s.readyForExam }))).toEqual(
      stagesB.map((s) => ({ id: s.id, readyForExam: s.readyForExam })),
    );
  });

  it("lists pending vs approved distinctly on the shared catalog", async () => {
    const admin = makeRepo("admin");
    await ensureSharedPathCatalogSeeded(admin);
    await admin.putSharedPathUnitTemplate(pendingDraft());

    const pending = await admin.querySharedPathUnitTemplates({ approvalStatus: "pending" });
    const approved = await admin.querySharedPathUnitTemplates({ approvalStatus: "approved" });

    expect(pending.map((t) => t.id)).toContain("pre-a1.phonics.ai-draft");
    expect(approved.every((t) => t.approvalStatus === "approved")).toBe(true);
    expect(approved.some((t) => t.id === "pre-a1.phonics.ai-draft")).toBe(false);
    expect(approved.length).toBeGreaterThan(0);
  });
});
