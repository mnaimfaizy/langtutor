/**
 * Persist a teacher report linked to a scored pre-A1 chapter exam attempt (issue #116).
 *
 * Unlock/pass already happened in {@link submitPreA1ChapterExam}; this only stores the
 * coaching report so it survives reload. Uses putContent (no updateContent on the seam).
 */
import type { ContentRepository } from "@/lib/db";

import { PRE_A1_CHAPTER_TIER } from "../chapter-gate";
import { PRE_A1_EXAM_REPORT_TOPIC, type TeacherReport } from "./teacher-report";

export async function persistPreA1ExamTeacherReport(
  repo: ContentRepository,
  attemptContentId: number,
  report: TeacherReport,
  now: Date = new Date(),
): Promise<number> {
  return repo.putContent({
    type: "lesson",
    level: "A1",
    topic: PRE_A1_EXAM_REPORT_TOPIC,
    payload: {
      attemptContentId,
      tier: PRE_A1_CHAPTER_TIER,
      report,
    },
    source: "generated",
    validatedAt: now,
  });
}
