import type { FsrsState } from "@/lib/db";

/** Learner-facing FSRS mastery phase derived from a card's scheduling snapshot. */
export type MasteryLabel = "new" | "learning" | "review" | "relearning";

const STATE_TO_LABEL: Record<number, MasteryLabel> = {
  0: "new",
  1: "learning",
  2: "review",
  3: "relearning",
};

/** Maps a ts-fsrs `State` enum value (0–3) to a learner-facing mastery label. */
export function masteryLabelFromState(state: number): MasteryLabel {
  return STATE_TO_LABEL[state] ?? "new";
}

/** Convenience wrapper that reads `state` from an {@link FsrsState} snapshot. */
export function masteryLabelFromFsrs(fsrs: Pick<FsrsState, "state">): MasteryLabel {
  return masteryLabelFromState(fsrs.state);
}

/** Human-readable label for UI badges (capitalized). */
export function masteryLabelDisplay(label: MasteryLabel): string {
  switch (label) {
    case "new":
      return "New";
    case "learning":
      return "Learning";
    case "review":
      return "Review";
    case "relearning":
      return "Relearning";
  }
}

/** Formats the card's next review due date relative to @now. */
export function formatNextDue(due: Date, now = new Date()): string {
  const diffMs = due.getTime() - now.getTime();
  if (diffMs <= 0) return "Due now";

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDue = new Date(due);
  startOfDue.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86_400_000);

  if (dayDiff === 0) {
    return `Due today, ${due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  if (dayDiff === 1) return "Due tomorrow";
  if (dayDiff < 7) return `Due in ${dayDiff} days`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
