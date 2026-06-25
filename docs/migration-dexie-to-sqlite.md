# Migrating from Dexie (IndexedDB) to SQLite

This guide describes the one-time manual migration for users upgrading from the old
browser-only build (Phase 0–8, data in IndexedDB/Dexie) to the new build (Phase 1a+,
data in server-side SQLite).

## What is migrated

The backup/restore mechanism is lossless for all learner state:

| Table         | Contents                                                                          |
| ------------- | --------------------------------------------------------------------------------- |
| Profile       | CEFR level, goals, TTS settings                                                   |
| Cards         | Vocabulary SRS cards with full FSRS state (due date, stability, difficulty, reps) |
| Content       | AI-generated/seed passages, quizzes, prompts                                      |
| Error events  | Diagnostic mistake events                                                         |
| Weakness      | Per-skill/category/CEFR weakness scores                                           |
| Gamification  | XP, level, streak count, last activity date, achievement list                     |
| Lexicon cache | Cached dictionary lookups                                                         |

## Steps

### Step 1 — Export from the old build (Dexie)

1. Open the app on the **old** build (browser, IndexedDB storage).
2. Navigate to **Settings → Backup**.
3. Click **Export backup** — a file named `lang-tutor-backup-YYYY-MM-DD.json` is downloaded.

### Step 2 — Import into the new build (SQLite)

1. Open the app on the **new** build (local server, SQLite storage).
2. Navigate to **Settings → Backup**.
3. Click **Import backup** and select the JSON file downloaded in Step 1.
4. Confirm the import. The app will clear any existing data and restore all tables.

## Verification

After import, confirm the following are intact:

- **Vocabulary cards** — your word list appears in the Study section with the same FSRS review
  schedule (due dates preserved).
- **XP and streak** — the dashboard shows the same XP total, level, and streak count.
- **Weakness scores** — the diagnostics heatmap reflects your previous error history.

## Technical notes

- The import step runs entirely server-side: the JSON file is parsed, validated against
  `BackupSchema` (Zod), and written to SQLite with the bootstrap admin user id
  (`BOOTSTRAP_ADMIN_ID`).
- All auto-increment IDs (cards, error events, content) are preserved from the original backup
  so the re-exported backup is byte-equivalent on all table fields.
- The `exportedAt` timestamp will differ between the original export and a subsequent re-export
  (it records the time of export, not the data epoch), but all table contents are identical.
