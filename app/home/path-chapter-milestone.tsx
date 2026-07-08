import type { ExperienceMode } from "@/lib/db";
import type { PathTier } from "@/lib/path/pre-a1";
import { Card, cn } from "@/ui";
import { TrophyIcon } from "../icons";

// The "chapter-complete moment" rendered on the path once every unit of a level tier is
// done (issue #62) — so moving e.g. pre-A1 → A1 or A1 → A2 feels like an achievement, not
// just the next row in a list. Full celebration/juice (confetti, sound, etc.) arrives with
// workstream 5 (gamification); this is only the path-level rendering of the milestone.

const MODE_COPY: Record<ExperienceMode, (tier: PathTier, nextTier?: PathTier) => string> = {
  kid: (tier, nextTier) =>
    nextTier
      ? `You finished ${tierLabel(tier)}! Onward to ${tierLabel(nextTier)}!`
      : `You finished ${tierLabel(tier)}!`,
  adult: (tier, nextTier) =>
    nextTier
      ? `${tierLabel(tier)} complete — moving on to ${tierLabel(nextTier)}.`
      : `${tierLabel(tier)} complete.`,
};

function tierLabel(tier: PathTier): string {
  return tier === "pre-A1" ? "the basics" : `level ${tier}`;
}

export function PathChapterMilestone({
  tier,
  nextTier,
  mode,
}: {
  tier: PathTier;
  nextTier?: PathTier;
  mode: ExperienceMode;
}) {
  const kid = mode === "kid";

  return (
    <Card
      data-testid={`chapter-complete-${tier}`}
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
        {MODE_COPY[mode](tier, nextTier)}
      </p>
    </Card>
  );
}
