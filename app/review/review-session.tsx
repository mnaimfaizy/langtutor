"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { Achievement, Card } from "@/lib/db";
import { applyReview } from "@/lib/gamification";
import { getContentRepository } from "@/lib/registry";
import { scheduleCard } from "@/lib/srs";
import type { SrsRating } from "@/lib/srs";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";

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

const CEFR_COLOR: Record<string, string> = {
  A1: "text-success",
  A2: "text-success",
  B1: "text-warning",
  B2: "text-warning",
  C1: "text-danger",
  C2: "text-danger",
};

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

export function ReviewSession() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [counts, setCounts] = useState<RatingCounts>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [result, setResult] = useState<SessionResult | null>(null);
  const ratingInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    void getContentRepository()
      .getDueCards(new Date())
      .then((due) => {
        if (!active) return;
        if (due.length === 0) {
          setPhase("empty");
        } else {
          setCards(due);
          setPhase("reviewing");
        }
      })
      .catch(() => {
        if (active) setPhase("empty");
      });
    return () => {
      active = false;
    };
  }, []);

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
        const today = now.toISOString().slice(0, 10);
        const currentGamState = await repo.getGamification();
        const { newState, xpEarned, newAchievements, leveledUp } = applyReview(currentGamState, {
          cardCount: total,
          today,
          now,
        });
        await repo.saveGamification(newState);
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
        <p className="text-muted text-sm">Loading…</p>
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
          <h1 className="text-foreground text-2xl font-semibold">All caught up!</h1>
          <p className="text-muted mt-3 text-base leading-7">
            No cards are due right now. Check back later.
          </p>
          <Link href="/" className="mt-8 inline-block">
            <Button variant="secondary" size="lg">
              Back to home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "summary") {
    const total = counts.again + counts.hard + counts.good + counts.easy;
    return (
      <div
        data-testid="review-session"
        className="flex flex-1 flex-col items-center justify-center px-6 py-16"
      >
        <div data-testid="review-summary" className="w-full max-w-sm">
          <h1 className="text-foreground text-center text-3xl font-semibold">Session complete</h1>
          <p className="text-muted mt-2 text-center text-base">{total} cards reviewed</p>

          {result && (
            <div className="mt-4 text-center">
              <p data-testid="summary-xp" className="text-accent text-lg font-semibold">
                +{result.xpEarned} XP
              </p>
              {result.leveledUp && (
                <p className="text-success mt-1 text-sm font-medium">
                  Level up! Now level {result.newLevel}
                </p>
              )}
              {result.newAchievements.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.newAchievements.map((a) => (
                    <li
                      key={a.id}
                      data-testid="summary-new-achievement"
                      className="text-warning text-sm"
                    >
                      Achievement unlocked: {a.id.replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3">
            {(["again", "hard", "good", "easy"] as const).map((r) => (
              <div
                key={r}
                data-testid={`summary-count-${r}`}
                className="border-border rounded-xl border p-4 text-center"
              >
                <p className={cn("text-2xl font-bold", ratingColor(r))}>{counts[r]}</p>
                <p className="text-muted mt-1 text-sm capitalize">{r}</p>
              </div>
            ))}
          </div>

          <Link href="/" className="mt-8 block">
            <Button variant="primary" size="lg" className="w-full">
              Back to home
            </Button>
          </Link>
        </div>
      </div>
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
            <Link href="/">
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
        <div className="text-muted mb-3 flex items-center justify-between text-sm">
          <span>
            {currentIndex + 1} / {total}
          </span>
          <span
            className={cn(
              "text-xs font-semibold tracking-wider uppercase",
              CEFR_COLOR[card.cefr] ?? "text-muted",
            )}
          >
            {card.cefr}
          </span>
        </div>

        <div className="bg-foreground/10 mb-6 h-1 w-full rounded-full">
          <div
            className="bg-accent h-1 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>

        <div data-testid="review-card" className="border-border rounded-2xl border p-8">
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
            <div className="mt-6">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
