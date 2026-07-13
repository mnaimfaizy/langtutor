"use client";

import Link from "next/link";
import { useState } from "react";

import type { PreA1StageId, SharedPathStage, SharedPathUnitTemplate } from "@/lib/db";
import {
  BackLink,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  buttonClassName,
  cn,
} from "@/ui";

import {
  approveSharedPathDraft,
  draftSharedPathStageUnit,
  fillThinSharedPathStagesAction,
  listSharedPathCatalog,
  markSharedPathStageReady,
  rejectSharedPathDraft,
} from "./actions";

/** Mirrors `AI_DRAFTABLE_STAGE_IDS` — kept inline so this client file never imports guide loaders. */
const DRAFTABLE_STAGES = ["phonics", "picture-words", "listen-tap"] as const;
type DraftableStageId = (typeof DRAFTABLE_STAGES)[number];

type Banner = { tone: "ok" | "error"; text: string } | null;

function formatWhen(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function TemplateRow({
  template,
  busy,
  onApprove,
  onReject,
}: {
  template: SharedPathUnitTemplate;
  busy: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  return (
    <li
      className="border-border flex flex-col gap-3 border-b py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between"
      data-testid={`shared-path-template-${template.id}`}
      data-approval={template.approvalStatus}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-foreground font-medium">{template.title}</p>
          <Badge variant="neutral">{template.stageId}</Badge>
          <Badge variant="neutral">{template.richness}</Badge>
          <Badge variant="neutral">{template.provenance}</Badge>
        </div>
        <p className="text-muted text-sm">{template.teacherNote}</p>
        <p className="text-muted text-xs">
          pathIndex {template.pathIndex} · updated {formatWhen(template.updatedAt)}
        </p>
      </div>
      {(onApprove || onReject) && (
        <div className="flex shrink-0 flex-wrap gap-2">
          {onApprove && (
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              data-testid={`shared-path-approve-${template.id}`}
              onClick={onApprove}
            >
              Approve
            </Button>
          )}
          {onReject && (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              data-testid={`shared-path-reject-${template.id}`}
              onClick={onReject}
            >
              Reject
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function StageRow({
  stage,
  busy,
  onToggleReady,
}: {
  stage: SharedPathStage;
  busy: boolean;
  onToggleReady: (ready: boolean) => void;
}) {
  return (
    <li
      className="border-border flex flex-col gap-3 border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
      data-testid={`shared-path-stage-${stage.id}`}
      data-ready={stage.readyForExam ? "true" : "false"}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-foreground font-medium">{stage.title}</p>
          <Badge variant={stage.readyForExam ? "success" : "neutral"}>
            {stage.readyForExam ? "Ready for exam" : "Not ready"}
          </Badge>
        </div>
        <p className="text-muted text-xs">
          {stage.spineSectionKey} · updated {formatWhen(stage.updatedAt)}
        </p>
      </div>
      <Button
        variant={stage.readyForExam ? "secondary" : "primary"}
        size="sm"
        disabled={busy}
        data-testid={`shared-path-ready-${stage.id}`}
        onClick={() => onToggleReady(!stage.readyForExam)}
      >
        {stage.readyForExam ? "Clear ready" : "Mark ready for exam"}
      </Button>
    </li>
  );
}

export function SharedPathReviewClient({
  initialPending,
  initialApproved,
  initialRejected,
  initialStages,
}: {
  initialPending: SharedPathUnitTemplate[];
  initialApproved: SharedPathUnitTemplate[];
  initialRejected: SharedPathUnitTemplate[];
  initialStages: SharedPathStage[];
}) {
  const [pending, setPending] = useState(initialPending);
  const [approved, setApproved] = useState(initialApproved);
  const [rejected, setRejected] = useState(initialRejected);
  const [stages, setStages] = useState(initialStages);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);

  async function refresh() {
    const snapshot = await listSharedPathCatalog();
    setPending(snapshot.pending);
    setApproved(snapshot.approved);
    setRejected(snapshot.rejected);
    setStages(snapshot.stages);
  }

  async function handleApprove(id: string) {
    setBusyId(id);
    setBanner(null);
    try {
      await approveSharedPathDraft(id);
      await refresh();
      setBanner({
        tone: "ok",
        text: "Approved — available to all learners from the shared catalog.",
      });
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Approve failed",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    setBanner(null);
    try {
      await rejectSharedPathDraft(id);
      await refresh();
      setBanner({
        tone: "ok",
        text: "Rejected — kept off all learners.",
      });
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Reject failed",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleReady(stageId: PreA1StageId, readyForExam: boolean) {
    setBusyId(`stage:${stageId}`);
    setBanner(null);
    try {
      await markSharedPathStageReady(stageId, readyForExam);
      await refresh();
      setBanner({
        tone: "ok",
        text: readyForExam
          ? `Marked ${stageId} ready for exam for every learner.`
          : `Cleared ready-for-exam on ${stageId}.`,
      });
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Update failed",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDraft(stageId: DraftableStageId) {
    setBusyId(`draft:${stageId}`);
    setBanner(null);
    try {
      const template = await draftSharedPathStageUnit(stageId);
      await refresh();
      setBanner({
        tone: "ok",
        text: `Drafted “${template.title}” into shared pending for everyone.`,
      });
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Draft failed",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleBackgroundFill() {
    setBusyId("background-fill");
    setBanner(null);
    try {
      const result = await fillThinSharedPathStagesAction();
      await refresh();
      const n = result.drafted.length;
      setBanner({
        tone: n > 0 || result.failures.length === 0 ? "ok" : "error",
        text:
          n > 0
            ? `Background fill enqueued ${n} shared pending draft(s).`
            : result.failures.length > 0
              ? `Background fill failed: ${result.failures[0]?.message ?? "unknown"}`
              : "Later stages already have rich or pending drafts — nothing to fill.",
      });
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Background fill failed",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href="/settings" label="Settings" />
      <h1 className="text-foreground mt-2 text-2xl font-semibold">Shared path cache</h1>
      <p className="text-muted mt-1 text-sm">
        Admin-only. Approve or reject shared pre-A1 drafts once for every learner — there is no
        per-user approval queue.
      </p>
      <nav aria-label="Admin sections" className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/admin/users"
          className={buttonClassName({ variant: "ghost", size: "sm" })}
          data-testid="admin-users-link"
        >
          Users
        </Link>
        <Link
          href="/admin/media"
          className={buttonClassName({ variant: "ghost", size: "sm" })}
          data-testid="admin-image-media-link"
        >
          Image media
        </Link>
        <Link
          href="/admin/media/audio"
          className={buttonClassName({ variant: "ghost", size: "sm" })}
          data-testid="admin-audio-media-link"
        >
          Audio review
        </Link>
        <span className={buttonClassName({ variant: "secondary", size: "sm" })} aria-current="page">
          Shared path
        </span>
      </nav>

      {banner && (
        <p
          className={cn("mt-4 text-sm", banner.tone === "ok" ? "text-success" : "text-danger")}
          role="status"
          data-testid="shared-path-banner"
        >
          {banner.text}
        </p>
      )}

      <Card className="mt-6" data-testid="shared-path-stages">
        <CardTitle>Stages — ready for exam</CardTitle>
        <CardDescription>
          Marks the enrichment bar for the pre-A1 chapter exam. One toggle applies to all learners.
        </CardDescription>
        <CardContent>
          {stages.length === 0 ? (
            <p className="text-muted text-sm">No stages in the shared catalog yet.</p>
          ) : (
            <ul>
              {stages.map((stage) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  busy={busyId === `stage:${stage.id}`}
                  onToggleReady={(ready) => void handleReady(stage.id, ready)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6" data-testid="shared-path-draft">
        <CardTitle>AI densification</CardTitle>
        <CardDescription>
          Draft later-stage units into the shared pending queue (Phonics / Picture words / Listen
          &amp; tap). Alphabet stays human-authored. Never invents a private learner path.
        </CardDescription>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {DRAFTABLE_STAGES.map((stageId) => (
              <Button
                key={stageId}
                variant="secondary"
                size="sm"
                disabled={busyId !== null}
                data-testid={`shared-path-draft-${stageId}`}
                onClick={() => void handleDraft(stageId)}
              >
                Draft {stageId}
              </Button>
            ))}
            <Button
              variant="primary"
              size="sm"
              disabled={busyId !== null}
              data-testid="shared-path-background-fill"
              onClick={() => void handleBackgroundFill()}
            >
              Fill thin stages
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6" data-testid="shared-path-pending">
        <CardTitle>Pending drafts</CardTitle>
        <CardDescription>
          AI or human drafts waiting for a single shared approval before learners can receive them.
        </CardDescription>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted text-sm" data-testid="shared-path-pending-empty">
              No pending drafts.
            </p>
          ) : (
            <ul>
              {pending.map((template) => (
                <TemplateRow
                  key={template.id}
                  template={template}
                  busy={busyId === template.id}
                  onApprove={() => void handleApprove(template.id)}
                  onReject={() => void handleReject(template.id)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6" data-testid="shared-path-approved">
        <CardTitle>Approved catalog</CardTitle>
        <CardDescription>
          Units materialize for every eligible learner from these shared templates.
        </CardDescription>
        <CardContent>
          {approved.length === 0 ? (
            <p className="text-muted text-sm">No approved templates.</p>
          ) : (
            <ul>
              {approved.map((template) => (
                <TemplateRow
                  key={template.id}
                  template={template}
                  busy={busyId === template.id}
                  onReject={() => void handleReject(template.id)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {rejected.length > 0 && (
        <Card className="mt-6" data-testid="shared-path-rejected">
          <CardTitle>Rejected</CardTitle>
          <CardDescription>
            Kept off all learners. Approve later if you change your mind.
          </CardDescription>
          <CardContent>
            <ul>
              {rejected.map((template) => (
                <TemplateRow
                  key={template.id}
                  template={template}
                  busy={busyId === template.id}
                  onApprove={() => void handleApprove(template.id)}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
