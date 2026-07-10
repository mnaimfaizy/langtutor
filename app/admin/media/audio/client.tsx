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
  buttonClassName,
  cn,
} from "@/ui";

import {
  approveAudioMediaAsset,
  getAudioMediaAssetPreview,
  purgeAudioMediaAsset,
  type AudioPreview,
} from "./actions";

type Banner = { tone: "ok" | "error"; text: string } | null;

function assetId(asset: MediaAssetRecord): string {
  return `${asset.kind}:${asset.key}:${asset.style}`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  if (seconds < 10) return `~${seconds.toFixed(1)}s`;
  return `~${Math.round(seconds)}s`;
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
}: {
  asset: MediaAssetRecord;
  busy: boolean;
  onApprove?: () => void;
  onPurge: () => void;
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
}: {
  initialPending: MediaAssetRecord[];
  initialApproved: MediaAssetRecord[];
}) {
  const [pending, setPending] = useState(initialPending);
  const [approved, setApproved] = useState(initialApproved);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);

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
      },
      `Purged "${asset.key}".`,
    );
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
        >
          {banner.text}
        </p>
      )}

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
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardTitle>Approved</CardTitle>
        <CardDescription>
          Audio visible to learners. Purge removes a clip entirely from the store.
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
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
