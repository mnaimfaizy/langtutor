"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import type { Achievement, Card as CardRow } from "@/lib/db";
import { DEFAULT_EXPERIENCE_MODE, type ExperienceMode } from "@/lib/db";
import {
  ACHIEVEMENT_DEFS,
  applyReview,
  localDateString,
  recordCelebration,
} from "@/lib/gamification";
import type {
  LevelUpCelebration,
  ReviewCompleteCelebration,
} from "@/lib/gamification/celebration-event";
import { completeUnitActivity } from "@/lib/path/unit-player";
import { buildScopedReviewQueue, parseScopedReviewCardIds } from "@/lib/deck";
import { getContentRepository } from "@/lib/registry";
import { CEFR_BADGE_VARIANT } from "@/lib/cefr";
import { resolveMotionPreset } from "@/lib/motion";
import { scheduleCard } from "@/lib/srs";
import type { SrsRating } from "@/lib/srs";
import { Badge, Button, Card, Progress, ReviewCelebrationSequenceHost, Skeleton } from "@/ui";
import { cn } from "@/ui/cn";
import { EmbeddedUnitBanner, useEmbeddedActivity } from "@/app/path/embedded";

type Phase = "loading" | "empty" | "reviewing" | "summary" | "error";

interface RatingCounts {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

interface SessionResult {
  xpEarned: number;
  leveledUp: boolean;
  newLevel: number;
  newAchievements: Achievement[];
}

const ACH_DEF_MAP = new Map(ACHIEVEMENT_DEFS.map((d) => [d.id, d]));

function ratingColor(r: SrsRating): string {
  switch (r) {
    case "again":
      return "text-danger";
    case "hard":
      return "text-warning";
    case "good":
      return "text-accent";
    case "easy":
      return "text-success";
  }
}

const achievementVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

export function ReviewSession() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardsParam = searchParams.get("cards");
  const scopedCardIds = useMemo(() => parseScopedReviewCardIds(cardsParam), [cardsParam]);
  const reducedMotion = useReducedMotion() ?? false;
  const enter = resolveMotionPreset("enter", reducedMotion);
  const celebrate = resolveMotionPreset("celebrate", reducedMotion);
  const embedded = useEmbeddedActivity();

  const achievementItem = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: enter.transition },
  };

  const [phase, setPhase] = useState<Phase>("loading");
  const [cards, setCards] = useState<CardRow[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [counts, setCounts] = useState<RatingCounts>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [result, setResult] = useState<SessionResult | null>(null);
  const [celebration, setCelebration] = useState<{
    event: ReviewCompleteCelebration;
    streakCount: number;
    leveledUp: boolean;
    newLevel: number;
  } | null>(null);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>(DEFAULT_EXPERIENCE_MODE);
  const [returning, setReturning] = useState(false);
  const ratingInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    void getContentRepository()
      .getProfile()
      .then((profile) => {
        if (!active) return;
        setExperienceMode(profile?.experienceMode ?? DEFAULT_EXPERIENCE_MODE);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const now = new Date();
    void getContentRepository()
      .getDueCards(now)
      .then((due) => {
        if (!active) return;
        const queue = scopedCardIds ? buildScopedReviewQueue(due, scopedCardIds, now) : due;
        if (queue.length === 0) {
          setPhase("empty");
        } else {
          setCards(queue);
          setPhase("reviewing");
        }
      })
      .catch(() => {
        if (active) setPhase("empty");
      });
    return () => {
      active = false;
    };
  }, [cardsParam, scopedCardIds]);

  /**
   * Reports the activity done back into path state before returning to the unit — whether
   * the learner actually had cards to review ("summary") or the deck was already caught up
   * ("empty"), either way they engaged with the review activity (ADR 0015, issue #59). Awaits
   * the write before navigating so the unit view never reads stale (not-yet-persisted) state.
   */
  async function completeAndReturnToUnit() {
    if (!embedded) return;
    setReturning(true);
    try {
      const repo = getContentRepository();
      const units = await repo.getUnits();
      await completeUnitActivity(repo, units, embedded.unitId, embedded.activityIndex);
    } finally {
      router.push(`/path/${embedded.unitId}`);
    }
  }

  async function handleRate(rating: SrsRating) {
    if (ratingInFlight.current) return;
    ratingInFlight.current = true;

    const card = cards[currentIndex];
    if (!card) {
      ratingInFlight.current = false;
      return;
    }

    try {
      const now = new Date();
      const newFsrs = scheduleCard(card.fsrs, rating, now);
      const repo = getContentRepository();
      await repo.updateCard(card.id, { fsrs: newFsrs });

      const newCounts = { ...counts, [rating]: counts[rating] + 1 };
      setCounts(newCounts);
      setRevealed(false);

      if (currentIndex + 1 >= cards.length) {
        const total = newCounts.again + newCounts.hard + newCounts.good + newCounts.easy;
        const today = localDateString(now);
        const currentGamState = await repo.getGamification();
        const { newState, xpEarned, newAchievements, leveledUp } = applyReview(currentGamState, {
          cardCount: total,
          today,
          now,
        });
        const celebrationEvent: ReviewCompleteCelebration = {
          kind: "review-complete",
          cardCount: total,
          xpEarned,
          leveledUp,
          at: now,
        };
        await repo.saveGamification(newState);
        await recordCelebration(repo, celebrationEvent);
        if (leveledUp) {
          const levelUpEvent: LevelUpCelebration = {
            kind: "level-up",
            newLevel: newState.level,
            at: now,
          };
          await recordCelebration(repo, levelUpEvent);
        }
        setCelebration({
          event: celebrationEvent,
          streakCount: newState.streakCount,
          leveledUp,
          newLevel: newState.level,
        });
        setCelebrationOpen(true);
        setResult({ xpEarned, leveledUp, newLevel: newState.level, newAchievements });
        setPhase("summary");
      } else {
        setCurrentIndex((i) => i + 1);
      }
    } catch {
      setPhase("error");
    } finally {
      ratingInFlight.current = false;
    }
  }

  if (phase === "loading") {
    return (
      <div
        data-testid="review-session"
        className="flex flex-1 flex-col items-center justify-center px-6 py-16"
      >
        <div className="w-full max-w-sm space-y-4">
          <Skeleton className="h-2 w-full" />
          <Card className="rounded-2xl p-8">
            <Skeleton className="mx-auto h-8 w-32" />
            <Skeleton className="mt-8 h-10 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <div
        data-testid="review-session"
        className="flex flex-1 flex-col items-center justify-center px-6 py-16"
      >
        <div data-testid="review-empty" className="w-full max-w-sm text-center">
          {embedded && <EmbeddedUnitBanner unitId={embedded.unitId} />}
          <h1 className="text-foreground text-2xl font-semibold">All caught up!</h1>
          <p className="text-muted mt-3 text-base leading-7">
            No cards are due right now. Check back later.
          </p>
          {embedded ? (
            <Button
              data-testid="btn-back-to-unit-or-home"
              variant="secondary"
              size="lg"
              className="mt-8"
              disabled={returning}
              onClick={() => void completeAndReturnToUnit()}
            >
              {returning ? "Saving…" : "Back to unit"}
            </Button>
          ) : (
            <Link href="/home" className="mt-8 inline-block">
              <Button data-testid="btn-back-to-unit-or-home" variant="secondary" size="lg">
                Back to home
              </Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (phase === "summary") {
    const total = counts.again + counts.hard + counts.good + counts.easy;
    return (
      <>
        {celebration && (
          <ReviewCelebrationSequenceHost
            key={celebration.event.at.getTime()}
            open={celebrationOpen}
            leveledUp={celebration.leveledUp}
            newLevel={celebration.newLevel}
            reviewEvent={celebration.event}
            streakCount={celebration.streakCount}
            register={experienceMode}
            onComplete={() => setCelebrationOpen(false)}
          />
        )}
        <div
          data-testid="review-session"
          className="flex flex-1 flex-col items-center justify-center px-6 py-16"
        >
          <motion.div
            data-testid="review-summary"
            className="w-full max-w-sm"
            initial={celebrate.initial}
            animate={celebrate.animate}
            transition={celebrate.transition}
          >
            {embedded && <EmbeddedUnitBanner unitId={embedded.unitId} />}
            <h1 className="text-foreground text-center text-3xl font-semibold">Session complete</h1>
            <p className="text-muted mt-2 text-center text-base">{total} cards reviewed</p>

            {result && (
              <div className="mt-4 text-center">
                <motion.p
                  data-testid="summary-xp"
                  className="text-accent text-lg font-semibold"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.15 }}
                >
                  +{result.xpEarned} XP
                </motion.p>

                {result.leveledUp && (
                  <motion.p
                    className="text-success mt-1 text-sm font-semibold"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                  >
                    ★ Level up! Now level {result.newLevel}
                  </motion.p>
                )}

                {result.newAchievements.length > 0 && (
                  <motion.ul
                    className="mt-2 space-y-1"
                    variants={achievementVariants}
                    initial="hidden"
                    animate="show"
                  >
                    {result.newAchievements.map((a) => (
                      <motion.li
                        key={a.id}
                        data-testid="summary-new-achievement"
                        className="text-warning text-sm"
                        variants={achievementItem}
                      >
                        {(() => {
                          const def = ACH_DEF_MAP.get(a.id);
                          return def
                            ? `${def.icon} ${def.label} unlocked!`
                            : `Achievement unlocked: ${a.id.replace(/_/g, " ")}`;
                        })()}
                      </motion.li>
                    ))}
                  </motion.ul>
                )}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              {(["again", "hard", "good", "easy"] as const).map((r) => (
                <Card key={r} data-testid={`summary-count-${r}`} className="p-4 text-center">
                  <p className={cn("text-2xl font-bold", ratingColor(r))}>{counts[r]}</p>
                  <p className="text-muted mt-1 text-sm capitalize">{r}</p>
                </Card>
              ))}
            </div>

            {embedded ? (
              <Button
                data-testid="btn-back-to-unit-or-home"
                variant="gradient"
                size="lg"
                className="mt-8 w-full"
                disabled={returning}
                onClick={() => void completeAndReturnToUnit()}
              >
                {returning ? "Saving…" : "Back to unit"}
              </Button>
            ) : (
              <Link href="/home" className="mt-8 block">
                <Button
                  data-testid="btn-back-to-unit-or-home"
                  variant="gradient"
                  size="lg"
                  className="w-full"
                >
                  Back to home
                </Button>
              </Link>
            )}
          </motion.div>
        </div>
      </>
    );
  }

  if (phase === "error") {
    return (
      <div
        data-testid="review-session"
        className="flex flex-1 flex-col items-center justify-center px-6 py-16"
      >
        <div data-testid="review-error" className="w-full max-w-sm text-center">
          <p className="text-danger text-base font-semibold">Something went wrong</p>
          <p className="text-muted mt-2 text-sm">
            Could not save your progress. Check available storage and try again.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button variant="secondary" size="lg" onClick={() => setPhase("reviewing")}>
              Retry
            </Button>
            <Link href="/home">
              <Button variant="secondary" size="lg">
                Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // reviewing
  const card = cards[currentIndex];
  const total = cards.length;

  return (
    <div
      data-testid="review-session"
      className="flex flex-1 flex-col items-center justify-center px-6 py-16"
    >
      <div className="w-full max-w-sm">
        {embedded && <EmbeddedUnitBanner unitId={embedded.unitId} />}
        <div className="text-muted mb-3 flex items-center justify-between text-sm">
          <span data-testid="review-progress">
            {currentIndex + 1} / {total}
          </span>
          <Badge variant={CEFR_BADGE_VARIANT[card.cefr]} size="sm">
            {card.cefr}
          </Badge>
        </div>

        <Progress value={((currentIndex + 1) / total) * 100} className="mb-6" />

        {/* Card slides out left and new card enters from right on each advance */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={enter.transition}
          >
            <Card data-testid="review-card" className="rounded-2xl p-8">
              <p
                data-testid="card-word"
                className="text-foreground text-center text-3xl font-semibold tracking-tight"
              >
                {card.word}
              </p>

              {!revealed ? (
                <Button
                  data-testid="btn-reveal"
                  variant="secondary"
                  size="lg"
                  className="mt-8 w-full"
                  onClick={() => setRevealed(true)}
                >
                  Reveal
                </Button>
              ) : (
                <motion.div
                  className="mt-6"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={enter.transition}
                >
                  <p
                    data-testid="card-definition"
                    className="text-foreground text-center text-base leading-7"
                  >
                    {card.definition}
                  </p>

                  {card.examples.length > 0 && (
                    <ul className="mt-4 space-y-1.5">
                      {card.examples.map((ex, i) => (
                        <li key={i} className="text-muted text-center text-sm italic">
                          &ldquo;{ex}&rdquo;
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-8 grid grid-cols-4 gap-2">
                    <Button
                      data-testid="btn-rate-again"
                      variant="secondary"
                      size="sm"
                      className="text-danger"
                      onClick={() => void handleRate("again")}
                    >
                      Again
                    </Button>
                    <Button
                      data-testid="btn-rate-hard"
                      variant="secondary"
                      size="sm"
                      className="text-warning"
                      onClick={() => void handleRate("hard")}
                    >
                      Hard
                    </Button>
                    <Button
                      data-testid="btn-rate-good"
                      variant="primary"
                      size="sm"
                      onClick={() => void handleRate("good")}
                    >
                      Good
                    </Button>
                    <Button
                      data-testid="btn-rate-easy"
                      variant="secondary"
                      size="sm"
                      className="text-success"
                      onClick={() => void handleRate("easy")}
                    >
                      Easy
                    </Button>
                  </div>
                </motion.div>
              )}
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
