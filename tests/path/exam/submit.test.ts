import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChapterGate, ContentRepository, NewContent, NewUnit, Profile, Unit } from "@/lib/db";
import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import { fillPreA1Exam, PreA1ExamFillSchema, submitPreA1ChapterExam } from "@/lib/path/exam";
import type { LLMClient } from "@/lib/llm/llm-client";
import type { ChatMessage, ChatObjectOptions, ChatOptions } from "@/lib/llm/types";

import { allCorrectAnswers, allWrongAnswers, makeValidExamFill } from "./fixtures";

function makeSequentialLLM(responses: unknown[]): LLMClient {
  let idx = 0;
  return {
    chat: (async <T>(
      _messages: ChatMessage[],
      opts?: ChatOptions | ChatObjectOptions<T>,
    ): Promise<string | T> => {
      const resp = responses[Math.min(idx++, responses.length - 1)];
      if (opts && "schema" in opts) return opts.schema.parse(resp) as T;
      return String(resp);
    }) as LLMClient["chat"],
    streamChat: async () =>
      (async function* (): AsyncGenerator<string> {
        yield "";
      })(),
    embed: async (texts) => texts.map(() => [0]),
    listModels: async () => [],
  };
}

type FakeRepo = ContentRepository & {
  getSavedGate: (tier: string) => ChapterGate | undefined;
  getUnit0: () => Unit | undefined;
  putContents: NewContent[];
};

function makeFakeRepo(units: Unit[]): FakeRepo {
  const state = {
    units: units.slice(),
    chapterGates: new Map<string, ChapterGate>(),
    putContents: [] as NewContent[],
    contentId: 1,
  };
  return {
    putContents: state.putContents,
    getSavedGate(tier: string) {
      return state.chapterGates.get(tier);
    },
    getUnit0() {
      return state.units.find((u) => u.index === 0);
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
      state.putContents.push(content);
      return state.contentId++;
    },
    async getProfile(): Promise<Profile | undefined> {
      return undefined;
    },
  } as unknown as FakeRepo;
}

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 1,
    index: 0,
    title: "Unit",
    teacherNote: "note",
    targetGrammarIds: [],
    targetVocab: [],
    targetCefr: "A1",
    activities: [{ skill: "review" }],
    status: "locked",
    bufferStatus: "empty",
    createdAt: new Date(0),
    ...overrides,
  };
}

describe("fillPreA1Exam", () => {
  it("returns Zod-parsed items on success", async () => {
    const fill = makeValidExamFill();
    const exam = await fillPreA1Exam(makeSequentialLLM([fill]));
    expect(exam.items).toHaveLength(12);
    expect(PreA1ExamFillSchema.safeParse(exam).success).toBe(true);
  });

  it("throws when the LLM returns an invalid shape", async () => {
    const llm = makeSequentialLLM([{ items: [{ skill: "alphabet", prompt: "x" }] }]);
    await expect(fillPreA1Exam(llm)).rejects.toThrow();
  });
});

describe("submitPreA1ChapterExam", () => {
  let dbCounter = 0;
  let db: LangTutorDB;
  let dexieRepo: DexieContentRepository;

  beforeEach(() => {
    db = new LangTutorDB(`pre-a1-exam-submit-${dbCounter++}`);
    dexieRepo = new DexieContentRepository(db);
  });

  afterEach(async () => {
    await db.delete();
    vi.restoreAllMocks();
  });

  it("on pass marks the gate passed and unlocks unit 0", async () => {
    const repo = makeFakeRepo([
      unit({ id: 1, index: -1, status: "completed" }),
      unit({ id: 2, index: 0, status: "locked" }),
    ]);
    const fill = makeValidExamFill();
    const result = await submitPreA1ChapterExam(repo, fill, allCorrectAnswers(fill));

    expect(result.breakdown.passed).toBe(true);
    expect(result.unlockedA1).toBe(true);
    expect(repo.getSavedGate("pre-A1")?.status).toBe("passed");
    expect(repo.getUnit0()?.status).toBe("available");
    expect(repo.putContents).toHaveLength(1);
  });

  it("on fail keeps the gate pending and does not unlock A1", async () => {
    const repo = makeFakeRepo([unit({ id: 2, index: 0, status: "locked" })]);
    const fill = makeValidExamFill();
    const result = await submitPreA1ChapterExam(repo, fill, allWrongAnswers(fill));

    expect(result.breakdown.passed).toBe(false);
    expect(result.unlockedA1).toBe(false);
    expect(repo.getSavedGate("pre-A1")?.status).toBe("pending");
    expect(repo.getUnit0()?.status).toBe("locked");
  });

  it("does not re-unlock or force the exam when the gate is already passed", async () => {
    const repo = makeFakeRepo([unit({ id: 2, index: 0, status: "available" })]);
    await repo.saveChapterGate({
      tier: "pre-A1",
      status: "passed",
      updatedAt: new Date(0),
    });
    const fill = makeValidExamFill();
    const result = await submitPreA1ChapterExam(repo, fill, allCorrectAnswers(fill));

    expect(result.alreadyPassed).toBe(true);
    expect(result.unlockedA1).toBe(false);
    expect(repo.getSavedGate("pre-A1")?.status).toBe("passed");
  });

  it("persists the attempt via ContentRepository (Dexie)", async () => {
    await dexieRepo.addUnit({
      index: 0,
      title: "A1 start",
      teacherNote: "n",
      targetGrammarIds: [],
      targetVocab: [],
      targetCefr: "A1",
      activities: [{ skill: "review" }],
      status: "locked",
      bufferStatus: "empty",
      createdAt: new Date(0),
    });
    const fill = makeValidExamFill();
    const result = await submitPreA1ChapterExam(dexieRepo, fill, allCorrectAnswers(fill));
    const cached = await dexieRepo.getContent(result.contentId);
    expect(cached?.type).toBe("quiz");
    expect(cached?.topic).toBe("chapter-exam:pre-A1");
    expect(await dexieRepo.getChapterGate("pre-A1")).toMatchObject({ status: "passed" });
    const units = await dexieRepo.getUnits();
    expect(units.find((u) => u.index === 0)?.status).toBe("available");
  });
});
