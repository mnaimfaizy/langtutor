import { Badge, Card } from "@/ui";
import { SparklesIcon } from "./icons";

export function MarketingKidModeSection() {
  return (
    <section
      className="bg-surface-2/60 px-4 py-14 sm:px-6 sm:py-20"
      aria-labelledby="marketing-kid-mode-heading"
    >
      <div className="mx-auto w-full max-w-4xl">
        <Card variant="glass" className="flex flex-col items-center gap-6 p-8 text-center sm:p-10">
          <span className="bg-accent/15 text-accent flex size-14 items-center justify-center rounded-2xl">
            <SparklesIcon className="size-7" />
          </span>

          <div>
            <Badge variant="accent" size="sm" className="mb-3">
              Kid Mode
            </Badge>
            <h2
              id="marketing-kid-mode-heading"
              className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Built for grown-ups. Ready for kids too.
            </h2>
            <p className="text-muted mx-auto mt-3 max-w-xl text-lg leading-8">
              Switch on Kid Mode for a brighter, friendlier interface and gentler tone — the same
              adaptive engine and privacy, tuned for younger learners. Parents can turn it on
              anytime from Settings.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
