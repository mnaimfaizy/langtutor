/**
 * Celebration preset input — emitted when a learnable moment completes (ADR 0019, issue #76).
 *
 * Review-session completion, path activity completion, and unit completion all produce
 * events of this shape; later slices subscribe and map each kind to motion/sound presets.
 */
export interface ReviewCompleteCelebration {
  kind: "review-complete";
  cardCount: number;
  xpEarned: number;
  leveledUp: boolean;
  at: Date;
}

export interface ActivityCompleteCelebration {
  kind: "activity-complete";
  unitId: number;
  activityIndex: number;
  at: Date;
}

export interface UnitCompleteCelebration {
  kind: "unit-complete";
  unitId: number;
  unitIndex: number;
  at: Date;
}

export interface LevelUpCelebration {
  kind: "level-up";
  newLevel: number;
  at: Date;
}

export type CelebrationEvent =
  | ReviewCompleteCelebration
  | ActivityCompleteCelebration
  | UnitCompleteCelebration
  | LevelUpCelebration;
