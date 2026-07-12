"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { MediaAssetKey, MediaAssetRecord } from "@/lib/db/schema";
import {
  BackLink,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  buttonClassName,
  cn,
} from "@/ui";

import {
  approveMediaAsset,
  getMediaAssetPreview,
  getProactivePromptDraft,
  getRegeneratePromptDraft,
  listImageCurriculumGaps,
  proactiveGenerateMediaAsset,
  purgeMediaAsset,
  regenerateMediaAsset,
} from "./actions";

type Banner = { tone: "ok" | "error"; text: string } | null;

type RegenerateTarget = {
  asset: MediaAssetRecord;
  draftPrompt: string;
};

const TEXTAREA_CLASS =
  "border-border bg-card text-foreground placeholder:text-muted focus-visible:border-accent focus-visible:ring-accent focus-visible:ring-offset-background w-full resize-y rounded-lg border px-3 py-2 text-sm leading-6 transition-[colors,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60";

function assetId(asset: MediaAssetRecord): string {
  return `${asset.kind}:${asset.key}:${asset.style}`;
}

function AssetPreview({ assetKey }: { assetKey: MediaAssetKey }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const { kind, key, style } = assetKey;

  useEffect(() => {
    let cancelled = false;
    // Depend on primitives — a fresh key object every parent render would re-fire
    // this effect after each server-action RSC refresh and loop forever.
    void getMediaAssetPreview({ kind, key, style })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, key, style]);

  if (failed) {
    return (
      <div className="bg-muted text-muted flex h-24 w-24 items-center justify-center rounded-lg text-xs">
        Preview unavailable
      </div>
    );
  }

  if (!src) {
    return <div className="bg-muted h-24 w-24 animate-pulse rounded-lg" aria-hidden />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- admin-only data URLs from server action
    <img
      src={src}
      alt={`Illustration for ${key}`}
      className="border-border h-24 w-24 rounded-lg border object-cover"
    />
  );
}

function AssetRow({
  asset,
  busy,
  onApprove,
  onPurge,
  onRegenerate,
}: {
  asset: MediaAssetRecord;
  busy: boolean;
  onApprove?: () => void;
  onPurge: () => void;
  onRegenerate?: () => void;
}) {
  const assetKey: MediaAssetKey = {
    kind: asset.kind,
    key: asset.key,
    style: asset.style,
  };

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <AssetPreview assetKey={assetKey} />
        <div className="min-w-0">
          <p className="text-foreground truncate text-sm font-medium">{asset.key}</p>
          <p className="text-muted mt-0.5 text-xs">{asset.style}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant={asset.approvalStatus === "approved" ? "success" : "warning"} size="sm">
              {asset.approvalStatus}
            </Badge>
            <Badge variant="neutral" size="sm">
              {asset.source}
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {onApprove && (
          <Button variant="primary" size="sm" disabled={busy} onClick={onApprove}>
            Approve
          </Button>
        )}
        {onRegenerate && (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={onRegenerate}
            data-testid="media-regenerate"
          >
            Regenerate
          </Button>
        )}
        <Button variant="secondary" size="sm" disabled={busy} onClick={onPurge}>
          Purge
        </Button>
      </div>
    </li>
  );
}

function RegenerateDialogBody({
  asset,
  initialPrompt,
  busy,
  onConfirm,
}: {
  asset: MediaAssetRecord;
  initialPrompt: string;
  busy: boolean;
  onConfirm: (prompt: string) => void;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);

  return (
    <>
      <DialogTitle>Regenerate “{asset.key}”</DialogTitle>
      <DialogDescription>
        Learners will not see an image for this word until you approve the new generation.
      </DialogDescription>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="media-regenerate-prompt" className="text-foreground text-sm font-medium">
            Prompt
          </label>
          <p className="text-muted mt-1 text-xs">
            Pre-filled from the last stored prompt, or the default kid-illustration template.
          </p>
          <textarea
            id="media-regenerate-prompt"
            data-testid="media-regenerate-prompt"
            rows={5}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            disabled={busy}
            className={cn(TEXTAREA_CLASS, "mt-2")}
          />
        </div>

        <p className="text-warning text-sm" role="status" data-testid="media-regenerate-warning">
          Regenerating replaces the current image and creates a pending gap for learners until you
          re-approve.
        </p>

        <div className="flex justify-end gap-2">
          <DialogClose disabled={busy}>Cancel</DialogClose>
          <Button
            variant="primary"
            disabled={busy || prompt.trim().length === 0}
            data-testid="media-regenerate-confirm"
            onClick={() => onConfirm(prompt)}
          >
            {busy ? "Regenerating…" : "Regenerate"}
          </Button>
        </div>
      </div>
    </>
  );
}

function RegenerateDialog({
  target,
  busy,
  onOpenChange,
  onConfirm,
}: {
  target: RegenerateTarget | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (prompt: string) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(90vw,36rem)]" data-testid="media-regenerate-dialog">
        {target && (
          <RegenerateDialogBody
            key={assetId(target.asset)}
            asset={target.asset}
            initialPrompt={target.draftPrompt}
            busy={busy}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function MediaReviewClient({
  initialPending,
  initialApproved,
  initialCurriculumGaps,
}: {
  initialPending: MediaAssetRecord[];
  initialApproved: MediaAssetRecord[];
  initialCurriculumGaps: string[];
}) {
  const [pending, setPending] = useState(initialPending);
  const [approved, setApproved] = useState(initialApproved);
  const [curriculumGaps, setCurriculumGaps] = useState(initialCurriculumGaps);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<RegenerateTarget | null>(null);
  const [proactiveWord, setProactiveWord] = useState("");
  const [proactivePrompt, setProactivePrompt] = useState("");
  const [proactiveBusy, setProactiveBusy] = useState(false);

  const runAction = useCallback(
    async (id: string, action: () => Promise<void>, success: string) => {
      setBusyId(id);
      setBanner(null);
      try {
        await action();
        setBanner({ tone: "ok", text: success });
      } catch (err) {
        setBanner({
          tone: "error",
          text: err instanceof Error ? err.message : "Action failed",
        });
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  async function handleApprove(asset: MediaAssetRecord) {
    const id = assetId(asset);
    const key: MediaAssetKey = { kind: asset.kind, key: asset.key, style: asset.style };
    await runAction(
      id,
      async () => {
        await approveMediaAsset(key);
        setPending((prev) => prev.filter((a) => assetId(a) !== id));
        setApproved((prev) => [...prev, { ...asset, approvalStatus: "approved" }]);
      },
      `Approved "${asset.key}".`,
    );
  }

  async function handlePurge(asset: MediaAssetRecord, list: "pending" | "approved") {
    const id = assetId(asset);
    const key: MediaAssetKey = { kind: asset.kind, key: asset.key, style: asset.style };
    await runAction(
      id,
      async () => {
        await purgeMediaAsset(key);
        if (list === "pending") {
          setPending((prev) => prev.filter((a) => assetId(a) !== id));
        } else {
          setApproved((prev) => prev.filter((a) => assetId(a) !== id));
        }
      },
      `Purged "${asset.key}".`,
    );
  }

  async function openRegenerate(asset: MediaAssetRecord) {
    const id = assetId(asset);
    setBusyId(id);
    setBanner(null);
    try {
      const draftPrompt = await getRegeneratePromptDraft({
        kind: asset.kind,
        key: asset.key,
        style: asset.style,
      });
      setRegenerateTarget({ asset, draftPrompt });
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not load prompt",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRegenerateConfirm(prompt: string) {
    const target = regenerateTarget;
    if (!target) return;
    const { asset } = target;
    const id = assetId(asset);
    const key: MediaAssetKey = { kind: asset.kind, key: asset.key, style: asset.style };
    setBusyId(id);
    setBanner(null);
    try {
      const updated = await regenerateMediaAsset(key, prompt);
      setApproved((prev) => prev.filter((a) => assetId(a) !== id));
      setPending((prev) => {
        const without = prev.filter((a) => assetId(a) !== id);
        return [...without, updated];
      });
      setRegenerateTarget(null);
      setBanner({
        tone: "ok",
        text: `Regenerated "${asset.key}" — pending approval before learners can see it.`,
      });
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Regeneration failed",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function refreshCurriculumGaps() {
    try {
      const gaps = await listImageCurriculumGaps();
      setCurriculumGaps(gaps);
    } catch {
      // Keep the prior list; banner already covers generate failures.
    }
  }

  async function loadProactivePromptForWord(word: string) {
    const trimmed = word.trim();
    if (!trimmed) {
      setProactivePrompt("");
      return;
    }
    try {
      const draft = await getProactivePromptDraft(trimmed);
      setProactivePrompt(draft);
    } catch {
      setProactivePrompt("");
    }
  }

  async function handleProactiveGenerate(word: string, prompt: string) {
    const trimmed = word.trim();
    if (!trimmed) {
      setBanner({ tone: "error", text: "Enter a word to generate." });
      return;
    }
    setProactiveBusy(true);
    setBusyId(`proactive:${trimmed.toLowerCase()}`);
    setBanner(null);
    try {
      const result = await proactiveGenerateMediaAsset(
        trimmed,
        prompt.trim().length > 0 ? prompt : undefined,
      );
      if (!result.ok) {
        setBanner({ tone: "error", text: result.message });
        return;
      }
      const created = result.asset;
      const id = assetId(created);
      setPending((prev) => {
        const without = prev.filter((a) => assetId(a) !== id);
        return [...without, created];
      });
      setCurriculumGaps((prev) => prev.filter((w) => w !== created.key));
      setProactiveWord("");
      setProactivePrompt("");
      setBanner({
        tone: "ok",
        text: `Generated "${created.key}" — pending approval before learners can see it.`,
      });
      void refreshCurriculumGaps();
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Generation failed",
      });
    } finally {
      setProactiveBusy(false);
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href="/settings" label="Settings" />
      <h1 className="text-foreground mt-2 text-2xl font-semibold">Media review</h1>
      <p className="text-muted mt-1 text-sm">
        Admin-only. Approve generated kid illustrations before learners can see them.
      </p>
      <nav aria-label="Admin sections" className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/admin/users"
          className={buttonClassName({ variant: "ghost", size: "sm" })}
          data-testid="admin-users-link"
        >
          Users
        </Link>
        <span className={buttonClassName({ variant: "secondary", size: "sm" })} aria-current="page">
          Image media
        </span>
        <Link
          href="/admin/media/audio"
          className={buttonClassName({ variant: "ghost", size: "sm" })}
          data-testid="admin-audio-media-link"
        >
          Audio review
        </Link>
      </nav>

      {banner && (
        <p
          className={cn("mt-4 text-sm", banner.tone === "ok" ? "text-success" : "text-danger")}
          role="status"
          data-testid="media-banner"
        >
          {banner.text}
        </p>
      )}

      <Card className="mt-6" data-testid="media-proactive-generate">
        <CardTitle>Proactive generate</CardTitle>
        <CardDescription>
          Create a pending illustration for a word with no media row yet — no learner miss required.
        </CardDescription>
        <CardContent className="space-y-3">
          <div>
            <label htmlFor="media-proactive-word" className="text-foreground text-sm font-medium">
              Word
            </label>
            <Input
              id="media-proactive-word"
              data-testid="media-proactive-word"
              value={proactiveWord}
              onChange={(event) => {
                const next = event.target.value;
                setProactiveWord(next);
              }}
              onBlur={() => void loadProactivePromptForWord(proactiveWord)}
              disabled={proactiveBusy}
              placeholder="e.g. xylophone"
              className="mt-2"
            />
          </div>
          <div>
            <label htmlFor="media-proactive-prompt" className="text-foreground text-sm font-medium">
              Prompt (optional)
            </label>
            <p className="text-muted mt-1 text-xs">
              Leave blank to use the default kid-illustration template, or edit after the word field
              blurs.
            </p>
            <textarea
              id="media-proactive-prompt"
              data-testid="media-proactive-prompt"
              rows={4}
              value={proactivePrompt}
              onChange={(event) => setProactivePrompt(event.target.value)}
              disabled={proactiveBusy}
              className={cn(TEXTAREA_CLASS, "mt-2")}
            />
          </div>
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              disabled={proactiveBusy || proactiveWord.trim().length === 0}
              data-testid="media-proactive-submit"
              onClick={() => void handleProactiveGenerate(proactiveWord, proactivePrompt)}
            >
              {proactiveBusy ? "Generating…" : "Generate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6" data-testid="media-curriculum-gaps">
        <CardTitle>Curriculum gaps</CardTitle>
        <CardDescription>
          Pre-A1 vocabulary missing an image row. Generate one word at a time.
        </CardDescription>
        <CardContent>
          {curriculumGaps.length === 0 ? (
            <p className="text-muted text-sm" data-testid="media-curriculum-gaps-empty">
              No missing pre-A1 image words.
            </p>
          ) : (
            <ul className="divide-border divide-y" data-testid="media-curriculum-gaps-list">
              {curriculumGaps.map((word) => {
                const gapBusy = busyId === `proactive:${word}`;
                return (
                  <li
                    key={word}
                    className="flex items-center justify-between gap-3 py-3"
                    data-testid={`media-gap-${word}`}
                  >
                    <span className="text-foreground text-sm font-medium">{word}</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={proactiveBusy}
                      data-testid={`media-gap-generate-${word}`}
                      onClick={() => void handleProactiveGenerate(word, "")}
                    >
                      {gapBusy ? "Generating…" : "Generate"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardTitle>Pending review</CardTitle>
        <CardDescription>
          Generated images awaiting approval — invisible to learners until approved.
        </CardDescription>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted text-sm">No pending images.</p>
          ) : (
            <ul className="divide-border divide-y">
              {pending.map((asset) => (
                <AssetRow
                  key={assetId(asset)}
                  asset={asset}
                  busy={busyId === assetId(asset)}
                  onApprove={() => void handleApprove(asset)}
                  onPurge={() => void handlePurge(asset, "pending")}
                  onRegenerate={() => void openRegenerate(asset)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardTitle>Approved</CardTitle>
        <CardDescription>
          Images visible to learners. Regenerating creates a pending gap until re-approval.
        </CardDescription>
        <CardContent>
          {approved.length === 0 ? (
            <p className="text-muted text-sm">No approved images yet.</p>
          ) : (
            <ul className="divide-border divide-y">
              {approved.map((asset) => (
                <AssetRow
                  key={assetId(asset)}
                  asset={asset}
                  busy={busyId === assetId(asset)}
                  onPurge={() => void handlePurge(asset, "approved")}
                  onRegenerate={() => void openRegenerate(asset)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <RegenerateDialog
        target={regenerateTarget}
        busy={regenerateTarget !== null && busyId === assetId(regenerateTarget.asset)}
        onOpenChange={(open) => {
          if (!open && busyId === null) setRegenerateTarget(null);
        }}
        onConfirm={(prompt) => void handleRegenerateConfirm(prompt)}
      />
    </main>
  );
}
