import { describe, expect, it } from "vitest";

import type { Unit } from "@/lib/db";
import {
  isPreA1ExamGatePaused,
  preferFreshExamFill,
  shouldBufferPreA1Exam,
} from "@/lib/path/exam/buffer";

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 1,
    index: -1,
    title: "Pre-A1",
    teacherNote: "n",
    targetGrammarIds: [],
    targetVocab: [],
    targetCefr: "A1",
    activities: [{ skill: "alphabet" }],
    status: "completed",
    bufferStatus: "buffered",
    createdAt: new Date(0),
    ...overrides,
  };
}

function completedPreA1Units(): Unit[] {
  return [
    unit({ id: 1, index: -4 }),
    unit({ id: 2, index: -3 }),
    unit({ id: 3, index: -2 }),
    unit({ id: 4, index: -1 }),
    unit({ id: 5, index: 0, status: "locked", title: "A1" }),
  ];
}

describe("shouldBufferPreA1Exam", () => {
  it("buffers when pre-A1 is complete, gate startable, and buffer empty", () => {
    expect(
      shouldBufferPreA1Exam({
        units: completedPreA1Units(),
        gateStatus: "pending",
        hasBufferedExam: false,
      }),
    ).toBe(true);
  });

  it("does not buffer when a playable exam is already stored", () => {
    expect(
      shouldBufferPreA1Exam({
        units: completedPreA1Units(),
        gateStatus: "pending",
        hasBufferedExam: true,
      }),
    ).toBe(false);
  });

  it("does not buffer after the gate is passed", () => {
    expect(
      shouldBufferPreA1Exam({
        units: completedPreA1Units(),
        gateStatus: "passed",
        hasBufferedExam: false,
      }),
    ).toBe(false);
  });

  it("does not buffer during failed_review (checklist first)", () => {
    expect(
      shouldBufferPreA1Exam({
        units: completedPreA1Units(),
        gateStatus: "failed_review",
        hasBufferedExam: false,
      }),
    ).toBe(false);
  });

  it("buffers again once review is done (ready_retake)", () => {
    expect(
      shouldBufferPreA1Exam({
        units: completedPreA1Units(),
        gateStatus: "ready_retake",
        hasBufferedExam: false,
      }),
    ).toBe(true);
  });

  it("does not buffer before pre-A1 chapter is complete", () => {
    const units = completedPreA1Units();
    units[3] = unit({ id: 4, index: -1, status: "in-progress" });
    expect(
      shouldBufferPreA1Exam({
        units,
        gateStatus: "pending",
        hasBufferedExam: false,
      }),
    ).toBe(false);
  });
});

describe("isPreA1ExamGatePaused", () => {
  it("pauses when gate needed, buffer empty, and provider unreachable", () => {
    expect(
      isPreA1ExamGatePaused({
        units: completedPreA1Units(),
        gateStatus: "pending",
        hasBufferedExam: false,
        providerReachable: false,
      }),
    ).toBe(true);
  });

  it("does not pause when a buffered exam is available", () => {
    expect(
      isPreA1ExamGatePaused({
        units: completedPreA1Units(),
        gateStatus: "pending",
        hasBufferedExam: true,
        providerReachable: false,
      }),
    ).toBe(false);
  });

  it("does not pause when the provider is reachable", () => {
    expect(
      isPreA1ExamGatePaused({
        units: completedPreA1Units(),
        gateStatus: "pending",
        hasBufferedExam: false,
        providerReachable: true,
      }),
    ).toBe(false);
  });

  it("does not pause during failed_review", () => {
    expect(
      isPreA1ExamGatePaused({
        units: completedPreA1Units(),
        gateStatus: "failed_review",
        hasBufferedExam: false,
        providerReachable: false,
      }),
    ).toBe(false);
  });
});

describe("preferFreshExamFill", () => {
  it("prefers fresh when the provider is reachable", () => {
    expect(preferFreshExamFill({ providerReachable: true, isRetake: true })).toBe(true);
    expect(preferFreshExamFill({ providerReachable: true, isRetake: false })).toBe(true);
  });

  it("does not prefer fresh when offline", () => {
    expect(preferFreshExamFill({ providerReachable: false, isRetake: true })).toBe(false);
  });
});
