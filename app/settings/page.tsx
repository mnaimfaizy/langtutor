"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import {
  DEFAULT_EXPERIENCE_MODE,
  DEFAULT_PROGRESSION_MODE,
  type Cefr,
  type ExperienceMode,
  type LearnerGoal,
  type Profile,
  type ProgressionMode,
} from "@/lib/db";
import { HealthResponseSchema } from "@/lib/llm/settings";
import { getContentRepository } from "@/lib/registry";
import { syncPreA1Units } from "@/lib/path/seed";
import { applyPalette } from "@/lib/theme";
import {
  Button,
  buttonClassName,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Input,
  SelectPill,
  cn,
} from "@/ui";
import { getSettingsRole, saveAdminConfig, saveUserPrefs } from "./actions";
import { BackupSection } from "./backup-section";

const TTS_RATE_MIN = 0.5;
const TTS_RATE_MAX = 2;
const TTS_RATE_STEP = 0.1;

// Matches ui/Input's focus treatment for native <select> elements (no Select primitive in ui/ yet).
const SELECT_CLASS =
  "border-border bg-background text-foreground focus-visible:border-accent focus-visible:ring-accent focus-visible:ring-offset-background focus-visible:shadow-glow mt-1.5 block w-full rounded-md border px-3 py-2 text-sm transition-[colors,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";

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

const EXPERIENCE_MODE_OPTIONS: { value: ExperienceMode; label: string; hint: string }[] = [
  { value: "adult", label: "Adult", hint: "Premium dark, focused" },
  { value: "kid", label: "Kid", hint: "Bright, playful" },
];

const PROGRESSION_MODE_OPTIONS: { value: ProgressionMode; label: string; hint: string }[] = [
  {
    value: "strict",
    label: "Strict",
    hint: "Chapter exams must be passed before the next chapter unlocks",
  },
  {
    value: "open",
    label: "Open",
    hint: "Exams and reports still run; they do not block the path",
  },
];

const SttHealthSchema = z.object({ ok: z.boolean(), error: z.string().optional() });

export default function SettingsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // LLM settings state
  const [chatProvider, setChatProvider] = useState<"mac" | "groq">("mac");
  const [cloudChatModel, setCloudChatModel] = useState("");
  const [sttProvider, setSttProvider] = useState<"mac" | "groq">("mac");
  const [embeddingsProvider, setEmbeddingsProvider] = useState<"mac" | "mistral">("mac");
  const [cloudEmbeddingsModel, setCloudEmbeddingsModel] = useState("");
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

  // Experience mode (appearance) state
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>(DEFAULT_EXPERIENCE_MODE);
  const [experienceModeBusy, setExperienceModeBusy] = useState(false);
  const [experienceModeBanner, setExperienceModeBanner] = useState<Banner>(null);

  // Adult pre-A1 opt-in (ADR 0016, issue #66)
  const [enablePreA1, setEnablePreA1] = useState(false);
  const [preA1Busy, setPreA1Busy] = useState(false);
  const [preA1Banner, setPreA1Banner] = useState<Banner>(null);

  // Adult progression mode (ADR 0033 / 0042, issue #114)
  const [progressionMode, setProgressionMode] = useState<ProgressionMode>(DEFAULT_PROGRESSION_MODE);
  const [progressionBusy, setProgressionBusy] = useState(false);
  const [progressionBanner, setProgressionBanner] = useState<Banner>(null);

  // TTS state
  const [ttsRate, setTtsRate] = useState(1);
  const [ttsVoiceUri, setTtsVoiceUri] = useState("");
  const [ttsLang, setTtsLang] = useState("");
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsBanner, setTtsBanner] = useState<Banner>(null);

  // Celebration sound state (issue #81)
  const [soundMuted, setSoundMuted] = useState(false);
  const [soundBusy, setSoundBusy] = useState(false);
  const [soundBanner, setSoundBanner] = useState<Banner>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([getContentRepository().getProfile(), getSettingsRole()]).then(
      ([profile, role]) => {
        if (!active) return;
        const s = profile?.settings ?? {};
        setChatProvider(s.chatProvider ?? "mac");
        setCloudChatModel(s.chatModel ?? "");
        setSttProvider(s.sttProvider ?? "mac");
        setEmbeddingsProvider(s.embeddingsProvider ?? "mac");
        setCloudEmbeddingsModel(s.embeddingsModel ?? "");
        setBaseUrl(s.macLlmBaseUrl ?? "");
        setChatModel(s.macLlmModel ?? "");
        setUtilityModel(s.macUtilityModel ?? "");
        setEmbedModel(s.macEmbedModel ?? "");
        setSttUrl(s.macSttUrl ?? "");
        setProfileLevel(profile?.cefrLevel);
        setProfileGoals(profile?.goals ?? []);
        setExperienceMode(profile?.experienceMode ?? DEFAULT_EXPERIENCE_MODE);
        setEnablePreA1(s.enablePreA1 ?? false);
        setProgressionMode(s.progressionMode ?? DEFAULT_PROGRESSION_MODE);
        setSoundMuted(s.soundMuted ?? false);
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
        chatProvider,
        chatModel: chatProvider === "groq" ? cloudChatModel.trim() || undefined : undefined,
        sttProvider,
        embeddingsProvider,
        embeddingsModel:
          embeddingsProvider === "mistral" ? cloudEmbeddingsModel.trim() || undefined : undefined,
        macLlmBaseUrl: chatProvider === "mac" ? baseUrl.trim() || undefined : undefined,
        macLlmModel: chatProvider === "mac" ? chatModel.trim() || undefined : undefined,
        macUtilityModel: utilityModel.trim() || undefined,
        macEmbedModel: embeddingsProvider === "mac" ? embedModel.trim() || undefined : undefined,
        macSttUrl: sttProvider === "mac" ? sttUrl.trim() || undefined : undefined,
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
        setBanner({ tone: "error", text: `LLM unreachable: ${reason}` });
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
        setBanner({ tone: "error", text: `STT unreachable: ${reason}` });
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

  function handleSelectExperienceMode(mode: ExperienceMode) {
    setExperienceMode(mode);
    // Instant preview — the palette switches live even before Save persists it.
    applyPalette(mode);
  }

  async function handleSaveExperienceMode() {
    setExperienceModeBusy(true);
    setExperienceModeBanner(null);
    try {
      const repo = getContentRepository();
      const existing = await repo.getProfile();
      // Kid accounts are always strict (ADR 0042) — force the stored setting on switch.
      const nextSettings =
        experienceMode === "kid"
          ? { ...(existing?.settings ?? {}), progressionMode: "strict" as const }
          : (existing?.settings ?? {});
      if (experienceMode === "kid") {
        setProgressionMode("strict");
        await saveUserPrefs({ progressionMode: "strict" });
      }
      const profile: Profile = {
        cefrLevel: existing?.cefrLevel,
        goals: existing?.goals ?? [],
        createdAt: existing?.createdAt ?? new Date(),
        settings: nextSettings,
        experienceMode,
      };
      await repo.saveProfile(profile);
      await syncPreA1Units(repo, profile);
      setExperienceModeBanner({ tone: "ok", text: "Appearance saved." });
    } catch (error) {
      setExperienceModeBanner({
        tone: "error",
        text: error instanceof Error ? error.message : "Save failed",
      });
    } finally {
      setExperienceModeBusy(false);
    }
  }

  async function handleSaveProgressionMode() {
    setProgressionBusy(true);
    setProgressionBanner(null);
    try {
      await saveUserPrefs({ progressionMode });
      setProgressionBanner({ tone: "ok", text: "Progression mode saved." });
    } catch (error) {
      setProgressionBanner({
        tone: "error",
        text: error instanceof Error ? error.message : "Save failed",
      });
    } finally {
      setProgressionBusy(false);
    }
  }

  async function handleSavePreA1() {
    setPreA1Busy(true);
    setPreA1Banner(null);
    try {
      const repo = getContentRepository();
      const existing = await repo.getProfile();
      const settings = { ...(existing?.settings ?? {}), enablePreA1 };
      await saveUserPrefs({ enablePreA1 });
      const profile: Profile = {
        cefrLevel: existing?.cefrLevel,
        goals: existing?.goals ?? [],
        createdAt: existing?.createdAt ?? new Date(),
        settings,
        experienceMode: existing?.experienceMode,
      };
      await syncPreA1Units(repo, profile);
      setPreA1Banner({ tone: "ok", text: "Beginner path updated." });
    } catch (error) {
      setPreA1Banner({
        tone: "error",
        text: error instanceof Error ? error.message : "Save failed",
      });
    } finally {
      setPreA1Busy(false);
    }
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

  async function handleSaveSound() {
    setSoundBusy(true);
    setSoundBanner(null);
    try {
      await saveUserPrefs({ soundMuted });
      setSoundBanner({ tone: "ok", text: "Sound settings saved." });
    } catch (error) {
      setSoundBanner({
        tone: "error",
        text: error instanceof Error ? error.message : "Save failed",
      });
    } finally {
      setSoundBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-foreground text-2xl font-semibold">Settings</h1>
      <p className="text-muted mt-1 text-sm">Manage your language learning preferences.</p>

      <Card className="mt-6" data-testid="experience-mode-section">
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Choose the experience that fits you best. Kid mode switches the whole app to a bright,
          playful palette.
        </CardDescription>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {EXPERIENCE_MODE_OPTIONS.map(({ value, label, hint }) => (
              <SelectPill
                key={value}
                data-testid={`experience-mode-btn-${value}`}
                selected={experienceMode === value}
                disabled={experienceModeBusy}
                onClick={() => handleSelectExperienceMode(value)}
              >
                {label}
                <span className="text-muted mt-0.5 block text-xs font-normal">{hint}</span>
              </SelectPill>
            ))}
          </div>

          <div className="pt-1">
            <Button
              data-testid="btn-save-experience-mode"
              onClick={() => void handleSaveExperienceMode()}
              disabled={experienceModeBusy}
            >
              Save appearance
            </Button>
          </div>

          {experienceModeBanner && (
            <p
              className={cn(
                "text-sm",
                experienceModeBanner.tone === "ok" ? "text-success" : "text-danger",
              )}
              role="status"
            >
              {experienceModeBanner.text}
            </p>
          )}
        </CardContent>
      </Card>

      {experienceMode === "adult" && (
        <Card className="mt-6" data-testid="progression-mode-section">
          <CardTitle>Progression</CardTitle>
          <CardDescription>
            Choose how chapter mastery exams affect the learning path. Kid accounts always use
            strict mode.
          </CardDescription>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {PROGRESSION_MODE_OPTIONS.map(({ value, label, hint }) => (
                <SelectPill
                  key={value}
                  data-testid={`progression-mode-btn-${value}`}
                  selected={progressionMode === value}
                  disabled={!loaded || progressionBusy}
                  onClick={() => setProgressionMode(value)}
                >
                  {label}
                  <span className="text-muted mt-0.5 block text-xs font-normal">{hint}</span>
                </SelectPill>
              ))}
            </div>

            <div className="pt-1">
              <Button
                data-testid="btn-save-progression-mode"
                onClick={() => void handleSaveProgressionMode()}
                disabled={!loaded || progressionBusy}
              >
                Save progression
              </Button>
            </div>

            {progressionBanner && (
              <p
                className={cn(
                  "text-sm",
                  progressionBanner.tone === "ok" ? "text-success" : "text-danger",
                )}
                role="status"
              >
                {progressionBanner.text}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {experienceMode === "adult" && (
        <Card className="mt-6" data-testid="pre-a1-settings-section">
          <CardTitle>Beginner path</CardTitle>
          <CardDescription>
            True-zero adults can opt into Pre-A1 placeholder units (alphabet, phonics, and
            picture-word basics) ahead of A1 on the learning path.
          </CardDescription>
          <CardContent className="space-y-4">
            <label className="text-foreground flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                data-testid="enable-pre-a1-checkbox"
                checked={enablePreA1}
                disabled={!loaded || preA1Busy}
                onChange={(e) => setEnablePreA1(e.target.checked)}
                className="border-border accent-accent mt-0.5 size-4 shrink-0 rounded"
              />
              <span>Include Pre-A1 beginner units on my learning path</span>
            </label>

            <div className="pt-1">
              <Button
                data-testid="btn-save-pre-a1"
                onClick={() => void handleSavePreA1()}
                disabled={!loaded || preA1Busy}
              >
                Save beginner path
              </Button>
            </div>

            {preA1Banner && (
              <p
                className={cn(
                  "text-sm",
                  preA1Banner.tone === "ok" ? "text-success" : "text-danger",
                )}
                role="status"
              >
                {preA1Banner.text}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="mt-6">
          <CardTitle>Media review</CardTitle>
          <CardDescription>
            Approve generated illustrations and speech clips before learners can see or hear them.
          </CardDescription>
          <CardContent className="flex flex-wrap gap-2">
            <Link
              href="/admin/media"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Review images →
            </Link>
            <Link
              href="/admin/media/audio"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
              data-testid="admin-audio-media-link"
            >
              Review audio →
            </Link>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="mt-6">
          <CardTitle>Shared path cache</CardTitle>
          <CardDescription>
            Approve or reject shared pre-A1 drafts and mark stages ready for exam — one review for
            every learner.
          </CardDescription>
          <CardContent>
            <Link
              href="/admin/path"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
              data-testid="admin-shared-path-link"
            >
              Review shared path →
            </Link>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="mt-6">
          <CardTitle>User management</CardTitle>
          <CardDescription>Create, list, and delete user accounts.</CardDescription>
          <CardContent>
            <Link
              href="/admin/users"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Manage users →
            </Link>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="mt-6">
          <CardTitle>AI providers</CardTitle>
          <CardDescription>
            Choose Mac (local), Groq (cloud chat/STT), or Mistral (cloud embeddings). API keys are
            set in server env only — never stored in the database.
          </CardDescription>
          <CardContent className="space-y-4">
            <Field label="Chat provider">
              <select
                value={chatProvider}
                onChange={(e) => setChatProvider(e.target.value as "mac" | "groq")}
                disabled={!loaded || busy}
                className={SELECT_CLASS}
              >
                <option value="mac">Mac (Ollama)</option>
                <option value="groq">Groq (cloud)</option>
              </select>
            </Field>

            {chatProvider === "groq" ? (
              <Field
                label="Groq chat model"
                hint="e.g. llama-3.3-70b-versatile or llama-3.1-8b-instant"
              >
                <Input
                  value={cloudChatModel}
                  onChange={(e) => setCloudChatModel(e.target.value)}
                  placeholder="llama-3.3-70b-versatile"
                  disabled={!loaded || busy}
                  autoComplete="off"
                />
              </Field>
            ) : (
              <>
                <Field
                  label="Base URL"
                  hint="e.g. http://192.168.1.x:11434/v1 or your Tailscale host"
                >
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
              </>
            )}

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

            <Field label="Embeddings provider">
              <select
                value={embeddingsProvider}
                onChange={(e) => setEmbeddingsProvider(e.target.value as "mac" | "mistral")}
                disabled={!loaded || busy}
                className={SELECT_CLASS}
              >
                <option value="mac">Mac (Ollama)</option>
                <option value="mistral">Mistral (cloud)</option>
              </select>
            </Field>

            {embeddingsProvider === "mistral" ? (
              <Field label="Mistral embedding model" hint="e.g. mistral-embed">
                <Input
                  value={cloudEmbeddingsModel}
                  onChange={(e) => setCloudEmbeddingsModel(e.target.value)}
                  placeholder="mistral-embed"
                  disabled={!loaded || busy}
                  autoComplete="off"
                />
              </Field>
            ) : (
              <Field label="Embedding model">
                <Input
                  value={embedModel}
                  onChange={(e) => setEmbedModel(e.target.value)}
                  placeholder="nomic-embed-text"
                  disabled={!loaded || busy}
                  autoComplete="off"
                />
              </Field>
            )}

            <Field label="STT provider">
              <select
                value={sttProvider}
                onChange={(e) => setSttProvider(e.target.value as "mac" | "groq")}
                disabled={!loaded || busy}
                className={SELECT_CLASS}
              >
                <option value="mac">Mac (whisper.cpp)</option>
                <option value="groq">Groq (whisper-large-v3)</option>
              </select>
            </Field>

            {sttProvider === "mac" && (
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
            )}

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
                className={SELECT_CLASS}
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
              className={SELECT_CLASS}
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

      <Card className="mt-6" data-testid="celebration-sound-section">
        <CardTitle>Celebration sounds</CardTitle>
        <CardDescription>
          Short chimes when you finish a session or level up. Turn off if you prefer a quieter
          experience.
        </CardDescription>
        <CardContent className="space-y-4">
          <label className="text-foreground flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              data-testid="sound-muted-checkbox"
              checked={soundMuted}
              disabled={!loaded || soundBusy}
              onChange={(e) => setSoundMuted(e.target.checked)}
              className="border-border accent-accent mt-0.5 size-4 shrink-0 rounded"
            />
            <span>Mute celebration sounds</span>
          </label>

          <div className="pt-1">
            <Button
              data-testid="btn-save-sound"
              onClick={() => void handleSaveSound()}
              disabled={!loaded || soundBusy}
            >
              Save sound settings
            </Button>
          </div>

          {soundBanner && (
            <p
              className={cn("text-sm", soundBanner.tone === "ok" ? "text-success" : "text-danger")}
              role="status"
            >
              {soundBanner.text}
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
                className={SELECT_CLASS}
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
                {GOAL_OPTIONS.map(({ value, label }) => (
                  <SelectPill
                    key={value}
                    data-testid={`profile-goal-btn-${value}`}
                    selected={profileGoals.includes(value)}
                    disabled={profileBusy}
                    onClick={() => toggleProfileGoal(value)}
                    className="justify-center text-center"
                  >
                    {label}
                  </SelectPill>
                ))}
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
