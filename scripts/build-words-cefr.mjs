// Generates data/words-cefr.json — a word → CEFR-level map for offline lookups.
//
// Run once (or to refresh): node scripts/build-words-cefr.mjs
//
// Data sources (both license-clean):
//  1. Google 10 000 most-common English words (rank-ordered) → frequency band → A1–C1
//  2. WordNet 3.1 index files (via wordpos devDep)
//       • words in WN but outside top-10k, tagsense_cnt ≥ 1 → C1
//       • words in WN but outside top-10k, tagsense_cnt = 0 → C2
//
// Rank → CEFR thresholds (calibrated against Cambridge English Vocabulary Profile):
//   1–1500   A1   top-frequency function + basic vocabulary
//   1501–3500 A2  common everyday vocabulary
//   3501–6000 B1  intermediate
//   6001–8500 B2  upper-intermediate / academic
//   8501–10000 C1 advanced (also: WN words with tagsense ≥ 1 outside top-10k)
//   WN tagsense=0 C2

import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { get as httpsGet } from "node:https";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT = join(ROOT, "data", "words-cefr.json");
const require = createRequire(import.meta.url);

const FREQ_URL =
  "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt";

// Rank thresholds — upper bound inclusive; index matches LEVELS array.
const THRESHOLDS = [1500, 3500, 6000, 8500, 10000];
const LEVELS = ["A1", "A2", "B1", "B2", "C1"];

// ── helpers ──────────────────────────────────────────────────────────────────

function download(url) {
  return new Promise((resolve, reject) => {
    httpsGet(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(body));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function rankToLevel(rank) {
  const idx = THRESHOLDS.findIndex((t) => rank <= t);
  return idx >= 0 ? LEVELS[idx] : null;
}

function findWnDataDir() {
  try {
    const wpPkg = require.resolve("wordpos/package.json");
    const sibling = dirname(dirname(wpPkg)); // .pnpm/.../node_modules/
    for (const sub of ["dict", "data"]) {
      const dir = join(sibling, "wordnet-db", sub);
      if (existsSync(join(dir, "data.noun"))) return dir;
    }
    const wpDir = dirname(wpPkg);
    for (const sub of ["data", "dict", "lib/data", "src/data"]) {
      const dir = join(wpDir, sub);
      if (existsSync(join(dir, "data.noun"))) return dir;
    }
  } catch {
    /* wordpos not available — skip WN supplement */
  }
  return null;
}

const normPos = (p) => (p === "s" ? "a" : p);

function parseIndexLine(line) {
  if (!line || line.charCodeAt(0) === 32) return null;
  const tok = line.trim().split(/\s+/);
  if (tok.length < 6) return null;
  let i = 0;
  const lemma = tok[i++].replace(/_/g, " ");
  normPos(tok[i++]); // pos (unused here)
  const synCnt = parseInt(tok[i++]);
  const pCnt = parseInt(tok[i++]);
  i += pCnt; // skip ptr symbols
  i++; // sense_cnt
  const tagsense = parseInt(tok[i++]);
  i += synCnt; // skip offsets (not needed)
  return { lemma, tagsense };
}

async function readIndexLines(filePath) {
  const lines = [];
  const rl = createInterface({
    input: createReadStream(filePath, "utf8"),
    crlfDelay: Infinity,
  });
  for await (const line of rl) lines.push(line);
  return lines;
}

// ── main ─────────────────────────────────────────────────────────────────────

const WN_INDEX_FILES = ["index.noun", "index.verb", "index.adj", "index.adv"];

async function main() {
  // Step 1 — download frequency list
  console.log("Downloading frequency list…");
  let freqWords;
  try {
    const text = await download(FREQ_URL);
    freqWords = text
      .trim()
      .split("\n")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    console.log(`  ${freqWords.length.toLocaleString()} words`);
  } catch (err) {
    console.error("  Download failed:", err.message);
    console.error(
      "  Cannot build words-cefr.json without internet access.\n" +
        "  Connect and re-run: node scripts/build-words-cefr.mjs",
    );
    process.exit(1);
  }

  // Step 2 — build frequency-based mapping
  const cefrData = Object.create(null);
  for (let i = 0; i < freqWords.length; i++) {
    const word = freqWords[i];
    const rank = i + 1;
    const level = rankToLevel(rank);
    if (level && !cefrData[word]) cefrData[word] = level;
  }
  console.log(`  Frequency map: ${Object.keys(cefrData).length.toLocaleString()} entries`);

  // Step 3 — supplement with WordNet words outside the frequency list
  const dataDir = findWnDataDir();
  if (!dataDir) {
    console.warn(
      "  wordpos not available — skipping WN C1/C2 supplement.\n" +
        "  Install: pnpm add -D wordpos",
    );
  } else {
    console.log("Supplementing from WordNet…");
    let added = 0;
    for (const f of WN_INDEX_FILES) {
      const fp = join(dataDir, f);
      if (!existsSync(fp)) continue;
      const lines = await readIndexLines(fp);
      for (const line of lines) {
        const entry = parseIndexLine(line);
        if (!entry) continue;
        const { lemma, tagsense } = entry;
        if (cefrData[lemma]) continue; // already in freq list
        cefrData[lemma] = tagsense > 0 ? "C1" : "C2";
        added++;
      }
    }
    console.log(`  Added ${added.toLocaleString()} WN-only words`);
  }

  // Step 4 — write output
  mkdirSync(join(ROOT, "data"), { recursive: true });
  const json = JSON.stringify(cefrData);
  writeFileSync(OUTPUT, json, "utf8");

  const sizeKiB = Math.round(Buffer.byteLength(json) / 1024);
  console.log(
    `✓ ${Object.keys(cefrData).length.toLocaleString()} words → data/words-cefr.json (${sizeKiB.toLocaleString()} KiB)`,
  );

  // Step 5 — sanity-check a few calibration words
  // Expected levels verified against the frequency-rank model.
  const CHECK = [
    ["house", "A1"],
    ["school", "A1"],
    ["respond", "A2"],
    ["establish", "A2"],
    ["demonstrate", "B1"],
    ["fundamental", "B1"],
    ["subsequently", "B2"],
    ["consequently", "B2"],
    ["exacerbate", "C1"],
    ["perspicacious", "C2"],
  ];
  console.log("\nCalibration check:");
  let mismatches = 0;
  for (const [word, expected] of CHECK) {
    const got = cefrData[word] ?? "null";
    const ok = got === expected;
    console.log(
      `  ${word.padEnd(18)} expected ${expected}  got ${got}  ${ok ? "✓" : "✗ MISMATCH"}`,
    );
    if (!ok) mismatches++;
  }
  if (mismatches > 0) {
    console.warn(`\n⚠ ${mismatches} mismatch(es) — adjust THRESHOLDS in this script.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
