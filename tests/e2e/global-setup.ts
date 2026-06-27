import fs from "node:fs";
import path from "node:path";

/**
 * Runs before the Playwright webServer starts.
 * Deletes the e2e SQLite DB so each run begins with a clean slate — prevents
 * profile/card/content data saved in one run from leaking into the next.
 */
export default function globalSetup() {
  const base = path.resolve(process.cwd(), "langtutor-e2e.db");
  for (const suffix of ["", "-shm", "-wal"]) {
    try {
      fs.rmSync(base + suffix);
    } catch {
      // File absent or locked (dev server running — it uses langtutor.db, not this).
    }
  }
}
