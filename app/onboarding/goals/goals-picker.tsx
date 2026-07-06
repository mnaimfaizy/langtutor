"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { LearnerGoal, Profile } from "@/lib/db";
import { getContentRepository } from "@/lib/registry";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";

const GOAL_OPTIONS: { value: LearnerGoal; label: string; description: string }[] = [
  { value: "travel", label: "Travel", description: "Conversations, directions, hotels" },
  { value: "work", label: "Work", description: "Emails, meetings, presentations" },
  { value: "exam", label: "Exam prep", description: "IELTS, TOEFL, Cambridge" },
  { value: "general", label: "General", description: "Everyday fluency" },
];

export function GoalsPicker() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<LearnerGoal>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getContentRepository()
      .getProfile()
      .then((profile) => {
        if (!profile?.cefrLevel) {
          router.replace("/onboarding");
          return;
        }
        if (profile.goals.length > 0) {
          router.replace("/home");
          return;
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  function toggleGoal(goal: LearnerGoal) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(goal)) next.delete(goal);
      else next.add(goal);
      return next;
    });
  }

  async function handleSave() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const repo = getContentRepository();
      const existing = await repo.getProfile();
      if (!existing?.cefrLevel) {
        router.replace("/onboarding");
        return;
      }
      const profile: Profile = { ...existing, goals: [...selected] };
      await repo.saveProfile(profile);
      router.replace("/home");
    } catch {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div
      data-testid="goals-picker"
      className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16"
    >
      <div className="w-full max-w-sm">
        <h1 className="text-foreground text-center text-3xl font-semibold tracking-tight">
          What&apos;s your goal?
        </h1>
        <p className="text-muted mt-4 text-center text-base leading-7">
          Pick one or more — you can change this later in Settings.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          {GOAL_OPTIONS.map(({ value, label, description }) => {
            const active = selected.has(value);
            return (
              <button
                key={value}
                data-testid={`goal-btn-${value}`}
                aria-pressed={active}
                onClick={() => toggleGoal(value)}
                className={cn(
                  "rounded-xl border px-4 py-4 text-left transition-colors",
                  active
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border text-muted hover:border-foreground/30",
                )}
              >
                <span className="block text-sm font-medium">{label}</span>
                <span className="mt-0.5 block text-xs opacity-80">{description}</span>
              </button>
            );
          })}
        </div>

        <Button
          data-testid="btn-save-goals"
          size="lg"
          className="mt-8 w-full"
          disabled={selected.size === 0 || saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Start learning"}
        </Button>
      </div>
    </div>
  );
}
