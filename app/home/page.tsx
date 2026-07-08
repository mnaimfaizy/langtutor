import Link from "next/link";

import { Badge, buttonClassName, Card } from "@/ui";
import {
  ActivityIcon,
  BookIcon,
  HeadphonesIcon,
  LayersIcon,
  MicIcon,
  PencilIcon,
  RepeatIcon,
} from "../icons";
import { DailyQuests } from "./daily-quests";
import { LearningPath } from "./learning-path";

const skills = [
  { name: "Reading", blurb: "Level-appropriate passages with tap-to-define.", icon: BookIcon },
  { name: "Writing", blurb: "Prompts with structured, corrective feedback.", icon: PencilIcon },
  { name: "Listening", blurb: "Dictation and comprehension with TTS.", icon: HeadphonesIcon },
  { name: "Speaking", blurb: "Pronunciation practice via local transcription.", icon: MicIcon },
];

const primaryActions = [
  { href: "/reading", label: "Start reading", testId: "btn-reading", variant: "gradient" as const },
  {
    href: "/writing",
    label: "Start writing",
    testId: "btn-writing",
    variant: "secondary" as const,
  },
  {
    href: "/listening",
    label: "Start listening",
    testId: "btn-listening",
    variant: "secondary" as const,
  },
  {
    href: "/speaking",
    label: "Start speaking",
    testId: "btn-speaking",
    variant: "secondary" as const,
  },
];

const secondaryActions = [
  { href: "/review", label: "Review cards", testId: "btn-start-review", icon: RepeatIcon },
  { href: "/deck", label: "Add words", testId: "btn-manage-deck", icon: LayersIcon },
  { href: "/diagnostics", label: "Diagnostics", testId: "btn-diagnostics", icon: ActivityIcon },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full max-w-2xl">
        <Badge variant="accent" className="gap-2">
          <span className="bg-accent size-1.5 rounded-full" aria-hidden />
          v1 · all modules shipped
        </Badge>

        <h1 className="text-foreground mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
          Lang-Tutor
        </h1>
        <p className="text-muted mt-4 max-w-xl text-lg leading-8">
          A private, local-first English tutor. Reading, writing, listening, and speaking —
          adaptive, gamified, and fully offline-capable.
        </p>

        <LearningPath />

        <DailyQuests />

        <div className="mt-8 flex flex-wrap gap-3">
          {primaryActions.map(({ href, label, testId, variant }) => (
            <Link
              key={href}
              href={href}
              data-testid={testId}
              className={buttonClassName({ variant, size: "lg" })}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          {secondaryActions.map(({ href, label, testId, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              data-testid={testId}
              className={buttonClassName({ variant: "secondary", size: "md", className: "gap-2" })}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {skills.map(({ name, blurb, icon: Icon }) => (
            <li key={name}>
              <Card className="h-full">
                <div className="flex items-start gap-3">
                  <span className="bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-foreground text-sm font-semibold">{name}</h2>
                    <p className="text-muted mt-1 text-sm leading-6">{blurb}</p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
