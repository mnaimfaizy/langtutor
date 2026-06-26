"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import type { Cefr, LearnerGoal, Profile } from "@/lib/db";
import { HealthResponseSchema } from "@/lib/llm/settings";
import { getContentRepository } from "@/lib/registry";
import { Button, Card, CardContent, CardDescription, CardTitle, Input, cn } from "@/ui";
import { getSettingsRole, saveAdminConfig, saveUserPrefs } from "./actions";
import { BackupSection } from "./backup-section";

const TTS_RATE_MIN = 0.5;
const TTS_RATE_MAX = 2;
const TTS_RATE_STEP = 0.1;

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

const SttHealthSchema = z.object({ ok: z.boolean(), error: z.string().optional() });

export default function SettingsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // LLM settings state
  const [baseUrl, setBaseUrl] = useState("");
  const [chatModel, setChatModel] = useState("");
  const [utilityModel, setUtilityModel] = useState("");
  const [embedModel, setEmbedModel] = useState("");
  const [sttUrl, setSttUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sttBusy, setSttBusy] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  // Profile state
  const [profileLevel, setProfileLevel] = useState<Cefr | undefined>(undefined);
  const [profileGoals, setProfileGoals] = useState<LearnerGoal[]>([]);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileBanner, setProfileBanner] = useState<Banner>(null);

  // TTS state
  const [ttsRate, setTtsRate] = useState(1);
  const [ttsVoiceUri, setTtsVoiceUri] = useState("");
  const [ttsLang, setTtsLang] = useState("");
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsBanner, setTtsBanner] = useState<Banner>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([getContentRepository().getProfile(), getSettingsRole()]).then(
      ([profile, role]) => {
        if (!active) return;
        const s = profile?.settings ?? {};
        setBaseUrl(s.macLlmBaseUrl ?? "");
        setChatModel(s.macLlmModel ?? "");
        setUtilityModel(s.macUtilityModel ?? "");
        setEmbedModel(s.macEmbedModel ?? "");
        setSttUrl(s.macSttUrl ?? "");
        setProfileLevel(profile?.cefrLevel);
        setProfileGoals(profile?.goals ?? []);
        setTtsRate(s.ttsRate ?? 1);
        setTtsVoiceUri(s.ttsVoiceUri ?? "");
        setTtsLang(s.ttsLang ?? "");
        setIsAdmin(role === "admin");
        setLoaded(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const sync = () => setBrowserVoices(window.speechSynthesis.getVoices());
    sync();
    window.speechSynthesis.addEventListener("voiceschanged", sync);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", sync);
  }, []);

  // Unique language tags from available voices, sorted.
  const availableLangs = useMemo(() => {
    const langs = new Set(browserVoices.map((v) => v.lang));
    return Array.from(langs).sort();
  }, [browserVoices]);

  // Filter voices by the chosen language.
  const filteredVoices = useMemo(
    () => (ttsLang ? browserVoices.filter((v) => v.lang === ttsLang) : browserVoices),
    [browserVoices, ttsLang],
  );

  function handleTtsLangChange(lang: string) {
    setTtsLang(lang);
    // Clear voice selection when the filter no longer includes it.
    if (lang && !browserVoices.find((v) => v.lang === lang && v.voiceURI === ttsVoiceUri)) {
      setTtsVoiceUri("");
    }
  }

  async function handleSave() {
    setBusy(true);
    setBanner(null);
    try {
      await saveAdminConfig({
        macLlmBaseUrl: baseUrl.trim() || undefined,
        macLlmModel: chatModel.trim() || undefined,
        macUtilityModel: utilityModel.trim() || undefined,
        macEmbedModel: embedModel.trim() || undefined,
        macSttUrl: sttUrl.trim() || undefined,
      });
      setBanner({ tone: "ok", text: "Saved. New calls route to these endpoints." });
    } catch (error) {
      setBanner({ tone: "error", text: error instanceof Error ? error.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  async function handleTestLlm() {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/llm/health", { cache: "no-store" });
      const parsed = HealthResponseSchema.safeParse(await res.json());

      if (res.ok && parsed.success && parsed.data.ok) {
        const models = parsed.data.models ?? [];
        const list = models.length ? `: ${models.slice(0, 6).join(", ")}` : "";
        setBanner({ tone: "ok", text: `LLM connected — ${models.length} model(s)${list}` });
      } else {
        const reason = parsed.success
          ? (parsed.data.error ?? "unreachable")
          : "unexpected response";
        setBanner({ tone: "error", text: `Mac LLM unreachable: ${reason}` });
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

  async function handleTestStt() {
    setSttBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/stt/health", { cache: "no-store" });
      const parsed = SttHealthSchema.safeParse((await res.json()) as unknown);
      if (parsed.success && parsed.data.ok) {
        setBanner({ tone: "ok", text: "STT server reachable." });
      } else {
        const reason = parsed.success
          ? (parsed.data.error ?? "unreachable")
          : "unexpected response";
        setBanner({ tone: "error", text: `Mac STT unreachable: ${reason}` });
      }
    } catch (error) {
      setBanner({
        tone: "error",
        text: error instanceof Error ? error.message : "STT health check failed",
      });
    } finally {
      setSttBusy(false);
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

  async function handleSaveTts() {
    setTtsBusy(true);
    setTtsBanner(null);
    try {
      await saveUserPrefs({
        ttsRate,
        ttsVoiceUri: ttsVoiceUri || undefined,
        ttsLang: ttsLang || undefined,
      });
      setTtsBanner({ tone: "ok", text: "TTS settings saved." });
    } catch (error) {
      setTtsBanner({
        tone: "error",
        text: error instanceof Error ? error.message : "Save failed",
      });
    } finally {
      setTtsBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="text-foreground text-2xl font-semibold">Settings</h1>
      <p className="text-muted mt-1 text-sm">Manage your language learning preferences.</p>

      {isAdmin && (
        <Card className="mt-6">
          <CardTitle>User management</CardTitle>
          <CardDescription>Create, list, and delete user accounts.</CardDescription>
          <CardContent>
            <Link href="/admin/users" className="text-accent text-sm hover:underline">
              Manage users →
            </Link>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
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

            <Field
              label="Utility model"
              hint="Lighter model used for cheap checks (grammar, quiz generation)"
            >
              <Input
                value={utilityModel}
                onChange={(e) => setUtilityModel(e.target.value)}
                placeholder="qwen2.5:7b-instruct"
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

            <Field
              label="STT server URL"
              hint="whisper.cpp HTTP server — e.g. http://192.168.1.x:8080"
            >
              <Input
                value={sttUrl}
                onChange={(e) => setSttUrl(e.target.value)}
                placeholder="http://localhost:8080"
                disabled={!loaded || busy}
                inputMode="url"
                autoComplete="off"
              />
            </Field>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button onClick={() => void handleSave()} disabled={!loaded || busy}>
                Save
              </Button>
              <Button variant="secondary" onClick={() => void handleTestLlm()} disabled={busy}>
                Test LLM
              </Button>
              <Button variant="secondary" onClick={() => void handleTestStt()} disabled={sttBusy}>
                Test STT
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
      )}

      <Card className="mt-6" data-testid="tts-section">
        <CardTitle>Text-to-speech</CardTitle>
        <CardDescription>
          Voice and rate used when you tap Listen on a passage or writing prompt. Uses your
          browser&apos;s built-in voices — works offline.
        </CardDescription>
        <CardContent className="space-y-4">
          {availableLangs.length > 0 && (
            <Field label="Accent / language" hint="Filters the voice list below">
              <select
                value={ttsLang}
                onChange={(e) => handleTtsLangChange(e.target.value)}
                disabled={!loaded || ttsBusy}
                className="border-border bg-background text-foreground mt-1.5 block w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">All languages</option>
                {availableLangs.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label={`Rate — ${ttsRate.toFixed(1)}×`}>
            <input
              type="range"
              min={TTS_RATE_MIN}
              max={TTS_RATE_MAX}
              step={TTS_RATE_STEP}
              value={ttsRate}
              onChange={(e) => setTtsRate(parseFloat(e.target.value))}
              disabled={!loaded || ttsBusy}
              aria-label="Speech rate"
              className="accent-accent mt-1.5 w-full"
            />
            <div className="text-muted mt-0.5 flex justify-between text-xs">
              <span>{TTS_RATE_MIN}×</span>
              <span>{TTS_RATE_MAX}×</span>
            </div>
          </Field>

          <Field label="Voice">
            <select
              value={ttsVoiceUri}
              onChange={(e) => setTtsVoiceUri(e.target.value)}
              disabled={!loaded || ttsBusy}
              className="border-border bg-background text-foreground mt-1.5 block w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">System default</option>
              {filteredVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </Field>

          <div className="pt-1">
            <Button
              data-testid="btn-save-tts"
              onClick={() => void handleSaveTts()}
              disabled={!loaded || ttsBusy}
            >
              Save TTS settings
            </Button>
          </div>

          {ttsBanner && (
            <p
              className={cn("text-sm", ttsBanner.tone === "ok" ? "text-success" : "text-danger")}
              role="status"
            >
              {ttsBanner.text}
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

      <BackupSection />
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
