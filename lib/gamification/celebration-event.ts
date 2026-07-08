/**
 * Celebration preset input — emitted when a learnable moment completes (ADR 0019, issue #76).
 *
 * Review-session completion and unit completion both produce events of this shape; later
 * slices subscribe and map each kind to motion/sound presets. Pure `lib/` contract — no seam.
 */
export interface ReviewCompleteCelebration {
  kind: "review-complete";
  cardCount: number;
  xpEarned: number;
  leveledUp: boolean;
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
  | UnitCompleteCelebration
  | LevelUpCelebration;
