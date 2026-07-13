"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { DEFAULT_EXPERIENCE_MODE, type ExperienceMode } from "@/lib/db";
import {
  PRE_A1_CHAPTER_TIER,
  arePreA1StagesReadyForExam,
  resolveChapterGateStatus,
} from "@/lib/path/chapter-gate";
import {
  isPreA1ExamGatePaused,
  isPreA1ExamStartAllowed,
  loadBufferedPreA1Exam,
  persistBufferedPreA1Exam,
  persistPreA1ExamTeacherReport,
  preferFreshExamFill,
  PreA1ExamFillSchema,
  PRE_A1_EXAM_OVERALL_THRESHOLD,
  PRE_A1_EXAM_SKILL_FLOOR,
  PRE_A1_EXAM_SKILLS,
  preA1ExamItemCount,
  queueDeferredPreA1TeacherReport,
  submitPreA1ChapterExam,
  TeacherReportSchema,
  type ExamScoreBreakdown,
  type PreA1ExamFill,
  type PreA1ExamSkill,
  type ReviewAssignment,
  type TeacherReport,
} from "@/lib/path/exam";
import { getContentRepository } from "@/lib/registry";
import { BackLink, Button, Card, SelectPill } from "@/ui";

type Phase =
  | "loading"
  | "already-passed"
  | "not-ready"
  | "review-required"
  | "paused"
  | "answering"
  | "submitting"
  | "result"
  | "error";
type ReportPhase = "idle" | "loading" | "ready" | "deferred";

const SKILL_LABEL: Record<PreA1ExamSkill, string> = {
  alphabet: "Alphabet",
  phonics: "Phonics",
  "picture-words": "Picture words",
  "listen-tap": "Listen & tap",
};

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

async function fetchFreshExamFill(): Promise<PreA1ExamFill> {
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

export function PreA1ExamPlayer() {
  const [loadNonce, setLoadNonce] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [exam, setExam] = useState<PreA1ExamFill | null>(null);
  const [selected, setSelected] = useState<(number | null)[]>([]);
  const [breakdown, setBreakdown] = useState<ExamScoreBreakdown | null>(null);
  const [unlockedA1, setUnlockedA1] = useState(false);
  const [reviewAssigned, setReviewAssigned] = useState(false);
  const [reviewAssignment, setReviewAssignment] = useState<ReviewAssignment | null>(null);
  const [wasRetake, setWasRetake] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>(DEFAULT_EXPERIENCE_MODE);
  const [reportPhase, setReportPhase] = useState<ReportPhase>("idle");
  const [report, setReport] = useState<TeacherReport | null>(null);
  const [usedBufferedExam, setUsedBufferedExam] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      const repo = getContentRepository();
      const [gate, profile, units, stages] = await Promise.all([
        repo.getChapterGate(PRE_A1_CHAPTER_TIER),
        repo.getProfile(),
        repo.getUnits(),
        repo.getSharedPathStages(),
      ]);
      if (!active) return;

      setExperienceMode(profile?.experienceMode ?? DEFAULT_EXPERIENCE_MODE);

      const status = resolveChapterGateStatus(gate);
      if (status === "passed") {
        setPhase("already-passed");
        return;
      }
      const stagesReadyForExam = arePreA1StagesReadyForExam(stages);
      if (!stagesReadyForExam) {
        setPhase("not-ready");
        return;
      }
      if (!isPreA1ExamStartAllowed(status)) {
        setPhase("review-required");
        return;
      }

      setWasRetake(status === "ready_retake");
      const buffered = await loadBufferedPreA1Exam(repo);
      const hasBuffer = buffered !== undefined;

      // Prefer a fresh fill when online (especially retakes); fall back to buffer offline.
      if (preferFreshExamFill({ providerReachable: true, isRetake: status === "ready_retake" })) {
        try {
          const fresh = await fetchFreshExamFill();
          if (!active) return;
          // Keep the offline buffer topped up with this fill for a later outage.
          await persistBufferedPreA1Exam(repo, fresh);
          setExam(fresh);
          setSelected(new Array<number | null>(fresh.items.length).fill(null));
          setUsedBufferedExam(false);
          setPhase("answering");
          return;
        } catch {
          // Provider unreachable — use buffer or pause below.
        }
      }

      if (buffered) {
        if (!active) return;
        setExam(buffered.exam);
        setSelected(new Array<number | null>(buffered.exam.items.length).fill(null));
        setUsedBufferedExam(true);
        setPhase("answering");
        return;
      }

      if (
        isPreA1ExamGatePaused({
          units,
          gateStatus: status,
          hasBufferedExam: hasBuffer,
          providerReachable: false,
          stagesReadyForExam: true,
        })
      ) {
        if (!active) return;
        setPhase("paused");
        return;
      }

      if (!active) return;
      setErrorDetail("no buffered exam and provider unreachable");
      setPhase("error");
    })();

    return () => {
      active = false;
    };
  }, [loadNonce]);

  function retryLoad() {
    setExam(null);
    setErrorDetail(null);
    setUsedBufferedExam(false);
    setPhase("loading");
    setLoadNonce((n) => n + 1);
  }

  function select(itemIndex: number, optionIndex: number) {
    setSelected((prev) => {
      const next = [...prev];
      next[itemIndex] = optionIndex;
      return next;
    });
  }

  const allAnswered =
    exam !== null && selected.length === exam.items.length && selected.every((s) => s !== null);

  async function fetchAndPersistReport(
    attemptContentId: number,
    score: ExamScoreBreakdown,
    mode: ExperienceMode,
  ) {
    setReportPhase("loading");
    try {
      const res = await fetch("/api/path/exam/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceMode: mode, breakdown: score }),
      });
      if (!res.ok) throw new Error(`report failed (${res.status})`);
      const data: unknown = await res.json();
      const parsed = TeacherReportSchema.safeParse(
        data && typeof data === "object" && "report" in data
          ? (data as { report: unknown }).report
          : data,
      );
      if (!parsed.success) throw new Error("invalid report payload");

      const repo = getContentRepository();
      await persistPreA1ExamTeacherReport(repo, attemptContentId, parsed.data);
      setReport(parsed.data);
      setReportPhase("ready");
    } catch {
      const repo = getContentRepository();
      await queueDeferredPreA1TeacherReport(repo, {
        attemptContentId,
        experienceMode: mode,
        breakdown: score,
      });
      setReport(null);
      setReportPhase("deferred");
    }
  }

  async function handleSubmit() {
    if (!exam || !allAnswered || phase === "submitting") return;
    setPhase("submitting");
    try {
      const repo = getContentRepository();
      // Local deterministic score — works offline from a buffered fill (ADR 0037 / #118).
      const result = await submitPreA1ChapterExam(repo, exam, selected);
      setBreakdown(result.breakdown);
      setUnlockedA1(result.unlockedA1);
      setReviewAssigned(result.reviewAssigned);
      setReviewAssignment(result.reviewAssignment ?? null);
      setPhase("result");
      // Score/unlock already finished — report is best-effort and may defer until AI returns.
      void fetchAndPersistReport(result.contentId, result.breakdown, experienceMode);
    } catch {
      setErrorDetail("submit failed");
      setPhase("error");
    }
  }

  if (phase === "loading") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8" data-testid="pre-a1-exam-loading">
        <BackLink href="/home" label="Home" className="mb-6" />
        <p className="text-muted text-sm">Preparing your chapter exam…</p>
      </main>
    );
  }

  if (phase === "already-passed") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8" data-testid="pre-a1-exam-already-passed">
        <BackLink href="/home" label="Home" className="mb-6" />
        <Card>
          <h1 className="text-foreground text-xl font-semibold">Chapter exam already passed</h1>
          <p className="text-muted mt-2 text-sm">
            You already cleared the Pre-A1 gate. Continue into A1 on your path.
          </p>
          <Link href="/home" className="mt-6 inline-block">
            <Button variant="primary">Back to home</Button>
          </Link>
        </Card>
      </main>
    );
  }

  if (phase === "not-ready") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8" data-testid="pre-a1-exam-not-ready">
        <BackLink href="/home" label="Home" className="mb-6" />
        <Card>
          <h1 className="text-foreground text-xl font-semibold">Chapter still growing</h1>
          <p className="text-muted mt-2 text-sm">
            The chapter exam opens once every pre-A1 stage is marked ready. Head home — you are not
            stuck; shared enrichment is still landing for everyone.
          </p>
          <Link href="/home" className="mt-6 inline-block">
            <Button variant="primary">Back to home</Button>
          </Link>
        </Card>
      </main>
    );
  }

  if (phase === "review-required") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8" data-testid="pre-a1-exam-review-required">
        <BackLink href="/home" label="Home" className="mb-6" />
        <Card>
          <h1 className="text-foreground text-xl font-semibold">Finish your review first</h1>
          <p className="text-muted mt-2 text-sm">
            The teacher assigned practice after your last attempt. Complete every checklist item
            before the retake is available. A1 stays locked until you pass.
          </p>
          <Link href="/path/exam/pre-a1/review" className="mt-6 inline-block">
            <Button variant="primary">Open review checklist</Button>
          </Link>
        </Card>
      </main>
    );
  }

  if (phase === "paused") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8" data-testid="pre-a1-exam-paused">
        <BackLink href="/home" label="Home" className="mb-6" />
        <Card>
          <h1 className="text-foreground text-xl font-semibold">Chapter exam on pause</h1>
          <p className="text-muted mt-2 text-sm">
            The teacher exam isn&apos;t buffered yet and the AI isn&apos;t reachable right now. A1
            stays locked — no free unlock. Try again when you&apos;re back online, or review
            vocabulary while you wait.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={retryLoad} data-testid="pre-a1-exam-pause-retry">
              Try again
            </Button>
            <Link href="/review">
              <Button variant="ghost">Review vocabulary</Button>
            </Link>
            <Link href="/home">
              <Button variant="ghost">Back to home</Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8" data-testid="pre-a1-exam-error">
        <BackLink href="/home" label="Home" className="mb-6" />
        <Card>
          <h1 className="text-foreground text-xl font-semibold">Could not start the exam</h1>
          <p className="text-muted mt-2 text-sm">
            The teacher could not fill the exam items right now
            {errorDetail ? ` (${errorDetail})` : ""}. A1 stays locked until a valid exam is taken.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={retryLoad}>
              Try again
            </Button>
            <Link href="/home">
              <Button variant="ghost">Back to home</Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  if (phase === "result" && breakdown) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8" data-testid="pre-a1-exam-result">
        <BackLink href="/home" label="Home" className="mb-6" />
        <Card>
          <h1 className="text-foreground text-xl font-semibold" data-testid="pre-a1-exam-outcome">
            {breakdown.passed
              ? wasRetake
                ? "Chapter complete — you passed the retake!"
                : "You passed!"
              : "Not quite yet"}
          </h1>
          <p className="text-muted mt-2 text-sm">
            Overall {pct(breakdown.overallRatio)} ({breakdown.overallCorrect}/
            {breakdown.overallTotal}). Pass needs {pct(PRE_A1_EXAM_OVERALL_THRESHOLD)} overall and{" "}
            {pct(PRE_A1_EXAM_SKILL_FLOOR)} in every skill.
          </p>
          {unlockedA1 && breakdown.passed && (
            <p
              className="text-accent mt-2 text-sm font-medium"
              data-testid="pre-a1-exam-unlocked"
              data-chapter-complete={wasRetake || undefined}
            >
              {wasRetake
                ? "Pre-A1 chapter complete — Level A1 is unlocked. Celebrate and continue on your path!"
                : "Level A1 is unlocked — continue on your path."}
            </p>
          )}
          {!breakdown.passed && reviewAssigned && (
            <p className="text-muted mt-2 text-sm" data-testid="pre-a1-exam-review-assigned">
              A1 stays locked. Complete the teacher’s review assignment, then retake and pass the
              exam.
            </p>
          )}
          {!breakdown.passed && !reviewAssigned && (
            <p className="text-muted mt-2 text-sm" data-testid="pre-a1-exam-open-fail">
              {unlockedA1
                ? "Level A1 is open on your path. Read your teacher report below — retake anytime for a better score."
                : "A1 stays available on your path. Read your teacher report below — retake anytime for a better score."}
            </p>
          )}

          <ul className="mt-6 flex flex-col gap-2" data-testid="pre-a1-exam-skill-scores">
            {breakdown.bySkill.map((skill) => (
              <li
                key={skill.skill}
                className="border-border flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                data-testid={`pre-a1-exam-skill-${skill.skill}`}
              >
                <span className="text-foreground font-medium">{SKILL_LABEL[skill.skill]}</span>
                <span className={skill.metFloor ? "text-foreground" : "text-danger"}>
                  {pct(skill.ratio)} ({skill.correct}/{skill.total})
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-4" data-testid="pre-a1-exam-teacher-report">
          <h2 className="text-foreground text-lg font-semibold">Teacher report</h2>
          {reportPhase === "loading" && (
            <p className="text-muted mt-2 text-sm" data-testid="pre-a1-exam-report-pending">
              Your teacher is writing a coaching note…
            </p>
          )}
          {reportPhase === "deferred" && (
            <p className="text-muted mt-2 text-sm" data-testid="pre-a1-exam-report-deferred">
              Score saved. The teacher report will appear when the AI is reachable again.
            </p>
          )}
          {reportPhase === "ready" && report && (
            <div data-testid="pre-a1-exam-report-ready">
              <p
                className="text-foreground mt-2 text-base font-medium"
                data-testid="pre-a1-exam-report-headline"
              >
                {report.headline}
              </p>
              <p className="text-foreground mt-3 text-sm leading-relaxed">{report.body}</p>
              <p className="text-accent mt-3 text-sm font-medium">{report.encouragement}</p>
              {report.focusSkills.length > 0 && (
                <p className="text-muted mt-3 text-xs">
                  Focus next: {report.focusSkills.map((s) => SKILL_LABEL[s]).join(", ")}
                </p>
              )}
            </div>
          )}
        </Card>

        {reviewAssigned && reviewAssignment && (
          <Card className="mt-4" data-testid="pre-a1-exam-review-preview">
            <h2 className="text-foreground text-lg font-semibold">Review assignment</h2>
            <ul className="mt-3 flex flex-col gap-1">
              {reviewAssignment.items.map((item) => (
                <li key={item.id} className="text-foreground text-sm">
                  · {item.label}
                </li>
              ))}
            </ul>
            <Link href="/path/exam/pre-a1/review" className="mt-4 inline-block">
              <Button variant="primary">Open review checklist</Button>
            </Link>
          </Card>
        )}

        <Link href="/home" className="mt-8 inline-block">
          <Button
            variant={unlockedA1 || (!breakdown.passed && !reviewAssigned) ? "primary" : "secondary"}
          >
            Back to home
          </Button>
        </Link>
      </main>
    );
  }

  if (!exam) return null;

  const sections = PRE_A1_EXAM_SKILLS.map((skill) => ({
    skill,
    entries: exam.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.skill === skill),
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-8" data-testid="pre-a1-exam-player">
      <BackLink href="/home" label="Home" className="mb-6" />
      <h1 className="text-foreground text-xl font-semibold">
        {wasRetake ? "Pre-A1 chapter exam — retake" : "Pre-A1 chapter exam"}
      </h1>
      <p className="text-muted mt-1 text-sm">
        {preA1ExamItemCount()} questions across alphabet, phonics, picture words, and listen &amp;
        tap. Answer every item, then submit once.
        {usedBufferedExam ? " (Playing a buffered exam offline.)" : ""}
      </p>

      <ol className="mt-6 flex flex-col gap-8">
        {sections.map(({ skill, entries }) => (
          <li key={skill}>
            <h2 className="text-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
              {SKILL_LABEL[skill]}
            </h2>
            <ol className="flex flex-col gap-4">
              {entries.map(({ item, index }) => (
                <li key={index} data-testid={`pre-a1-exam-item-${index}`}>
                  <Card>
                    <p className="text-foreground text-base font-medium">{item.prompt}</p>
                    <div className="mt-3 flex flex-col gap-2">
                      {item.options.map((option, optionIndex) => (
                        <SelectPill
                          key={optionIndex}
                          selected={selected[index] === optionIndex}
                          onClick={() => select(index, optionIndex)}
                          data-testid={`pre-a1-exam-item-${index}-opt-${optionIndex}`}
                        >
                          {option}
                        </SelectPill>
                      ))}
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex items-center gap-3">
        <Button
          variant="primary"
          size="lg"
          disabled={!allAnswered || phase === "submitting"}
          onClick={() => void handleSubmit()}
          data-testid="pre-a1-exam-submit"
        >
          {phase === "submitting" ? "Scoring…" : "Submit exam"}
        </Button>
        {!allAnswered && <p className="text-muted text-xs">Answer every question to submit.</p>}
      </div>
    </main>
  );
}
