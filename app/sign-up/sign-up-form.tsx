"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { DEFAULT_EXPERIENCE_MODE, type ExperienceMode } from "@/lib/db";
import { applyPalette } from "@/lib/theme";
import { Button, Input } from "@/ui";

import { ExperienceModePicker } from "./experience-mode-picker";

type Step = "mode" | "account";

/**
 * Sign-up is a two-step, mode-aware journey (ADR 0014 / issue #55): pick who the account
 * is for, then create credentials. The chosen mode is submitted with the account and the
 * palette is applied immediately so the very next screen (onboarding) never flashes the
 * wrong theme while the server round-trip completes.
 */
export function SignUpForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("mode");
  const [experienceMode, setExperienceMode] = useState<ExperienceMode | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const mode = experienceMode ?? DEFAULT_EXPERIENCE_MODE;

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, experienceMode: mode }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Sign-up failed");
        return;
      }

      // Apply the chosen palette immediately — the client-side transition to
      // /onboarding must never show a flash of the adult theme for a kid sign-up.
      applyPalette(mode);
      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setPending(false);
    }
  }

  if (step === "mode") {
    return (
      <div data-testid="signup-mode-step" className="flex flex-col gap-5">
        <p className="text-foreground text-sm font-medium">Who is this account for?</p>
        <ExperienceModePicker value={experienceMode} onChange={setExperienceMode} />
        <Button
          type="button"
          size="lg"
          data-testid="signup-mode-continue"
          disabled={!experienceMode}
          onClick={() => setStep("account")}
        >
          Continue
        </Button>
        <p className="text-muted text-center text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-accent font-medium underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      data-testid="signup-account-step"
      className="flex flex-col gap-4"
    >
      <button
        type="button"
        data-testid="signup-mode-back"
        onClick={() => setStep("mode")}
        className="text-muted hover:text-foreground self-start text-xs font-medium underline underline-offset-4"
      >
        ← Change ({experienceMode === "kid" ? "For kids" : "For adults"})
      </button>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-foreground text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-foreground text-sm font-medium">
          Password <span className="text-muted font-normal">(min 8 characters)</span>
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-foreground text-sm font-medium">
          Confirm password
        </label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} size="lg">
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-muted text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-accent font-medium underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
