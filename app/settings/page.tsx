"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import type { Cefr, LearnerGoal, Profile, ProfileSettings } from "@/lib/db";
import { HealthResponseSchema, settingsToOverrides } from "@/lib/llm/settings";
import { getContentRepository } from "@/lib/registry";
import { Button, Card, CardContent, CardDescription, CardTitle, Input, cn } from "@/ui";

type Banner = { tone: "ok" | "error"; text: string } | null;

const CEFR_LEVELS: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const CEFR_LABELS: Record<Cefr, string> = {
  A1: "A1 — Beginner",
  A2: "A2 — Elementary",
  B1: "B1 — Intermediate",
  B2: "B2 — Upper intermediate",
  C1: "C1 — Advanced",
  C2: "C2 — Mastery",
};

const GOAL_OPTIONS: { value: LearnerGoal; label: string }[] = [
  { value: "travel", label: "Travel" },
  { value: "work", label: "Work" },
  { value: "exam", label: "Exam prep" },
  { value: "general", label: "General" },
];

export default function SettingsPage() {
  // LLM settings state
  const [baseUrl, setBaseUrl] = useState("");
  const [chatModel, setChatModel] = useState("");
  const [embedModel, setEmbedModel] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  // Profile state
  const [profileLevel, setProfileLevel] = useState<Cefr | undefined>(undefined);
  const [profileGoals, setProfileGoals] = useState<LearnerGoal[]>([]);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileBanner, setProfileBanner] = useState<Banner>(null);

  useEffect(() => {
    let active = true;
    void getContentRepository()
      .getProfile()
      .then((profile) => {
        if (!active) return;
        const s = profile?.settings ?? {};
        setBaseUrl(s.macLlmBaseUrl ?? "");
        setChatModel(s.macLlmModel ?? "");
        setEmbedModel(s.macEmbedModel ?? "");
        setProfileLevel(profile?.cefrLevel);
        setProfileGoals(profile?.goals ?? []);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSave() {
    setBusy(true);
    setBanner(null);
    try {
      const repo = getContentRepository();
      const current = await repo.getSettings();
      const merged: ProfileSettings = {
        ...current,
        macLlmBaseUrl: baseUrl.trim() || undefined,
        macLlmModel: chatModel.trim() || undefined,
        macEmbedModel: embedModel.trim() || undefined,
      };
      await repo.saveSettings(merged);

      const res = await fetch("/api/llm/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsToOverrides(merged)),
      });
      if (!res.ok) throw new Error(`Server rejected settings (${res.status})`);

      setBanner({ tone: "ok", text: "Saved. New calls route to this endpoint." });
    } catch (error) {
      setBanner({ tone: "error", text: error instanceof Error ? error.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/llm/health", { cache: "no-store" });
      const parsed = HealthResponseSchema.safeParse(await res.json());

      if (res.ok && parsed.success && parsed.data.ok) {
        const models = parsed.data.models ?? [];
        const list = models.length ? `: ${models.slice(0, 6).join(", ")}` : "";
        setBanner({ tone: "ok", text: `Connected — ${models.length} model(s)${list}` });
      } else {
        const reason = parsed.success
          ? (parsed.data.error ?? "unreachable")
          : "unexpected response";
        setBanner({ tone: "error", text: `Mac unreachable: ${reason}` });
      }
    } catch (error) {
      setBanner({
        tone: "error",
        text: error instanceof Error ? error.message : "Health check failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveProfile() {
    if (!profileLevel) return;
    setProfileBusy(true);
    setProfileBanner(null);
    try {
      const repo = getContentRepository();
      const existing = await repo.getProfile();
      const profile: Profile = {
        cefrLevel: profileLevel,
        goals: profileGoals,
        createdAt: existing?.createdAt ?? new Date(),
        settings: existing?.settings ?? {},
      };
      await repo.saveProfile(profile);
      setProfileBanner({ tone: "ok", text: "Profile updated." });
    } catch (error) {
      setProfileBanner({
        tone: "error",
        text: error instanceof Error ? error.message : "Save failed",
      });
    } finally {
      setProfileBusy(false);
    }
  }

  function toggleProfileGoal(goal: LearnerGoal) {
    setProfileGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="text-foreground text-2xl font-semibold">Settings</h1>
      <p className="text-muted mt-1 text-sm">
        Configure the home Mac (Ollama) endpoint and models. Stored locally; the browser never calls
        the Mac directly.
      </p>

      <Card className="mt-6">
        <CardTitle>Mac / LLM</CardTitle>
        <CardDescription>
          Defaults come from server env; values here override them at runtime. Leave a field blank
          to use its env default.
        </CardDescription>
        <CardContent className="space-y-4">
          <Field label="Base URL" hint="e.g. http://192.168.1.x:11434/v1 or your Tailscale host">
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:11434/v1"
              disabled={!loaded || busy}
              inputMode="url"
              autoComplete="off"
            />
          </Field>

          <Field label="Chat model">
            <Input
              value={chatModel}
              onChange={(e) => setChatModel(e.target.value)}
              placeholder="qwen2.5:14b-instruct"
              disabled={!loaded || busy}
              autoComplete="off"
            />
          </Field>

          <Field label="Embedding model">
            <Input
              value={embedModel}
              onChange={(e) => setEmbedModel(e.target.value)}
              placeholder="nomic-embed-text"
              disabled={!loaded || busy}
              autoComplete="off"
            />
          </Field>

          <div className="flex items-center gap-3 pt-1">
            <Button onClick={() => void handleSave()} disabled={!loaded || busy}>
              Save
            </Button>
            <Button variant="secondary" onClick={() => void handleTest()} disabled={busy}>
              Test connection
            </Button>
          </div>

          {banner && (
            <p
              className={cn("text-sm", banner.tone === "ok" ? "text-success" : "text-danger")}
              role="status"
            >
              {banner.text}
            </p>
          )}
        </CardContent>
      </Card>

      {profileLevel && (
        <Card className="mt-6" data-testid="profile-section">
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your current level and learning goals.</CardDescription>
          <CardContent className="space-y-5">
            <Field label="Level">
              <select
                data-testid="profile-level-select"
                value={profileLevel}
                onChange={(e) => setProfileLevel(e.target.value as Cefr)}
                disabled={profileBusy}
                className="border-border bg-background text-foreground mt-1.5 block w-full rounded-md border px-3 py-2 text-sm"
              >
                {CEFR_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {CEFR_LABELS[level]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Goals">
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {GOAL_OPTIONS.map(({ value, label }) => {
                  const active = profileGoals.includes(value);
                  return (
                    <button
                      key={value}
                      data-testid={`profile-goal-btn-${value}`}
                      aria-pressed={active}
                      disabled={profileBusy}
                      onClick={() => toggleProfileGoal(value)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm transition-colors",
                        active
                          ? "border-accent bg-accent/10 text-foreground font-medium"
                          : "border-border text-muted hover:border-foreground/30",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="pt-1">
              <Button
                data-testid="btn-save-profile"
                onClick={() => void handleSaveProfile()}
                disabled={profileBusy}
              >
                Save profile
              </Button>
            </div>

            {profileBanner && (
              <p
                className={cn(
                  "text-sm",
                  profileBanner.tone === "ok" ? "text-success" : "text-danger",
                )}
                role="status"
              >
                {profileBanner.text}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-foreground text-sm font-medium">{label}</span>
      {hint && <span className="text-muted mt-0.5 block text-xs">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
