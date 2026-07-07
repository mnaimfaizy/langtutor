"use client";

import type { ExperienceMode } from "@/lib/db";
import { cn } from "@/ui";

import { GraduationCapIcon, SmileIcon } from "../icons";

/**
 * Kid/adult chooser for the sign-up flow (issue #55 / ADR 0014). Two large illustrated
 * tiles rather than a bare radio button — the choice is a first-class step, not a
 * checkbox afterthought, because it drives the palette and copy register from the very
 * first authenticated render.
 */

interface ModeOption {
  value: ExperienceMode;
  label: string;
  description: string;
  icon: typeof GraduationCapIcon;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "kid",
    label: "For kids",
    description: "Bright colors, playful wording, big friendly buttons.",
    icon: SmileIcon,
  },
  {
    value: "adult",
    label: "For adults",
    description: "Premium dark theme, focused and distraction-free.",
    icon: GraduationCapIcon,
  },
];

export function ExperienceModePicker({
  value,
  onChange,
}: {
  value: ExperienceMode | undefined;
  onChange: (mode: ExperienceMode) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Who is this account for?" className="grid grid-cols-2 gap-3">
      {MODE_OPTIONS.map(({ value: optionValue, label, description, icon: Icon }) => {
        const selected = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={`signup-mode-btn-${optionValue}`}
            onClick={() => onChange(optionValue)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border px-4 py-5 text-center transition-colors",
              selected
                ? "border-accent bg-accent/10 text-foreground shadow-glow"
                : "border-border text-muted hover:border-foreground/30",
            )}
          >
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-full",
                selected ? "bg-accent/20 text-accent" : "bg-foreground/[0.06] text-muted",
              )}
            >
              <Icon className="size-6" />
            </span>
            <span className="text-foreground text-sm font-semibold">{label}</span>
            <span className="text-muted text-xs leading-5">{description}</span>
          </button>
        );
      })}
    </div>
  );
}
