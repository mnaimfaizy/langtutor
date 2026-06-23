import Link from "next/link";

const skills = [
  { name: "Reading", blurb: "Level-appropriate passages with tap-to-define." },
  { name: "Writing", blurb: "Prompts with structured, corrective feedback." },
  { name: "Listening", blurb: "Dictation and comprehension with TTS." },
  { name: "Speaking", blurb: "Pronunciation practice via local transcription." },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <span className="border-foreground/10 bg-foreground/[0.03] text-muted inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
          <span className="bg-accent size-1.5 rounded-full" />
          Phase 5 · listening
        </span>

        <h1 className="text-foreground mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
          Lang-Tutor
        </h1>
        <p className="text-muted mt-4 max-w-xl text-lg leading-8">
          A private, local-first English tutor. Reading, writing, listening, and speaking —
          adaptive, gamified, and fully offline-capable.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/reading"
            className="bg-accent text-accent-foreground inline-flex h-11 items-center rounded-xl px-6 text-base font-medium transition-opacity hover:opacity-90"
            data-testid="btn-reading"
          >
            Start reading
          </Link>
          <Link
            href="/writing"
            className="border-border text-foreground hover:bg-foreground/[0.04] inline-flex h-11 items-center rounded-xl border px-6 text-base font-medium transition-colors"
            data-testid="btn-writing"
          >
            Start writing
          </Link>
          <Link
            href="/listening"
            className="border-border text-foreground hover:bg-foreground/[0.04] inline-flex h-11 items-center rounded-xl border px-6 text-base font-medium transition-colors"
            data-testid="btn-listening"
          >
            Start listening
          </Link>
          <Link
            href="/review"
            className="border-border text-foreground hover:bg-foreground/[0.04] inline-flex h-11 items-center rounded-xl border px-6 text-base font-medium transition-colors"
            data-testid="btn-start-review"
          >
            Review cards
          </Link>
          <Link
            href="/deck"
            className="border-border text-foreground hover:bg-foreground/[0.04] inline-flex h-11 items-center rounded-xl border px-6 text-base font-medium transition-colors"
            data-testid="btn-manage-deck"
          >
            Add words
          </Link>
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {skills.map((skill) => (
            <li
              key={skill.name}
              className="border-foreground/10 bg-foreground/[0.02] rounded-xl border p-4"
            >
              <h2 className="text-foreground text-sm font-semibold">{skill.name}</h2>
              <p className="text-muted mt-1 text-sm leading-6">{skill.blurb}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
