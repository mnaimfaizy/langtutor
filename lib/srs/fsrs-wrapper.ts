import type { Card as TsFsrsCard, Grade } from "ts-fsrs";
import { Rating, State, createEmptyCard, fsrs, generatorParameters } from "ts-fsrs";

import type { FsrsState } from "@/lib/db";

import type { SrsRating } from "./types";

const scheduler = fsrs(generatorParameters({ enable_fuzz: false }));

const RATING_MAP: Record<SrsRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function toState(card: TsFsrsCard): FsrsState {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learningSteps: card.learning_steps,
    state: card.state as number,
    lastReview: card.last_review,
  };
}

function fromState(state: FsrsState): TsFsrsCard {
  return {
    due: state.due,
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    reps: state.reps,
    lapses: state.lapses,
    learning_steps: state.learningSteps ?? 0,
    state: state.state as State,
    last_review: state.lastReview,
  };
}

export function initCard(now = new Date()): FsrsState {
  return toState(createEmptyCard(now));
}

export function scheduleCard(state: FsrsState, rating: SrsRating, now = new Date()): FsrsState {
  const { card } = scheduler.next(fromState(state), now, RATING_MAP[rating]);
  return toState(card);
}

export function isDue(state: FsrsState, now = new Date()): boolean {
  return state.due <= now;
}

export function getDueCards<T extends { fsrs: FsrsState }>(cards: T[], now = new Date()): T[] {
  return cards.filter((c) => isDue(c.fsrs, now));
}
