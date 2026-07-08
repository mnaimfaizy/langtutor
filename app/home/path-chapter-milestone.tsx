import type { Cefr, ExperienceMode } from "@/lib/db";
import { Card, cn } from "@/ui";
import { TrophyIcon } from "../icons";

// The "chapter-complete moment" rendered on the path once every unit of a CEFR level is
// done (issue #62) — so moving e.g. A1 → A2 feels like an achievement, not just the next row
// in a list. Full celebration/juice (confetti, sound, etc.) arrives with workstream 5
// (gamification); this is only the path-level rendering of the milestone.

const MODE_COPY: Record<ExperienceMode, (cefr: Cefr, nextCefr?: Cefr) => string> = {
  kid: (cefr, nextCefr) =>
    nextCefr ? `You finished level ${cefr}! Onward to ${nextCefr}!` : `You finished level ${cefr}!`,
  adult: (cefr, nextCefr) =>
    nextCefr ? `Level ${cefr} complete — moving on to ${nextCefr}.` : `Level ${cefr} complete.`,
};

export function PathChapterMilestone({
  cefr,
  nextCefr,
  mode,
}: {
  cefr: Cefr;
  nextCefr?: Cefr;
  mode: ExperienceMode;
}) {
  const kid = mode === "kid";

  return (
    <Card
      data-testid={`chapter-complete-${cefr}`}
      variant="glass"
      className={cn(
        "from-gradient-from/15 via-gradient-via/15 to-gradient-to/15 border-accent/30 flex items-center gap-3 bg-gradient-to-r",
        kid && "rounded-2xl",
      )}
    >
      <span
        className={cn(
          "from-gradient-from via-gradient-via to-gradient-to text-gradient-foreground shadow-glow flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br",
          kid ? "size-12" : "size-9",
        )}
      >
        <TrophyIcon className={kid ? "size-6" : "size-5"} />
      </span>
      <p className={cn("text-foreground font-semibold", kid ? "text-base" : "text-sm")}>
        {MODE_COPY[mode](cefr, nextCefr)}
      </p>
    </Card>
  );
}
