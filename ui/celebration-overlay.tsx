"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from "framer-motion";

import { useCelebrationSoundOnMount } from "@/lib/audio/use-celebration-sound";
import type { ReviewCompleteCelebration } from "@/lib/gamification/celebration-event";
import { resolveMotionPreset } from "@/lib/motion";
import { cn } from "./cn";
import { Mascot, type MascotRegister } from "./mascot";
import { ProgressRing } from "./progress-ring";

const OVERLAY_DURATION_MS = 2_800;
const LEVEL_UP_DURATION_MS = 2_600;
const CONFETTI_COUNT = 28;

const CONFETTI_COLORS = ["bg-accent", "bg-warning", "bg-success", "bg-gradient-to"] as const;

type ConfettiPiece = {
  id: number;
  left: string;
  delay: number;
  duration: number;
  rotate: number;
  color: (typeof CONFETTI_COLORS)[number];
  size: number;
};

function buildConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, id) => ({
    id,
    left: `${4 + Math.random() * 92}%`,
    delay: Math.random() * 0.35,
    duration: 1.6 + Math.random() * 0.9,
    rotate: Math.random() * 360,
    color: CONFETTI_COLORS[id % CONFETTI_COLORS.length]!,
    size: 6 + Math.random() * 6,
  }));
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 22c4-2.5 6.5-5.5 6.5-9.5a5.5 5.5 0 0 0-11 0c0 1.2.4 2.3 1 3.2" />
      <path d="M12 22c-4-2.5-6.5-5.5-6.5-9.5C5.5 8 8 5 12 2c4 3 6.5 6 6.5 10.5 0 4-2.5 7-6.5 9.5Z" />
    </svg>
  );
}

function XpCountUp({ target, reducedMotion }: { target: number; reducedMotion: boolean }) {
  const spring = useSpring(reducedMotion ? target : 0, {
    stiffness: 120,
    damping: 18,
    restDelta: 0.5,
  });
  const display = useTransform(spring, (value) => Math.round(value));

  React.useEffect(() => {
    spring.set(target);
  }, [spring, target]);

  return (
    <motion.span
      data-testid="celebration-xp"
      className="text-accent text-3xl font-bold tabular-nums"
    >
      +<motion.span>{display}</motion.span> XP
    </motion.span>
  );
}

export type CelebrationOverlayProps = {
  event: ReviewCompleteCelebration;
  streakCount: number;
  register?: MascotRegister;
  onComplete: () => void;
  className?: string;
};

/**
 * Full-screen celebration moment for review completion — confetti, streak flame beat,
 * XP count-up, and a happy mascot. Reusable surface for later level-up / unit-complete slices.
 */
export function CelebrationOverlay({
  event,
  streakCount,
  register = "kid",
  onComplete,
  className,
}: CelebrationOverlayProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const celebrate = resolveMotionPreset("celebrate", reducedMotion);
  const confetti = React.useMemo(() => (reducedMotion ? [] : buildConfetti()), [reducedMotion]);
  useCelebrationSoundOnMount("session-complete");

  React.useEffect(() => {
    const timer = window.setTimeout(onComplete, OVERLAY_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Session complete celebration"
      data-testid="celebration-overlay"
      initial={celebrate.initial}
      animate={celebrate.animate}
      exit={celebrate.initial}
      transition={celebrate.transition}
      className={cn(
        "bg-background/85 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm",
        className,
      )}
    >
      {!reducedMotion && (
        <div
          data-testid="celebration-confetti"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          {confetti.map((piece) => (
            <motion.span
              key={piece.id}
              className={cn("absolute rounded-sm opacity-90", piece.color)}
              style={{
                left: piece.left,
                top: "-8%",
                width: piece.size,
                height: piece.size * 1.4,
              }}
              initial={{ y: 0, rotate: piece.rotate, opacity: 1 }}
              animate={{ y: "110vh", rotate: piece.rotate + 180, opacity: 0.2 }}
              transition={{
                duration: piece.duration,
                delay: piece.delay,
                ease: "easeIn",
              }}
            />
          ))}
        </div>
      )}

      <div className="relative flex flex-col items-center gap-5 px-6 text-center">
        <Mascot data-testid="celebration-mascot" state="happy" register={register} />

        <motion.div
          data-testid="celebration-streak"
          className="text-warning flex items-center gap-2"
          initial={celebrate.initial}
          animate={reducedMotion ? celebrate.animate : { opacity: 1, scale: [1, 1.12, 1, 1.08, 1] }}
          transition={
            reducedMotion
              ? celebrate.transition
              : { duration: 0.9, ease: "easeInOut", repeat: 1, repeatDelay: 0.2 }
          }
          aria-label={`${streakCount} day streak`}
        >
          <FlameIcon className="size-10 shrink-0" />
          <span className="text-2xl font-bold tabular-nums">{streakCount}</span>
          <span className="text-muted text-sm font-medium">day streak</span>
        </motion.div>

        <XpCountUp target={event.xpEarned} reducedMotion={reducedMotion} />

        <p className="text-muted text-sm">
          {event.cardCount} card{event.cardCount === 1 ? "" : "s"} reviewed
        </p>
      </div>
    </motion.div>
  );
}

export type LevelUpOverlayProps = {
  newLevel: number;
  register?: MascotRegister;
  onComplete: () => void;
  className?: string;
};

/**
 * Full-screen level-up beat — mascot celebrate state and the new level revealed
 * before the regular session-completion celebration.
 */
export function LevelUpOverlay({
  newLevel,
  register = "kid",
  onComplete,
  className,
}: LevelUpOverlayProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const celebrate = resolveMotionPreset("celebrate", reducedMotion);
  const confetti = React.useMemo(() => (reducedMotion ? [] : buildConfetti()), [reducedMotion]);
  useCelebrationSoundOnMount("level-up");

  React.useEffect(() => {
    const timer = window.setTimeout(onComplete, LEVEL_UP_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Level up to level ${newLevel}`}
      data-testid="level-up-overlay"
      initial={celebrate.initial}
      animate={celebrate.animate}
      exit={celebrate.initial}
      transition={celebrate.transition}
      className={cn(
        "bg-background/90 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm",
        className,
      )}
    >
      {!reducedMotion && (
        <div
          data-testid="level-up-confetti"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          {confetti.map((piece) => (
            <motion.span
              key={piece.id}
              className={cn("absolute rounded-sm opacity-90", piece.color)}
              style={{
                left: piece.left,
                top: "-8%",
                width: piece.size,
                height: piece.size * 1.4,
              }}
              initial={{ y: 0, rotate: piece.rotate, opacity: 1 }}
              animate={{ y: "110vh", rotate: piece.rotate + 180, opacity: 0.2 }}
              transition={{
                duration: piece.duration,
                delay: piece.delay,
                ease: "easeIn",
              }}
            />
          ))}
        </div>
      )}

      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        <Mascot data-testid="level-up-mascot" state="celebrate" register={register} />

        <div className="flex flex-col items-center gap-3">
          <p className="text-muted text-sm font-semibold tracking-wide uppercase">Level up!</p>
          <motion.div
            initial={reducedMotion ? celebrate.animate : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              reducedMotion
                ? celebrate.transition
                : { type: "spring", stiffness: 260, damping: 18, delay: 0.15 }
            }
          >
            <ProgressRing
              data-testid="level-up-ring"
              value={1}
              min={0}
              max={1}
              size="lg"
              aria-label={`Level ${newLevel}`}
              indicatorClassName="stroke-success"
            >
              <span
                data-testid="level-up-number"
                className="text-foreground text-3xl font-bold tabular-nums"
              >
                {newLevel}
              </span>
            </ProgressRing>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export type CelebrationOverlayHostProps = Omit<CelebrationOverlayProps, "onComplete"> & {
  open: boolean;
  onComplete: () => void;
};

/** AnimatePresence wrapper so the overlay can exit smoothly before unmounting. */
export function CelebrationOverlayHost({
  open,
  onComplete,
  ...props
}: CelebrationOverlayHostProps) {
  return (
    <AnimatePresence>
      {open ? <CelebrationOverlay key="celebration" onComplete={onComplete} {...props} /> : null}
    </AnimatePresence>
  );
}

export type LevelUpOverlayHostProps = Omit<LevelUpOverlayProps, "onComplete"> & {
  open: boolean;
  onComplete: () => void;
};

export function LevelUpOverlayHost({ open, onComplete, ...props }: LevelUpOverlayHostProps) {
  return (
    <AnimatePresence>
      {open ? <LevelUpOverlay key="level-up" onComplete={onComplete} {...props} /> : null}
    </AnimatePresence>
  );
}

export type ReviewCelebrationSequenceProps = {
  open: boolean;
  leveledUp: boolean;
  newLevel: number;
  reviewEvent: ReviewCompleteCelebration;
  streakCount: number;
  register?: MascotRegister;
  onComplete: () => void;
};

/**
 * Sequences level-up (when applicable) then session-completion celebrations so they
 * never compete for the screen.
 */
export function ReviewCelebrationSequenceHost({
  open,
  leveledUp,
  newLevel,
  reviewEvent,
  streakCount,
  register = "kid",
  onComplete,
}: ReviewCelebrationSequenceProps) {
  const [phase, setPhase] = React.useState<"level-up" | "review-complete">(
    leveledUp ? "level-up" : "review-complete",
  );

  return (
    <AnimatePresence mode="wait">
      {open && phase === "level-up" ? (
        <LevelUpOverlay
          key="level-up"
          newLevel={newLevel}
          register={register}
          onComplete={() => setPhase("review-complete")}
        />
      ) : null}
      {open && phase === "review-complete" ? (
        <CelebrationOverlay
          key="review-complete"
          event={reviewEvent}
          streakCount={streakCount}
          register={register}
          onComplete={onComplete}
        />
      ) : null}
    </AnimatePresence>
  );
}
