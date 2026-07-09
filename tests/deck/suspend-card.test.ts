import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import type { NewCard } from "@/lib/db";

let dbCounter = 0;
let db: LangTutorDB;

function makeCard(word: string, due: Date): NewCard {
  return {
    word,
    definition: `definition of ${word}`,
    examples: [`An example using ${word}.`],
    cefr: "A1",
    fsrs: {
      due,
      stability: 2.5,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 1,
      reps: 1,
      lapses: 0,
      state: 2,
    },
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
  };
}

beforeEach(() => {
  db = new LangTutorDB(`lang-tutor-suspend-test-${dbCounter++}`);
});

afterEach(async () => {
  await db.delete();
});

describe("card suspend / unsuspend (issue #98)", () => {
  it("excludes a suspended card from getDueCards while preserving FSRS state", async () => {
    const repo = new DexieContentRepository(db);
    const due = new Date("2026-06-01T00:00:00.000Z");
    const cutoff = new Date("2026-06-22T00:00:00.000Z");
    const id = await repo.addCard(makeCard("leech", due));
    const before = await repo.getCard(id);

    await repo.suspendCard(id);

    expect(await repo.getDueCards(cutoff)).toHaveLength(0);
    const after = await repo.getCard(id);
    expect(after?.suspended).toBe(true);
    expect(after?.fsrs).toEqual(before?.fsrs);
  });

  it("restores a card to due rotation at its existing due date when unsuspended", async () => {
    const repo = new DexieContentRepository(db);
    const due = new Date("2026-06-01T00:00:00.000Z");
    const cutoff = new Date("2026-06-22T00:00:00.000Z");
    const id = await repo.addCard(makeCard("returning", due));
    const before = await repo.getCard(id);

    await repo.suspendCard(id);
    expect(await repo.getDueCards(cutoff)).toHaveLength(0);

    await repo.unsuspendCard(id);

    const dueCards = await repo.getDueCards(cutoff);
    expect(dueCards).toHaveLength(1);
    expect(dueCards[0]?.id).toBe(id);
    expect(dueCards[0]?.fsrs.due).toEqual(due);
    expect(dueCards[0]?.fsrs).toEqual(before?.fsrs);
    expect(dueCards[0]?.suspended).toBeFalsy();
  });
});
