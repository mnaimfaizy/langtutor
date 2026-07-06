import { Card, CardDescription, CardTitle } from "@/ui";
import { ActivityIcon, RepeatIcon } from "./icons";

const MASTERY_SWATCHES = [
  { tier: "mastering", className: "size-4 rounded-sm bg-success/70" },
  { tier: "developing", className: "size-4 rounded-sm bg-warning/70" },
  { tier: "struggling", className: "size-4 rounded-sm bg-danger/70" },
  { tier: "mastering", className: "size-4 rounded-sm bg-success/70" },
  { tier: "mastering", className: "size-4 rounded-sm bg-success/70" },
  { tier: "developing", className: "size-4 rounded-sm bg-warning/70" },
] as const;

export function MarketingSrsSection() {
  return (
    <section
      className="bg-surface-2/60 px-4 py-14 sm:px-6 sm:py-20"
      aria-labelledby="marketing-srs-heading"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="marketing-srs-heading"
            className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Practice that remembers what you forget
          </h2>
          <p className="text-muted mt-3 text-lg leading-8">
            Two engines run quietly behind every session, so time studying always goes to the right
            thing.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <span className="bg-accent/15 text-accent flex size-11 items-center justify-center rounded-xl">
                <RepeatIcon className="size-5" />
              </span>
              <CardTitle className="mt-4 text-base">FSRS vocabulary review</CardTitle>
              <CardDescription>
                Every new word joins a spaced-repetition deck powered by FSRS — reviews are
                scheduled right before you&apos;d otherwise forget.
              </CardDescription>
            </div>
            <div aria-hidden className="flex shrink-0 items-end gap-1.5 self-center">
              <span className="bg-accent/25 h-6 w-2 rounded-full" />
              <span className="bg-accent/40 h-10 w-2 rounded-full" />
              <span className="bg-accent/60 h-14 w-2 rounded-full" />
              <span className="bg-accent h-9 w-2 rounded-full" />
              <span className="bg-accent/40 h-16 w-2 rounded-full" />
            </div>
          </Card>

          <Card className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <span className="bg-accent/15 text-accent flex size-11 items-center justify-center rounded-xl">
                <ActivityIcon className="size-5" />
              </span>
              <CardTitle className="mt-4 text-base">Adaptive, weakness-driven</CardTitle>
              <CardDescription>
                A diagnostics engine tracks errors across every skill and steers new content toward
                what you&apos;re actually struggling with.
              </CardDescription>
            </div>
            <div
              aria-hidden
              className="grid shrink-0 grid-cols-3 gap-1.5 self-center"
              data-testid="marketing-mastery-swatches"
            >
              {MASTERY_SWATCHES.map(({ tier, className }, i) => (
                <span key={`${tier}-${i}`} className={className} />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
