import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentRepository, NewContent, Profile } from "@/lib/db";
import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import type { LLMClient } from "@/lib/llm/llm-client";
import type { ChatMessage, ChatObjectOptions, ChatOptions } from "@/lib/llm/types";
import {
  buildPreA1TeacherReportMessages,
  generatePreA1TeacherReport,
  persistPreA1ExamTeacherReport,
  PRE_A1_CURRICULUM_GUIDE_STUB,
  PRE_A1_EXAM_REPORT_TOPIC,
  TeacherReportSchema,
  type ExamScoreBreakdown,
  type TeacherReport,
} from "@/lib/path/exam";

import { makeValidExamFill, allCorrectAnswers, allWrongAnswers } from "./fixtures";
import { scorePreA1Exam } from "@/lib/path/exam/scoring";

const VALID_REPORT: TeacherReport = {
  headline: "Great effort on the chapter exam",
  body: "You did well on alphabet and picture words. Phonics needs a bit more practice with letter sounds.",
  encouragement: "Keep practicing — you are getting stronger every day.",
  focusSkills: ["phonics"],
};

function breakdownFromAnswers(correct: boolean): ExamScoreBreakdown {
  const fill = makeValidExamFill();
  return scorePreA1Exam(fill, correct ? allCorrectAnswers(fill) : allWrongAnswers(fill));
}

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

function makeUnreachableLLM(): LLMClient {
  return {
    chat: (async () => {
      throw new Error("ECONNREFUSED");
    }) as LLMClient["chat"],
    streamChat: async () => {
      throw new Error("ECONNREFUSED");
    },
    embed: async () => {
      throw new Error("ECONNREFUSED");
    },
    listModels: async () => {
      throw new Error("ECONNREFUSED");
    },
  };
}

describe("TeacherReportSchema", () => {
  it("accepts a well-formed report", () => {
    expect(TeacherReportSchema.safeParse(VALID_REPORT).success).toBe(true);
  });

  it("rejects an empty headline", () => {
    expect(TeacherReportSchema.safeParse({ ...VALID_REPORT, headline: "" }).success).toBe(false);
  });

  it("rejects unknown focus skills", () => {
    expect(
      TeacherReportSchema.safeParse({ ...VALID_REPORT, focusSkills: ["grammar"] }).success,
    ).toBe(false);
  });
});

describe("buildPreA1TeacherReportMessages", () => {
  const breakdown = breakdownFromAnswers(false);

  it("uses a professional-teacher persona in adult mode", () => {
    const [system] = buildPreA1TeacherReportMessages({
      experienceMode: "adult",
      breakdown,
    });
    expect(system.content).toMatch(/professional/i);
    expect(system.content).not.toMatch(/kindergarten/i);
  });

  it("uses a kindergarten-teacher persona in kid mode", () => {
    const [system] = buildPreA1TeacherReportMessages({
      experienceMode: "kid",
      breakdown,
    });
    expect(system.content).toMatch(/kindergarten/i);
    expect(system.content).not.toMatch(/professional/i);
  });

  it("injects the pre-A1 curriculum guide stub", () => {
    const [system] = buildPreA1TeacherReportMessages({
      experienceMode: "adult",
      breakdown,
    });
    expect(system.content).toContain(PRE_A1_CURRICULUM_GUIDE_STUB.slice(0, 40));
  });

  it("grounds the user message in the score breakdown", () => {
    const [, user] = buildPreA1TeacherReportMessages({
      experienceMode: "adult",
      breakdown,
    });
    expect(user.content).toMatch(/NOT PASSED|PASSED/);
    expect(user.content).toMatch(/alphabet/);
    expect(user.content).toMatch(/phonics/);
  });

  it("asks for simpler wording in kid mode than adult mode", () => {
    const [, adultUser] = buildPreA1TeacherReportMessages({
      experienceMode: "adult",
      breakdown,
    });
    const [, kidUser] = buildPreA1TeacherReportMessages({
      experienceMode: "kid",
      breakdown,
    });
    expect(kidUser.content).toMatch(/simple/i);
    expect(adultUser.content).not.toBe(kidUser.content);
  });
});

describe("generatePreA1TeacherReport", () => {
  it("returns a Zod-validated report on success", async () => {
    const report = await generatePreA1TeacherReport(makeSequentialLLM([VALID_REPORT]), {
      experienceMode: "adult",
      breakdown: breakdownFromAnswers(true),
    });
    expect(TeacherReportSchema.safeParse(report).success).toBe(true);
    expect(report.headline).toBe(VALID_REPORT.headline);
  });

  it("corrective-retries on malformed output, then succeeds", async () => {
    const chatSpy = vi
      .fn()
      .mockResolvedValueOnce({ headline: "missing other fields" })
      .mockResolvedValueOnce(VALID_REPORT);
    const llm: LLMClient = {
      chat: (async <T>(_msgs: ChatMessage[], opts?: ChatOptions | ChatObjectOptions<T>) => {
        const resp: unknown = await chatSpy();
        if (opts && "schema" in opts) return opts.schema.parse(resp) as T;
        return String(resp);
      }) as LLMClient["chat"],
      streamChat: async () =>
        (async function* () {
          yield "";
        })(),
      embed: async () => [],
      listModels: async () => [],
    };

    const report = await generatePreA1TeacherReport(llm, {
      experienceMode: "kid",
      breakdown: breakdownFromAnswers(false),
    });

    expect(chatSpy).toHaveBeenCalledTimes(2);
    expect(report.body).toBe(VALID_REPORT.body);
  });

  it("throws when the provider is unreachable after retries", async () => {
    await expect(
      generatePreA1TeacherReport(makeUnreachableLLM(), {
        experienceMode: "adult",
        breakdown: breakdownFromAnswers(true),
      }),
    ).rejects.toThrow(/failed|ECONNREFUSED/i);
  });
});

describe("persistPreA1ExamTeacherReport", () => {
  let dbCounter = 0;
  let db: LangTutorDB;
  let repo: DexieContentRepository;

  beforeEach(() => {
    db = new LangTutorDB(`pre-a1-exam-report-${dbCounter++}`);
    repo = new DexieContentRepository(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it("persists the report linked to the attempt content id", async () => {
    const reportId = await persistPreA1ExamTeacherReport(repo, 42, VALID_REPORT);
    const stored = await repo.getContent(reportId);
    expect(stored?.type).toBe("lesson");
    expect(stored?.topic).toBe(PRE_A1_EXAM_REPORT_TOPIC);
    expect(stored?.payload).toMatchObject({
      attemptContentId: 42,
      tier: "pre-A1",
      report: VALID_REPORT,
    });
  });

  it("works with a fake repo (open-mode adults still persist)", async () => {
    const putContents: NewContent[] = [];
    const fake = {
      async putContent(content: NewContent) {
        putContents.push(content);
        return putContents.length;
      },
      async getProfile(): Promise<Profile | undefined> {
        return {
          experienceMode: "adult",
          settings: { progressionMode: "open" },
        } as Profile;
      },
    } as unknown as ContentRepository;

    await persistPreA1ExamTeacherReport(fake, 7, VALID_REPORT);
    expect(putContents).toHaveLength(1);
    expect(putContents[0]?.payload).toMatchObject({ attemptContentId: 7 });
  });
});
