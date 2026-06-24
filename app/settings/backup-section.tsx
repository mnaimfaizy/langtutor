"use client";

import { useRef, useState } from "react";

import { BackupSchema } from "@/lib/backup/schema";
import { getContentRepository } from "@/lib/registry";
import { Button, Card, CardContent, CardDescription, CardTitle, cn } from "@/ui";

type Banner = { tone: "ok" | "error"; text: string } | null;

export function BackupSection() {
  const [exportBusy, setExportBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExportBusy(true);
    setBanner(null);
    try {
      const backup = await getContentRepository().exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lang-tutor-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revoke so Firefox/Safari finish reading the blob before it's released.
      setTimeout(() => URL.revokeObjectURL(url), 100);
      setBanner({ tone: "ok", text: "Backup downloaded." });
    } catch (error) {
      setBanner({
        tone: "error",
        text: error instanceof Error ? error.message : "Export failed.",
      });
    } finally {
      setExportBusy(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportBusy(true);
    setBanner(null);
    try {
      const text = await file.text();
      const parsed = BackupSchema.parse(JSON.parse(text) as unknown);
      await getContentRepository().importBackup(parsed);
      setBanner({ tone: "ok", text: "Backup restored. Reload the page to see your data." });
    } catch (error) {
      setBanner({
        tone: "error",
        text:
          error instanceof Error ? error.message : "Import failed. Is this a valid backup file?",
      });
    } finally {
      setImportBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card className="mt-6" data-testid="backup-section">
      <CardTitle>Backup &amp; Restore</CardTitle>
      <CardDescription>
        Export all your data (passages, cards, progress, settings) as a JSON file. Restore a
        previous backup to recover your data on a fresh install.
      </CardDescription>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button
            data-testid="btn-export-backup"
            onClick={() => void handleExport()}
            disabled={exportBusy || importBusy}
          >
            {exportBusy ? "Exporting…" : "Export backup"}
          </Button>
          <Button
            variant="secondary"
            data-testid="btn-import-backup"
            onClick={() => fileInputRef.current?.click()}
            disabled={exportBusy || importBusy}
          >
            {importBusy ? "Importing…" : "Restore from backup"}
          </Button>
          <input
            ref={fileInputRef}
            data-testid="input-import-file"
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => void handleImport(e)}
          />
        </div>
        {banner && (
          <p
            data-testid="backup-banner"
            className={cn("mt-3 text-sm", banner.tone === "ok" ? "text-success" : "text-danger")}
            role="status"
          >
            {banner.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
