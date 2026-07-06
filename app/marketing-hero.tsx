import Link from "next/link";

import { Badge, buttonClassName, Card } from "@/ui";
import { BookIcon, HeadphonesIcon, MicIcon, PencilIcon } from "./icons";

const visualSkills = [
  { name: "Reading", icon: BookIcon },
  { name: "Writing", icon: PencilIcon },
  { name: "Listening", icon: HeadphonesIcon },
  { name: "Speaking", icon: MicIcon },
];

/**
 * A static, decorative "session recap" mockup standing in for a product screenshot —
 * built from real design tokens rather than a checked-in raster image, so it renders
 * identically (and instantly) in every palette without an asset pipeline.
 */
function ProductVisual() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-sm">
      <div
        className="from-gradient-from via-gradient-via to-gradient-to pointer-events-none absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br opacity-20 blur-3xl"
        style={{ transform: "scale(1.15)" }}
      />
      <Card variant="glass" className="p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <Badge variant="gradient">Level 6</Badge>
          <span className="text-muted text-sm font-medium tabular-nums">1,240 XP</span>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-3">
          {visualSkills.map(({ name, icon: Icon }) => (
            <div key={name} className="flex flex-col items-center gap-1.5">
              <span className="bg-accent/15 text-accent flex size-11 items-center justify-center rounded-xl">
                <Icon className="size-5" />
              </span>
              <span className="text-muted text-[11px] font-medium">{name}</span>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <div className="text-muted mb-1.5 flex items-center justify-between text-xs font-medium">
            <span>Today&apos;s review</span>
            <span>18 / 24 cards</span>
          </div>
          <div className="bg-foreground/10 h-2 w-full rounded-full">
            <div className="from-gradient-from via-gradient-via to-gradient-to shadow-glow h-full w-3/4 rounded-full bg-gradient-to-r" />
          </div>
        </div>
      </Card>
    </div>
  );
}

export function MarketingHero() {
  return (
    <section className="relative overflow-hidden px-4 pt-10 pb-14 sm:px-6 sm:pt-16 sm:pb-20">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-12">
        <div className="text-center md:text-left">
          <Badge variant="accent" className="gap-2">
            <span className="bg-accent size-1.5 rounded-full" aria-hidden />
            Local-first · AI-powered
          </Badge>

          <h1 className="text-foreground mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            Lang-Tutor — your private AI English tutor
          </h1>
          <p className="text-muted mx-auto mt-4 max-w-xl text-lg leading-8 md:mx-0">
            Reading, writing, listening, and speaking — practiced with an adaptive AI teacher and a
            spaced-repetition vocabulary engine. Fully offline-capable, with your learning data
            staying on your own network.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
            <Link
              href="/sign-up"
              data-testid="btn-marketing-sign-up"
              className={buttonClassName({ variant: "gradient", size: "lg" })}
            >
              Sign up free
            </Link>
            <Link
              href="/login"
              data-testid="btn-marketing-login"
              className={buttonClassName({ variant: "secondary", size: "lg" })}
            >
              Sign in
            </Link>
          </div>
        </div>

        <ProductVisual />
      </div>
    </section>
  );
}
