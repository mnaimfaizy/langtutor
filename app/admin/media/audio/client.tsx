"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { MediaAssetKey, MediaAssetRecord } from "@/lib/db/schema";
import {
  composeSpokenText,
  ORPHEUS_DIRECTION_PRESETS,
  TTS_MAX_DIRECTION_CHARS,
  TTS_MAX_SPOKEN_TEXT_CHARS,
  type SpokenTextParts,
} from "@/lib/tts/prompts";
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
  Input,
  buttonClassName,
  cn,
} from "@/ui";

import {
  approveAudioMediaAsset,
  getAudioMediaAssetPreview,
  getProactiveAudioPromptDraft,
  getRegenerateAudioPromptDraft,
  listAudioCurriculumGaps,
  proactiveGenerateAudioMediaAsset,
  purgeAudioMediaAsset,
  regenerateAudioMediaAsset,
  type AdminAudioTtsOptions,
  type AudioPreview,
} from "./actions";

type Banner = { tone: "ok" | "error"; text: string } | null;

type TtsKnobState = {
  voiceUri: string;
  rate: number;
  maxDurationSeconds: number;
};

const DEFAULT_AUDIO_STYLE = "default";

const DEFAULT_KNOBS: TtsKnobState = {
  voiceUri: "",
  rate: 1,
  maxDurationSeconds: TTS_MAX_DURATION_SECONDS,
};

const EMPTY_DRAFT: SpokenTextParts = { say: "", direction: "" };

const TTS_RATE_MIN = 0.5;
const TTS_RATE_MAX = 2;
const TTS_RATE_STEP = 0.1;

const SELECT_CLASS =
  "border-border bg-card text-foreground focus-visible:border-accent focus-visible:ring-accent focus-visible:ring-offset-background mt-2 block w-full rounded-lg border px-3 py-2 text-sm transition-[colors,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60";

function assetId(asset: MediaAssetRecord): string {
  return `${asset.kind}:${asset.key}:${asset.style}`;
}

function assetRowKey(asset: MediaAssetRecord): string {
  const created =
    asset.createdAt instanceof Date ? asset.createdAt.toISOString() : String(asset.createdAt ?? "");
  return `${assetId(asset)}:${created}`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  if (seconds < 10) return `~${seconds.toFixed(1)}s`;
  return `~${Math.round(seconds)}s`;
}

function knobsToOptions(
  knobs: TtsKnobState,
  parts: SpokenTextParts,
): AdminAudioTtsOptions | undefined {
  const options: AdminAudioTtsOptions = {};
  if (knobs.voiceUri) options.voiceUri = knobs.voiceUri;
  if (knobs.rate !== 1) options.rate = knobs.rate;
  if (knobs.maxDurationSeconds !== TTS_MAX_DURATION_SECONDS) {
    options.maxDurationSeconds = knobs.maxDurationSeconds;
  }
  const composed = composeSpokenText(parts.say, parts.direction);
  if (composed) options.prompt = composed;
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

function SayDirectionFields({
  idPrefix,
  parts,
  disabled,
  onChange,
}: {
  idPrefix: string;
  parts: SpokenTextParts;
  disabled: boolean;
  onChange: (next: SpokenTextParts) => void;
}) {
  const composed = composeSpokenText(parts.say, parts.direction);
  const sayId = `${idPrefix}-say`;
  const directionId = `${idPrefix}-direction`;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={sayId} className="text-foreground text-sm font-medium">
          Say
        </label>
        <p className="text-muted mt-1 text-xs">
          Exact words Orpheus will speak (usually just the vocabulary word). Max{" "}
          {TTS_MAX_SPOKEN_TEXT_CHARS} characters total with direction.
        </p>
        <Input
          id={sayId}
          data-testid={sayId}
          value={parts.say}
          onChange={(event) => onChange({ ...parts, say: event.target.value })}
          disabled={disabled}
          placeholder="e.g. apple"
          maxLength={TTS_MAX_SPOKEN_TEXT_CHARS}
          className="mt-2"
        />
      </div>

      <div>
        <label htmlFor={directionId} className="text-foreground text-sm font-medium">
          Direction (optional)
        </label>
        <p className="text-muted mt-1 text-xs">
          Orpheus vocal tag only — not spoken. Use a short adjective like{" "}
          <code className="text-foreground">cheerful</code>, not a full sentence. Brackets are added
          automatically.
        </p>
        <Input
          id={directionId}
          data-testid={directionId}
          value={parts.direction}
          onChange={(event) => onChange({ ...parts, direction: event.target.value })}
          disabled={disabled}
          placeholder="e.g. cheerful"
          maxLength={TTS_MAX_DIRECTION_CHARS}
          list={`${idPrefix}-direction-presets`}
          className="mt-2"
        />
        <datalist id={`${idPrefix}-direction-presets`}>
          {ORPHEUS_DIRECTION_PRESETS.map((preset) => (
            <option key={preset} value={preset} />
          ))}
        </datalist>
      </div>

      {parts.say.trim().length > 0 && (
        <p className="text-muted text-xs" data-testid={`${idPrefix}-composed`}>
          Sent to Orpheus: <code className="text-foreground">{composed}</code>
        </p>
      )}
    </div>
  );
}

function AudioPreviewPlayer({ assetKey }: { assetKey: MediaAssetKey }) {
  const [preview, setPreview] = useState<AudioPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const { kind, key, style } = assetKey;

  useEffect(() => {
    let cancelled = false;
    // Depend on primitives — a fresh `{ kind, key, style }` object every parent
    // render would re-fire this effect; each server-action completion refreshes
    // the RSC tree, which re-renders the parent and would loop forever.
    void getAudioMediaAssetPreview({ kind, key, style })
      .then((result) => {
        if (!cancelled) setPreview(result);
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
        aria-label={`Preview audio for ${key}`}
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
  onEdit,
}: {
  asset: MediaAssetRecord;
  busy: boolean;
  onApprove?: () => void;
  onPurge: () => void;
  onEdit?: () => void;
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
        {onEdit && (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={onEdit}
            data-testid="audio-edit-in-form"
          >
            Edit
          </Button>
        )}
        <Button variant="secondary" size="sm" disabled={busy} onClick={onPurge}>
          Purge
        </Button>
      </div>
    </li>
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
  const generateFormRef = useRef<HTMLDivElement | null>(null);
  const [pending, setPending] = useState(initialPending);
  const [approved, setApproved] = useState(initialApproved);
  const [curriculumGaps, setCurriculumGaps] = useState(initialCurriculumGaps);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [formWord, setFormWord] = useState("");
  const [formParts, setFormParts] = useState<SpokenTextParts>(EMPTY_DRAFT);
  const [formKnobs, setFormKnobs] = useState<TtsKnobState>(DEFAULT_KNOBS);
  /** When set, Generate replaces this existing media key instead of creating a new row. */
  const [replaceKey, setReplaceKey] = useState<string | null>(null);
  const [generateBusy, setGenerateBusy] = useState(false);

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

  function clearGenerateForm() {
    setFormWord("");
    setFormParts(EMPTY_DRAFT);
    setFormKnobs(DEFAULT_KNOBS);
    setReplaceKey(null);
  }

  function scrollToGenerateForm() {
    generateFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function assetExistsLocally(normalizedWord: string): boolean {
    return (
      pending.some((a) => a.key === normalizedWord && a.style === DEFAULT_AUDIO_STYLE) ||
      approved.some((a) => a.key === normalizedWord && a.style === DEFAULT_AUDIO_STYLE)
    );
  }

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
        if (replaceKey === asset.key) {
          clearGenerateForm();
        }
      },
      `Purged "${asset.key}".`,
    );
  }

  /** Load an existing clip into the generate form — does not call TTS yet. */
  async function loadAssetIntoForm(asset: MediaAssetRecord) {
    const id = assetId(asset);
    setBusyId(id);
    setBanner(null);
    try {
      const draft = await getRegenerateAudioPromptDraft({
        kind: asset.kind,
        key: asset.key,
        style: asset.style,
      });
      setFormWord(asset.key);
      setFormParts(draft);
      setFormKnobs(DEFAULT_KNOBS);
      setReplaceKey(asset.key);
      setBanner({
        tone: "ok",
        text: `Loaded "${asset.key}" into the form — adjust voice/direction/duration, then Generate. Approve from Pending when you like the preview.`,
      });
      scrollToGenerateForm();
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not load clip into form",
      });
    } finally {
      setBusyId(null);
    }
  }

  /** Prefill the form for a missing curriculum word — does not call TTS yet. */
  async function loadWordIntoForm(word: string) {
    const trimmed = word.trim();
    if (!trimmed) return;
    setBanner(null);
    setFormWord(trimmed);
    setReplaceKey(null);
    setFormKnobs(DEFAULT_KNOBS);
    try {
      const draft = await getProactiveAudioPromptDraft(trimmed);
      setFormParts(draft);
    } catch {
      setFormParts({ say: trimmed.toLowerCase(), direction: "" });
    }
    setBanner({
      tone: "ok",
      text: `Loaded "${trimmed.toLowerCase()}" into the form — choose voice/direction/duration, then Generate.`,
    });
    scrollToGenerateForm();
  }

  async function refreshCurriculumGaps() {
    try {
      const gaps = await listAudioCurriculumGaps();
      setCurriculumGaps(gaps);
    } catch {
      // Keep the prior list; banner already covers generate failures.
    }
  }

  async function loadDraftForTypedWord(word: string) {
    const trimmed = word.trim();
    if (!trimmed) {
      setFormParts(EMPTY_DRAFT);
      setReplaceKey(null);
      return;
    }
    const normalized = trimmed.toLowerCase();
    if (replaceKey !== null && replaceKey !== normalized) {
      setReplaceKey(null);
    }
    try {
      if (assetExistsLocally(normalized)) {
        const draft = await getRegenerateAudioPromptDraft({
          kind: "audio",
          key: normalized,
          style: DEFAULT_AUDIO_STYLE,
        });
        setFormParts(draft);
        setReplaceKey(normalized);
      } else {
        const draft = await getProactiveAudioPromptDraft(trimmed);
        setFormParts(draft);
        setReplaceKey(null);
      }
    } catch {
      setFormParts({ say: normalized, direction: "" });
    }
  }

  async function handleGenerate(word: string, knobs: TtsKnobState, parts: SpokenTextParts) {
    const trimmed = word.trim();
    if (!trimmed) {
      setBanner({ tone: "error", text: "Enter a word to generate." });
      return;
    }
    const normalized = trimmed.toLowerCase();
    const say = parts.say.trim() || normalized;
    const options = knobsToOptions(knobs, { say, direction: parts.direction });
    const shouldReplace = replaceKey === normalized || assetExistsLocally(normalized);

    setGenerateBusy(true);
    setBusyId(`generate:${normalized}`);
    setBanner(null);
    try {
      let updated;
      if (shouldReplace) {
        updated = await regenerateAudioMediaAsset(
          { kind: "audio", key: normalized, style: DEFAULT_AUDIO_STYLE },
          options,
        );
      } else {
        const result = await proactiveGenerateAudioMediaAsset(trimmed, options);
        if (!result.ok) {
          if (result.code === "already_exists") {
            updated = await regenerateAudioMediaAsset(
              { kind: "audio", key: normalized, style: DEFAULT_AUDIO_STYLE },
              options,
            );
          } else {
            setBanner({ tone: "error", text: result.message });
            return;
          }
        } else {
          updated = result.asset;
        }
      }

      const id = assetId(updated);
      setApproved((prev) => prev.filter((a) => assetId(a) !== id));
      setPending((prev) => {
        const without = prev.filter((a) => assetId(a) !== id);
        return [...without, updated];
      });
      setCurriculumGaps((prev) => prev.filter((w) => w !== updated.key));
      clearGenerateForm();
      setBanner({
        tone: "ok",
        text: `Generated "${updated.key}" — preview it under Pending, then Approve when ready.`,
      });
      void refreshCurriculumGaps();
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Generation failed",
      });
    } finally {
      setGenerateBusy(false);
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href="/settings" label="Settings" />
      <h1 className="text-foreground mt-2 text-2xl font-semibold">Audio review</h1>
      <p className="text-muted mt-1 text-sm">
        Admin-only. Generate clips here, preview them under Pending, then Approve when they sound
        right.
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
        <Link
          href="/admin/path"
          className={buttonClassName({ variant: "ghost", size: "sm" })}
          data-testid="admin-shared-path-link"
        >
          Shared path
        </Link>
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

      <div ref={generateFormRef}>
        <Card className="mt-6" data-testid="audio-proactive-generate">
          <CardTitle>{replaceKey ? `Update “${replaceKey}”` : "Generate audio"}</CardTitle>
          <CardDescription>
            {replaceKey
              ? "Generate replaces this clip (same word) as pending. Preview under Pending, then Approve — Purge deletes it."
              : "Create a new clip, or use Edit on an existing row to load it here first."}
          </CardDescription>
          <CardContent className="space-y-3">
            <div>
              <label htmlFor="audio-proactive-word" className="text-foreground text-sm font-medium">
                Word
              </label>
              <Input
                id="audio-proactive-word"
                data-testid="audio-proactive-word"
                value={formWord}
                onChange={(event) => {
                  const next = event.target.value;
                  setFormWord(next);
                  const normalized = next.trim().toLowerCase();
                  if (replaceKey !== null && normalized !== replaceKey) {
                    setReplaceKey(null);
                  }
                }}
                onBlur={() => void loadDraftForTypedWord(formWord)}
                disabled={generateBusy}
                placeholder="e.g. xylophone"
                className="mt-2"
              />
            </div>
            <SayDirectionFields
              idPrefix="audio-proactive"
              parts={formParts}
              disabled={generateBusy}
              onChange={setFormParts}
            />
            <TtsKnobsFields
              idPrefix="audio-proactive"
              knobs={formKnobs}
              disabled={generateBusy}
              onChange={setFormKnobs}
            />
            <div className="flex justify-end gap-2">
              {(formWord || replaceKey) && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={generateBusy}
                  data-testid="audio-generate-clear"
                  onClick={() => {
                    clearGenerateForm();
                    setBanner(null);
                  }}
                >
                  Clear
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                disabled={generateBusy || formWord.trim().length === 0}
                data-testid="audio-proactive-submit"
                onClick={() => void handleGenerate(formWord, formKnobs, formParts)}
              >
                {generateBusy ? "Generating…" : replaceKey ? "Generate replacement" : "Generate"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6" data-testid="audio-curriculum-gaps">
        <CardTitle>Curriculum gaps</CardTitle>
        <CardDescription>
          Pre-A1 vocabulary missing an audio row — bundled activity words plus shared path draft
          target vocab. Load a word into the form, then Generate.
        </CardDescription>
        <CardContent>
          {curriculumGaps.length === 0 ? (
            <p className="text-muted text-sm" data-testid="audio-curriculum-gaps-empty">
              No missing pre-A1 audio words.
            </p>
          ) : (
            <ul className="divide-border divide-y" data-testid="audio-curriculum-gaps-list">
              {curriculumGaps.map((word) => (
                <li
                  key={word}
                  className="flex items-center justify-between gap-3 py-3"
                  data-testid={`audio-gap-${word}`}
                >
                  <span className="text-foreground text-sm font-medium">{word}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={generateBusy}
                    data-testid={`audio-gap-generate-${word}`}
                    onClick={() => void loadWordIntoForm(word)}
                  >
                    Load
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardTitle>Pending review</CardTitle>
        <CardDescription>
          Preview generated audio here, then Approve for learners — or Edit to tweak and regenerate
          the same clip.
        </CardDescription>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted text-sm">No pending audio.</p>
          ) : (
            <ul className="divide-border divide-y">
              {pending.map((asset) => (
                <AssetRow
                  key={assetRowKey(asset)}
                  asset={asset}
                  busy={busyId === assetId(asset)}
                  onApprove={() => void handleApprove(asset)}
                  onPurge={() => void handlePurge(asset, "pending")}
                  onEdit={() => void loadAssetIntoForm(asset)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardTitle>Approved</CardTitle>
        <CardDescription>
          Audio visible to learners. Edit loads the clip into the form; Generate makes a new pending
          version of the same word until you Approve again.
        </CardDescription>
        <CardContent>
          {approved.length === 0 ? (
            <p className="text-muted text-sm">No approved audio yet.</p>
          ) : (
            <ul className="divide-border divide-y">
              {approved.map((asset) => (
                <AssetRow
                  key={assetRowKey(asset)}
                  asset={asset}
                  busy={busyId === assetId(asset)}
                  onPurge={() => void handlePurge(asset, "approved")}
                  onEdit={() => void loadAssetIntoForm(asset)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
