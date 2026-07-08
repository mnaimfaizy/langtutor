import { Card, CardDescription, CardTitle } from "./card";
import { cn } from "./cn";

function LockGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export type CollectibleCardProps = {
  id: string;
  icon: string;
  label: string;
  description: string;
  /** Bundled art for unit-completion creatures; achievements use `icon` only. */
  imageSrc?: string;
  earned: boolean;
  className?: string;
};

/**
 * Shared earned/locked presentation for path creatures and migrated achievements (issue #87).
 */
export function CollectibleCard({
  id,
  icon,
  label,
  description,
  imageSrc,
  earned,
  className,
}: CollectibleCardProps) {
  return (
    <Card
      data-testid={`collectible-card-${id}`}
      data-earned={earned ? "true" : "false"}
      className={cn(
        "flex h-full flex-col items-center p-4 text-center",
        earned ? "border-accent/25 bg-accent/5" : "border-border/60 bg-muted/15",
        className,
      )}
    >
      <div className="relative mb-3 flex size-20 items-center justify-center">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- bundled static SVG art
          <img
            src={imageSrc}
            alt=""
            width={72}
            height={72}
            className={cn(
              "size-20 rounded-xl object-contain p-1",
              earned ? "bg-accent/10" : "opacity-25 brightness-0 grayscale",
            )}
          />
        ) : (
          <span
            aria-hidden
            className={cn(
              "flex size-20 items-center justify-center rounded-xl text-4xl",
              earned ? "bg-accent/10" : "bg-muted/30 opacity-35 grayscale",
            )}
          >
            {icon}
          </span>
        )}
        {!earned && (
          <span
            className="bg-background/80 text-muted absolute inset-0 flex items-center justify-center rounded-xl"
            aria-hidden
          >
            <LockGlyph className="size-6" />
          </span>
        )}
      </div>

      <CardTitle className="text-base">{label}</CardTitle>
      <CardDescription className={cn("mt-1 line-clamp-3", !earned && "text-muted/70")}>
        {earned ? description : "Complete the challenge to unlock."}
      </CardDescription>
    </Card>
  );
}
