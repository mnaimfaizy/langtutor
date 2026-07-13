import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChapterGate, Content, ContentRepository, NewContent, NewUnit, Unit } from "@/lib/db";
import {
  PRE_A1_EXAM_BUFFER_TOPIC,
  PRE_A1_EXAM_DEFERRED_REPORT_TOPIC,
  PRE_A1_EXAM_REPORT_TOPIC,
  drainDeferredPreA1TeacherReports,
  hasBufferedPreA1Exam,
  listDeferredPreA1TeacherReports,
  loadBufferedPreA1Exam,
  persistBufferedPreA1Exam,
  queueDeferredPreA1TeacherReport,
  replenishPreA1ExamBuffer,
  submitPreA1ChapterExam,
  type TeacherReport,
} from "@/lib/path/exam";
import { replenishPathBuffer } from "@/lib/path/replenish";

import { allCorrectAnswers, makeValidExamFill } from "./fixtures";

type FakeRepo = ContentRepository & {
  contents: Content[];
  units: Unit[];
  getSavedGate: (tier: string) => ChapterGate | undefined;
};

function makeFakeRepo(units: Unit[] = []): FakeRepo {
  const state = {
    units: units.slice(),
    contents: [] as Content[],
    chapterGates: new Map<string, ChapterGate>(),
    nextId: 1,
  };
  return {
    contents: state.contents,
    units: state.units,
    getSavedGate(tier: string) {
      return state.chapterGates.get(tier);
    },
    async getUnits() {
      return state.units;
    },
    async updateUnit(id: number, changes: Partial<NewUnit>) {
      const idx = state.units.findIndex((u) => u.id === id);
      if (idx === -1) return;
      state.units[idx] = { ...state.units[idx]!, ...changes };
    },
    async getChapterGate(tier: string) {
      return state.chapterGates.get(tier);
    },
    async saveChapterGate(gate: ChapterGate) {
      state.chapterGates.set(gate.tier, gate);
    },
    async putContent(content: NewContent) {
      const id = state.nextId++;
      const row: Content = { id, ...content };
      state.contents.push(row);
      return id;
    },
    async getContent(id: number) {
      return state.contents.find((c) => c.id === id);
    },
    async queryContent(query?: {
      type?: Content["type"];
      topic?: string;
      level?: Content["level"];
      source?: Content["source"];
    }) {
      return state.contents.filter((c) => {
        if (query?.type && c.type !== query.type) return false;
        if (query?.topic && c.topic !== query.topic) return false;
        if (query?.level && c.level !== query.level) return false;
        if (query?.source && c.source !== query.source) return false;
        return true;
      });
    },
    async getProfile() {
      return undefined;
    },
    async getSharedPathStages() {
      const ids = ["alphabet", "phonics", "picture-words", "listen-tap"] as const;
      return ids.map((id, order) => ({
        id,
        tier: "pre-A1" as const,
        title: id,
        spineSectionKey: `spine.stages.${id}`,
        order,
        readyForExam: true,
        updatedAt: new Date(0),
      }));
    },
  } as unknown as FakeRepo;
}

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 1,
    index: 0,
    title: "Unit",
    teacherNote: "n",
    targetGrammarIds: [],
    targetVocab: ["hi"],
    targetCefr: "A1",
    activities: [{ skill: "review" }],
    status: "locked",
    bufferStatus: "empty",
    createdAt: new Date(0),
    ...overrides,
  };
}

function completedPreA1Path(): Unit[] {
  return [
    unit({ id: 1, index: -4, status: "completed", bufferStatus: "buffered" }),
    unit({ id: 2, index: -3, status: "completed", bufferStatus: "buffered" }),
    unit({ id: 3, index: -2, status: "completed", bufferStatus: "buffered" }),
    unit({ id: 4, index: -1, status: "completed", bufferStatus: "buffered" }),
    unit({ id: 5, index: 0, status: "locked" }),
  ];
}

describe("exam buffer store", () => {
  it("persists and loads a playable buffered exam", async () => {
    const repo = makeFakeRepo();
    const fill = makeValidExamFill();
    await persistBufferedPreA1Exam(repo, fill);

    expect(await hasBufferedPreA1Exam(repo)).toBe(true);
    const loaded = await loadBufferedPreA1Exam(repo);
    expect(loaded?.exam.items).toHaveLength(12);
    expect(repo.contents.some((c) => c.topic === PRE_A1_EXAM_BUFFER_TOPIC)).toBe(true);
  });

  it("replenishPreA1ExamBuffer stores a fill when needed", async () => {
    const repo = makeFakeRepo();
    const fill = makeValidExamFill();
    const ok = await replenishPreA1ExamBuffer(repo, true, async () => fill);
    expect(ok).toBe(true);
    expect(await hasBufferedPreA1Exam(repo)).toBe(true);
  });

  it("replenishPreA1ExamBuffer reports unreachable on fill failure", async () => {
    const repo = makeFakeRepo();
    const ok = await replenishPreA1ExamBuffer(repo, true, async () => {
      throw new Error("down");
    });
    expect(ok).toBe(false);
    expect(await hasBufferedPreA1Exam(repo)).toBe(false);
  });
});

describe("offline submit + deferred teacher report", () => {
  it("scores a buffered exam without calling the LLM and unlocks on pass", async () => {
    const repo = makeFakeRepo(completedPreA1Path());
    const fill = makeValidExamFill();
    await persistBufferedPreA1Exam(repo, fill);

    const result = await submitPreA1ChapterExam(repo, fill, allCorrectAnswers(fill));

    expect(result.breakdown.passed).toBe(true);
    expect(result.unlockedA1).toBe(true);
    expect(repo.getSavedGate("pre-A1")?.status).toBe("passed");
  });

  it("queues a deferred report when AI is down at submit time", async () => {
    const repo = makeFakeRepo(completedPreA1Path());
    const fill = makeValidExamFill();
    const result = await submitPreA1ChapterExam(repo, fill, allCorrectAnswers(fill));

    await queueDeferredPreA1TeacherReport(repo, {
      attemptContentId: result.contentId,
      experienceMode: "kid",
      breakdown: result.breakdown,
    });

    const pending = await listDeferredPreA1TeacherReports(repo);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.job.attemptContentId).toBe(result.contentId);
    expect(repo.contents.some((c) => c.topic === PRE_A1_EXAM_DEFERRED_REPORT_TOPIC)).toBe(true);
  });

  it("drains deferred reports when the provider returns", async () => {
    const repo = makeFakeRepo(completedPreA1Path());
    const fill = makeValidExamFill();
    const result = await submitPreA1ChapterExam(repo, fill, allCorrectAnswers(fill));
    await queueDeferredPreA1TeacherReport(repo, {
      attemptContentId: result.contentId,
      experienceMode: "adult",
      breakdown: result.breakdown,
    });

    const report: TeacherReport = {
      headline: "Nice work",
      body: "You did well on the chapter exam.",
      encouragement: "Keep going!",
      focusSkills: [],
    };

    const drained = await drainDeferredPreA1TeacherReports(repo, async () => report);
    expect(drained).toEqual({ drained: 1, providerReachable: true });
    expect(await listDeferredPreA1TeacherReports(repo)).toHaveLength(0);
    expect(repo.contents.some((c) => c.topic === PRE_A1_EXAM_REPORT_TOPIC)).toBe(true);
  });

  it("stops draining when the report fetch fails", async () => {
    const repo = makeFakeRepo(completedPreA1Path());
    const fill = makeValidExamFill();
    const result = await submitPreA1ChapterExam(repo, fill, allCorrectAnswers(fill));
    await queueDeferredPreA1TeacherReport(repo, {
      attemptContentId: result.contentId,
      experienceMode: "kid",
      breakdown: result.breakdown,
    });

    const drained = await drainDeferredPreA1TeacherReports(repo, async () => {
      throw new Error("AI down");
    });
    expect(drained).toEqual({ drained: 0, providerReachable: false });
    expect(await listDeferredPreA1TeacherReports(repo)).toHaveLength(1);
  });
});

describe("replenishPathBuffer — exam buffer", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ plans: [] })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pre-buffers the next chapter exam when the gate is pending", async () => {
    const repo = makeFakeRepo(completedPreA1Path());
    await repo.saveChapterGate({
      tier: "pre-A1",
      status: "pending",
      updatedAt: new Date(0),
    });
    const fill = makeValidExamFill();

    await replenishPathBuffer(
      repo,
      3,
      async () => 1,
      undefined,
      async () => fill,
      async () => {
        throw new Error("no deferred");
      },
    );

    expect(await hasBufferedPreA1Exam(repo)).toBe(true);
  });

  it("does not unlock A1 when exam buffer fill fails (pause path)", async () => {
    const repo = makeFakeRepo(completedPreA1Path());
    await repo.saveChapterGate({
      tier: "pre-A1",
      status: "pending",
      updatedAt: new Date(0),
    });

    await replenishPathBuffer(
      repo,
      3,
      async () => 1,
      undefined,
      async () => {
        throw new Error("unreachable");
      },
    );

    expect(await hasBufferedPreA1Exam(repo)).toBe(false);
    expect(repo.getSavedGate("pre-A1")?.status).toBe("pending");
    expect(repo.units.find((u) => u.index === 0)?.status).toBe("locked");
  });
});
