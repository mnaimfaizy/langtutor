import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import type { NewCard } from "@/lib/db";
import { initCard, scheduleCard } from "@/lib/srs";

let dbCounter = 0;
let db: LangTutorDB;

function makeReviewedCard(word: string, now: Date): NewCard {
  return {
    word,
    definition: `definition of ${word}`,
    examples: [`An example using ${word}.`],
    cefr: "A1",
    fsrs: scheduleCard(initCard(now), "easy", now),
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
  };
}

beforeEach(() => {
  db = new LangTutorDB(`lang-tutor-reset-progress-test-${dbCounter++}`);
});

afterEach(async () => {
  await db.delete();
});

describe("card reset progress (issue #99)", () => {
  it("reinitializes FSRS to a fresh new-card state via the SRS wrapper", async () => {
    const repo = new DexieContentRepository(db);
    const T0 = new Date("2025-06-15T12:00:00.000Z");
    const id = await repo.addCard(makeReviewedCard("forgotten", T0));
    const before = await repo.getCard(id);
    expect(before?.fsrs.state).not.toBe(0);

    await repo.resetCardProgress(id, T0);

    const after = await repo.getCard(id);
    expect(after?.fsrs).toEqual(initCard(T0));
    expect(after?.fsrs.state).toBe(0);
  });

  it("leaves word, definition, and examples unchanged", async () => {
    const repo = new DexieContentRepository(db);
    const T0 = new Date("2025-06-15T12:00:00.000Z");
    const id = await repo.addCard(makeReviewedCard("preserve-me", T0));
    const before = await repo.getCard(id);

    await repo.resetCardProgress(id, T0);

    const after = await repo.getCard(id);
    expect(after?.word).toBe(before?.word);
    expect(after?.definition).toBe(before?.definition);
    expect(after?.examples).toEqual(before?.examples);
  });
});
