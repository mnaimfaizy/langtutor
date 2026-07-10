"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { MediaAssetKey, MediaAssetRecord } from "@/lib/db/schema";
import { GROQ_ORPHEUS_VOICES } from "@/lib/tts/speech-synthesis";
import { TTS_MAX_DURATION_SECONDS } from "@/lib/tts/truncate-audio";
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
  approveAudioMediaAsset,
  getAudioMediaAssetPreview,
  listAudioCurriculumGaps,
  proactiveGenerateAudioMediaAsset,
  purgeAudioMediaAsset,
  regenerateAudioMediaAsset,
  type AdminAudioTtsOptions,
  type AudioPreview,
} from "./actions";

type Banner = { tone: "ok" | "error"; text: string } | null;

type RegenerateTarget = {
  asset: MediaAssetRecord;
};

type TtsKnobState = {
  voiceUri: string;
  rate: number;
  maxDurationSeconds: number;
};

const DEFAULT_KNOBS: TtsKnobState = {
  voiceUri: "",
  rate: 1,
  maxDurationSeconds: TTS_MAX_DURATION_SECONDS,
};

const TTS_RATE_MIN = 0.5;
const TTS_RATE_MAX = 2;
const TTS_RATE_STEP = 0.1;

const SELECT_CLASS =
  "border-border bg-card text-foreground focus-visible:border-accent focus-visible:ring-accent focus-visible:ring-offset-background mt-2 block w-full rounded-lg border px-3 py-2 text-sm transition-[colors,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60";

function assetId(asset: MediaAssetRecord): string {
  return `${asset.kind}:${asset.key}:${asset.style}`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  if (seconds < 10) return `~${seconds.toFixed(1)}s`;
  return `~${Math.round(seconds)}s`;
}

function knobsToOptions(knobs: TtsKnobState): AdminAudioTtsOptions | undefined {
  const options: AdminAudioTtsOptions = {};
  if (knobs.voiceUri) options.voiceUri = knobs.voiceUri;
  if (knobs.rate !== 1) options.rate = knobs.rate;
  if (knobs.maxDurationSeconds !== TTS_MAX_DURATION_SECONDS) {
    options.maxDurationSeconds = knobs.maxDurationSeconds;
  }
  return Object.keys(options).length > 0 ? options : undefined;
}

function TtsKnobsFields({
  idPrefix,
  knobs,
  disabled,
  onChange,
}: {
  idPrefix: string;
  knobs: TtsKnobState;
  disabled: boolean;
  onChange: (next: TtsKnobState) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${idPrefix}-voice`} className="text-foreground text-sm font-medium">
          Voice
        </label>
        <select
          id={`${idPrefix}-voice`}
          data-testid={`${idPrefix}-voice`}
          value={knobs.voiceUri}
          onChange={(event) => onChange({ ...knobs, voiceUri: event.target.value })}
          disabled={disabled}
          className={SELECT_CLASS}
        >
          <option value="">Provider default</option>
          {GROQ_ORPHEUS_VOICES.map((voice) => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voice.voiceURI}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-rate`} className="text-foreground text-sm font-medium">
          Rate — {knobs.rate.toFixed(1)}×
        </label>
        <input
          id={`${idPrefix}-rate`}
          data-testid={`${idPrefix}-rate`}
          type="range"
          min={TTS_RATE_MIN}
          max={TTS_RATE_MAX}
          step={TTS_RATE_STEP}
          value={knobs.rate}
          onChange={(event) => onChange({ ...knobs, rate: parseFloat(event.target.value) })}
          disabled={disabled}
          aria-label="Speech rate"
          className="accent-accent mt-2 w-full"
        />
        <div className="text-muted mt-0.5 flex justify-between text-xs">
          <span>{TTS_RATE_MIN}×</span>
          <span>{TTS_RATE_MAX}×</span>
        </div>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-max-duration`} className="text-foreground text-sm font-medium">
          Max duration — {knobs.maxDurationSeconds.toFixed(1)}s
        </label>
        <p className="text-muted mt-1 text-xs">
          Soft truncate before persist. Hard cap is {TTS_MAX_DURATION_SECONDS}s.
        </p>
        <input
          id={`${idPrefix}-max-duration`}
          data-testid={`${idPrefix}-max-duration`}
          type="range"
          min={0.5}
          max={TTS_MAX_DURATION_SECONDS}
          step={0.5}
          value={knobs.maxDurationSeconds}
          onChange={(event) =>
            onChange({ ...knobs, maxDurationSeconds: parseFloat(event.target.value) })
          }
          disabled={disabled}
          aria-label="Max audio duration"
          className="accent-accent mt-2 w-full"
        />
        <div className="text-muted mt-0.5 flex justify-between text-xs">
          <span>0.5s</span>
          <span>{TTS_MAX_DURATION_SECONDS}s</span>
        </div>
      </div>
    </div>
  );
}

function AudioPreviewPlayer({ assetKey }: { assetKey: MediaAssetKey }) {
  const [preview, setPreview] = useState<AudioPreview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAudioMediaAssetPreview(assetKey)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [assetKey]);

  if (failed) {
    return (
      <div className="bg-muted text-muted flex h-12 min-w-40 items-center justify-center rounded-lg px-3 text-xs">
        Preview unavailable
      </div>
    );
  }

  if (!preview) {
    return <div className="bg-muted h-12 min-w-40 animate-pulse rounded-lg" aria-hidden />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <audio
        controls
        preload="metadata"
        src={preview.dataUrl}
        className="h-10 max-w-full"
        aria-label={`Preview audio for ${assetKey.key}`}
      />
      <p className="text-muted text-xs" data-testid="audio-duration">
        Duration {formatDuration(preview.durationSeconds)}
      </p>
    </div>
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
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start">
        <AudioPreviewPlayer assetKey={assetKey} />
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
            data-testid="audio-regenerate"
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
  busy,
  onConfirm,
}: {
  asset: MediaAssetRecord;
  busy: boolean;
  onConfirm: (options: AdminAudioTtsOptions | undefined) => void;
}) {
  const [knobs, setKnobs] = useState<TtsKnobState>(DEFAULT_KNOBS);

  return (
    <>
      <DialogTitle>Regenerate “{asset.key}”</DialogTitle>
      <DialogDescription>
        Learners will not hear audio for this word until you approve the new clip.
      </DialogDescription>

      <div className="mt-4 space-y-3">
        <TtsKnobsFields
          idPrefix="audio-regenerate"
          knobs={knobs}
          disabled={busy}
          onChange={setKnobs}
        />

        <p className="text-warning text-sm" role="status" data-testid="audio-regenerate-warning">
          Regenerating replaces the current clip and creates a pending gap for learners until you
          re-approve.
        </p>

        <div className="flex justify-end gap-2">
          <DialogClose disabled={busy}>Cancel</DialogClose>
          <Button
            variant="primary"
            disabled={busy}
            data-testid="audio-regenerate-confirm"
            onClick={() => onConfirm(knobsToOptions(knobs))}
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
  onConfirm: (options: AdminAudioTtsOptions | undefined) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(90vw,36rem)]" data-testid="audio-regenerate-dialog">
        {target && (
          <RegenerateDialogBody
            key={assetId(target.asset)}
            asset={target.asset}
            busy={busy}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AudioReviewClient({
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
  const [proactiveKnobs, setProactiveKnobs] = useState<TtsKnobState>(DEFAULT_KNOBS);
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
        await approveAudioMediaAsset(key);
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
        await purgeAudioMediaAsset(key);
        if (list === "pending") {
          setPending((prev) => prev.filter((a) => assetId(a) !== id));
        } else {
          setApproved((prev) => prev.filter((a) => assetId(a) !== id));
        }
        setCurriculumGaps((prev) =>
          prev.includes(asset.key) ? prev : [...prev, asset.key].sort((a, b) => a.localeCompare(b)),
        );
      },
      `Purged "${asset.key}".`,
    );
  }

  function openRegenerate(asset: MediaAssetRecord) {
    setBanner(null);
    setRegenerateTarget({ asset });
  }

  async function handleRegenerateConfirm(options: AdminAudioTtsOptions | undefined) {
    const target = regenerateTarget;
    if (!target) return;
    const { asset } = target;
    const id = assetId(asset);
    const key: MediaAssetKey = { kind: asset.kind, key: asset.key, style: asset.style };
    setBusyId(id);
    setBanner(null);
    try {
      const updated = await regenerateAudioMediaAsset(key, options);
      setApproved((prev) => prev.filter((a) => assetId(a) !== id));
      setPending((prev) => {
        const without = prev.filter((a) => assetId(a) !== id);
        return [...without, updated];
      });
      setRegenerateTarget(null);
      setBanner({
        tone: "ok",
        text: `Regenerated "${asset.key}" — pending approval before learners can hear it.`,
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
      const gaps = await listAudioCurriculumGaps();
      setCurriculumGaps(gaps);
    } catch {
      // Keep the prior list; banner already covers generate failures.
    }
  }

  async function handleProactiveGenerate(word: string, knobs: TtsKnobState) {
    const trimmed = word.trim();
    if (!trimmed) {
      setBanner({ tone: "error", text: "Enter a word to generate." });
      return;
    }
    setProactiveBusy(true);
    setBusyId(`proactive:${trimmed.toLowerCase()}`);
    setBanner(null);
    try {
      const result = await proactiveGenerateAudioMediaAsset(trimmed, knobsToOptions(knobs));
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
      setProactiveKnobs(DEFAULT_KNOBS);
      setBanner({
        tone: "ok",
        text: `Generated "${created.key}" — pending approval before learners can hear it.`,
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
      <h1 className="text-foreground mt-2 text-2xl font-semibold">Audio review</h1>
      <p className="text-muted mt-1 text-sm">
        Admin-only. Approve generated speech clips before learners can hear them.
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
        <span className={buttonClassName({ variant: "secondary", size: "sm" })} aria-current="page">
          Audio review
        </span>
      </nav>

      {banner && (
        <p
          className={cn("mt-4 text-sm", banner.tone === "ok" ? "text-success" : "text-danger")}
          role="status"
          data-testid="audio-banner"
        >
          {banner.text}
        </p>
      )}

      <Card className="mt-6" data-testid="audio-proactive-generate">
        <CardTitle>Proactive generate</CardTitle>
        <CardDescription>
          Create a pending speech clip for a word with no audio row yet — no learner miss required.
        </CardDescription>
        <CardContent className="space-y-3">
          <div>
            <label htmlFor="audio-proactive-word" className="text-foreground text-sm font-medium">
              Word
            </label>
            <Input
              id="audio-proactive-word"
              data-testid="audio-proactive-word"
              value={proactiveWord}
              onChange={(event) => setProactiveWord(event.target.value)}
              disabled={proactiveBusy}
              placeholder="e.g. xylophone"
              className="mt-2"
            />
          </div>
          <TtsKnobsFields
            idPrefix="audio-proactive"
            knobs={proactiveKnobs}
            disabled={proactiveBusy}
            onChange={setProactiveKnobs}
          />
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              disabled={proactiveBusy || proactiveWord.trim().length === 0}
              data-testid="audio-proactive-submit"
              onClick={() => void handleProactiveGenerate(proactiveWord, proactiveKnobs)}
            >
              {proactiveBusy ? "Generating…" : "Generate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6" data-testid="audio-curriculum-gaps">
        <CardTitle>Curriculum gaps</CardTitle>
        <CardDescription>
          Pre-A1 vocabulary missing an audio row. Generate one word at a time.
        </CardDescription>
        <CardContent>
          {curriculumGaps.length === 0 ? (
            <p className="text-muted text-sm" data-testid="audio-curriculum-gaps-empty">
              No missing pre-A1 audio words.
            </p>
          ) : (
            <ul className="divide-border divide-y" data-testid="audio-curriculum-gaps-list">
              {curriculumGaps.map((word) => {
                const gapBusy = busyId === `proactive:${word}`;
                return (
                  <li
                    key={word}
                    className="flex items-center justify-between gap-3 py-3"
                    data-testid={`audio-gap-${word}`}
                  >
                    <span className="text-foreground text-sm font-medium">{word}</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={proactiveBusy}
                      data-testid={`audio-gap-generate-${word}`}
                      onClick={() => void handleProactiveGenerate(word, DEFAULT_KNOBS)}
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
          Generated audio awaiting approval — unavailable to learners until approved.
        </CardDescription>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted text-sm">No pending audio.</p>
          ) : (
            <ul className="divide-border divide-y">
              {pending.map((asset) => (
                <AssetRow
                  key={assetId(asset)}
                  asset={asset}
                  busy={busyId === assetId(asset)}
                  onApprove={() => void handleApprove(asset)}
                  onPurge={() => void handlePurge(asset, "pending")}
                  onRegenerate={() => openRegenerate(asset)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardTitle>Approved</CardTitle>
        <CardDescription>
          Audio visible to learners. Regenerating creates a pending gap until re-approval.
        </CardDescription>
        <CardContent>
          {approved.length === 0 ? (
            <p className="text-muted text-sm">No approved audio yet.</p>
          ) : (
            <ul className="divide-border divide-y">
              {approved.map((asset) => (
                <AssetRow
                  key={assetId(asset)}
                  asset={asset}
                  busy={busyId === assetId(asset)}
                  onPurge={() => void handlePurge(asset, "approved")}
                  onRegenerate={() => openRegenerate(asset)}
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
        onConfirm={(options) => void handleRegenerateConfirm(options)}
      />
    </main>
  );
}
