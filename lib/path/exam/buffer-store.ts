/**
 * Persist / load pre-A1 exam buffer and deferred teacher reports (ADR 0037, issue #118).
 *
 * Uses ContentRepository topics — no schema migration. Buffered fills are playable offline;
 * deferred report rows are drained when the provider returns (via replenishment / session start).
 * Client code never talks to the Mac directly — fill/report use same-origin `app/api/*`.
 */
import { z } from "zod";

import type { Content, ContentRepository, ExperienceMode } from "@/lib/db";

import { PRE_A1_EXAM_BUFFER_TOPIC, PRE_A1_EXAM_DEFERRED_REPORT_TOPIC } from "./buffer";
import { persistPreA1ExamTeacherReport } from "./persist-report";
import { ExamScoreBreakdownSchema, PreA1ExamFillSchema, type PreA1ExamFill } from "./schemas";
import type { ExamScoreBreakdown } from "./scoring";
import {
  PRE_A1_EXAM_REPORT_TOPIC,
  TeacherReportSchema,
  type TeacherReport,
} from "./teacher-report";

const BufferedExamPayloadSchema = z.object({
  exam: PreA1ExamFillSchema,
  bufferedAt: z.string().min(1),
});

const DeferredReportPayloadSchema = z.object({
  attemptContentId: z.number().int().positive(),
  experienceMode: z.enum(["adult", "kid"]),
  breakdown: ExamScoreBreakdownSchema,
  queuedAt: z.string().min(1),
});

export type DeferredTeacherReportJob = z.infer<typeof DeferredReportPayloadSchema>;

export interface BufferedPreA1Exam {
  contentId: number;
  exam: PreA1ExamFill;
  bufferedAt: string;
}

function newestFirst(a: Content, b: Content): number {
  return b.validatedAt.getTime() - a.validatedAt.getTime();
}

/** Store a Zod-validated fill as the playable offline buffer. */
export async function persistBufferedPreA1Exam(
  repo: ContentRepository,
  exam: PreA1ExamFill,
  now: Date = new Date(),
): Promise<number> {
  const parsed = PreA1ExamFillSchema.parse(exam);
  return repo.putContent({
    type: "quiz",
    level: "A1",
    topic: PRE_A1_EXAM_BUFFER_TOPIC,
    payload: {
      exam: parsed,
      bufferedAt: now.toISOString(),
    },
    source: "generated",
    validatedAt: now,
  });
}

/** Latest playable buffered exam, or undefined if none / corrupt. */
export async function loadBufferedPreA1Exam(
  repo: ContentRepository,
): Promise<BufferedPreA1Exam | undefined> {
  const rows = await repo.queryContent({ type: "quiz", topic: PRE_A1_EXAM_BUFFER_TOPIC });
  for (const row of [...rows].sort(newestFirst)) {
    const parsed = BufferedExamPayloadSchema.safeParse(row.payload);
    if (!parsed.success) continue;
    return {
      contentId: row.id,
      exam: parsed.data.exam,
      bufferedAt: parsed.data.bufferedAt,
    };
  }
  return undefined;
}

export async function hasBufferedPreA1Exam(repo: ContentRepository): Promise<boolean> {
  return (await loadBufferedPreA1Exam(repo)) !== undefined;
}

/**
 * Queue a teacher-report generation job for when the provider returns. Score/unlock
 * already happened; this never invents a free-form report client-side.
 */
export async function queueDeferredPreA1TeacherReport(
  repo: ContentRepository,
  args: {
    attemptContentId: number;
    experienceMode: ExperienceMode;
    breakdown: ExamScoreBreakdown;
  },
  now: Date = new Date(),
): Promise<number> {
  const payload = DeferredReportPayloadSchema.parse({
    attemptContentId: args.attemptContentId,
    experienceMode: args.experienceMode,
    breakdown: args.breakdown,
    queuedAt: now.toISOString(),
  });
  return repo.putContent({
    type: "lesson",
    level: "A1",
    topic: PRE_A1_EXAM_DEFERRED_REPORT_TOPIC,
    payload,
    source: "generated",
    validatedAt: now,
  });
}

async function attemptIdsWithTeacherReport(repo: ContentRepository): Promise<Set<number>> {
  const rows = await repo.queryContent({ type: "lesson", topic: PRE_A1_EXAM_REPORT_TOPIC });
  const ids = new Set<number>();
  for (const row of rows) {
    const attemptId =
      row.payload &&
      typeof row.payload === "object" &&
      "attemptContentId" in row.payload &&
      typeof (row.payload as { attemptContentId: unknown }).attemptContentId === "number"
        ? (row.payload as { attemptContentId: number }).attemptContentId
        : undefined;
    if (attemptId !== undefined) ids.add(attemptId);
  }
  return ids;
}

/**
 * Pending deferred jobs (oldest first), skipping attempts that already have a persisted
 * teacher report (drain completion signal without deleteContent).
 */
export async function listDeferredPreA1TeacherReports(
  repo: ContentRepository,
): Promise<Array<{ contentId: number; job: DeferredTeacherReportJob }>> {
  const rows = await repo.queryContent({
    type: "lesson",
    topic: PRE_A1_EXAM_DEFERRED_REPORT_TOPIC,
  });
  const alreadyReported = await attemptIdsWithTeacherReport(repo);
  const seenAttempts = new Set<number>();
  const out: Array<{ contentId: number; job: DeferredTeacherReportJob }> = [];

  for (const row of [...rows].sort((a, b) => a.validatedAt.getTime() - b.validatedAt.getTime())) {
    const parsed = DeferredReportPayloadSchema.safeParse(row.payload);
    if (!parsed.success) continue;
    if (alreadyReported.has(parsed.data.attemptContentId)) continue;
    if (seenAttempts.has(parsed.data.attemptContentId)) continue;
    seenAttempts.add(parsed.data.attemptContentId);
    out.push({ contentId: row.id, job: parsed.data });
  }
  return out;
}

/** Fetch-based report generator (same-origin API). Injectable for tests. */
export type FetchTeacherReportFn = (args: {
  experienceMode: ExperienceMode;
  breakdown: ExamScoreBreakdown;
}) => Promise<TeacherReport>;

/** Default: POST /api/path/exam/report — Mac only via the server route. */
export async function fetchPreA1TeacherReport(args: {
  experienceMode: ExperienceMode;
  breakdown: ExamScoreBreakdown;
}): Promise<TeacherReport> {
  const res = await fetch("/api/path/exam/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      experienceMode: args.experienceMode,
      breakdown: args.breakdown,
    }),
  });
  if (!res.ok) throw new Error(`report failed (${res.status})`);
  const data: unknown = await res.json();
  const parsed = TeacherReportSchema.safeParse(
    data && typeof data === "object" && "report" in data
      ? (data as { report: unknown }).report
      : data,
  );
  if (!parsed.success) throw new Error("invalid report payload");
  return parsed.data;
}

/**
 * Drain queued report jobs via the report API and persist coaching notes.
 * Stops at the first provider failure so the rest retry on the next replenishment pass.
 * Completeness is tracked by the persisted report row (see listDeferred*).
 */
export async function drainDeferredPreA1TeacherReports(
  repo: ContentRepository,
  fetchReport: FetchTeacherReportFn = fetchPreA1TeacherReport,
  now: Date = new Date(),
): Promise<{ drained: number; providerReachable: boolean }> {
  const jobs = await listDeferredPreA1TeacherReports(repo);
  let drained = 0;

  for (const { job } of jobs) {
    try {
      const report = await fetchReport({
        experienceMode: job.experienceMode,
        breakdown: job.breakdown,
      });
      await persistPreA1ExamTeacherReport(repo, job.attemptContentId, report, now);
      drained += 1;
    } catch {
      return { drained, providerReachable: false };
    }
  }

  return { drained, providerReachable: true };
}

/** Fetch-based exam fill (same-origin API). Injectable for tests. */
export type FetchExamFillFn = () => Promise<PreA1ExamFill>;

export async function fetchPreA1ExamFill(): Promise<PreA1ExamFill> {
  const res = await fetch("/api/path/exam/fill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`fill failed (${res.status})`);
  const data: unknown = await res.json();
  const parsed = PreA1ExamFillSchema.safeParse(
    data && typeof data === "object" && "exam" in data ? (data as { exam: unknown }).exam : data,
  );
  if (!parsed.success) throw new Error("invalid exam payload");
  return parsed.data;
}

/**
 * If the gate needs a buffer and none exists, fill via API and persist. Silent on failure.
 * Returns whether the provider still looks reachable after the attempt.
 */
export async function replenishPreA1ExamBuffer(
  repo: ContentRepository,
  needsBuffer: boolean,
  fetchFill: FetchExamFillFn = fetchPreA1ExamFill,
  now: Date = new Date(),
): Promise<boolean> {
  if (!needsBuffer) return true;
  try {
    const exam = await fetchFill();
    await persistBufferedPreA1Exam(repo, exam, now);
    return true;
  } catch {
    return false;
  }
}
