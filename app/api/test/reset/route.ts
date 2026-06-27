import { loadSeedIfEmpty } from "@/lib/content/seed";
import { getDrizzleClient } from "@/lib/db/drizzle/client";
import {
  cards,
  content,
  errorEvents,
  gamification,
  lexiconCache,
  profiles,
  weakness,
} from "@/lib/db/drizzle/schema";
import { getServerContentRepository } from "@/lib/db/server";

/**
 * POST /api/test/reset
 *
 * Resets SQLite to a known clean-but-seeded baseline so each e2e test starts
 * from the same state. We delete all per-user data (profile, cards, error
 * events, gamification, weakness) plus all content and the global lexicon
 * cache, then re-seed the canonical starter set (passages, prompts, cards)
 * synchronously on the server.
 *
 * Why re-seed here instead of letting the client do it: SeedBootstrap re-seeds
 * whenever the deck is short of {@link SEED_CARD_COUNT}. If the reset left an
 * empty deck, the next page load would fire ~20 sequential `addCard` server
 * actions, and that write-storm starves the App Router's `router.push`
 * navigation — producing 60s `waitForURL` timeouts. Restoring a full deck
 * server-side makes SeedBootstrap a no-op (3 reads, no writes) so navigation
 * commits cleanly. Re-seeding from scratch each time also prevents duplicate
 * seed rows from accumulating across runs in the shared test DB.
 *
 * No profile is created — onboarding specs rely on starting profile-less.
 *
 * Gated to non-production environments — returns 404 in production.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // requireUser() (inside getServerContentRepository) authenticates the caller
  // and scopes re-seeded cards to that user.
  const repo = await getServerContentRepository();
  const db = getDrizzleClient();

  db.delete(profiles).run();
  db.delete(cards).run();
  db.delete(errorEvents).run();
  db.delete(gamification).run();
  db.delete(weakness).run();
  db.delete(lexiconCache).run();
  db.delete(content).run();

  // Restore the canonical seed (passages, prompts, cards). Synchronous under
  // better-sqlite3, so the next page load's SeedBootstrap finds a full deck.
  await loadSeedIfEmpty(repo);

  return Response.json({ ok: true });
}
