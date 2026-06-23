// Reads WordNet 3.1 database files bundled with the `wordpos` devDependency and
// writes a compact `data/wordnet.json` for offline lexicon queries.
//
// Run once (or after updating wordpos): node scripts/build-wordnet.mjs
//
// Output shape: { [lemma: string]: Array<{ p, d, e, s, up, dn }> }
//   p  – part of speech  (n|v|a|r)
//   d  – definition
//   e  – examples
//   s  – synonyms (other words in the same synset, excluding self)
//   up – hypernyms (direct broader terms)
//   dn – hyponyms (direct narrower terms)

import { createInterface } from "node:readline";
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT = join(ROOT, "data", "wordnet.json");
const require = createRequire(import.meta.url);

// ── data-directory discovery ─────────────────────────────────────────────────

function findDataDir() {
  const candidates = [];

  // Primary: resolve wordpos, then navigate to wordnet-db (pnpm puts sibling
  // deps next to each other in the virtual store).
  try {
    const wordposPkg = require.resolve("wordpos/package.json");
    const wordposDir = dirname(wordposPkg);

    // pnpm virtual store: .pnpm/wordpos@x/node_modules/{wordpos,wordnet-db,...}
    const siblingBase = dirname(wordposDir); // → node_modules/ that holds wordpos
    for (const sub of ["dict", "data"]) {
      const dir = join(siblingBase, "wordnet-db", sub);
      candidates.push(dir);
      if (existsSync(join(dir, "data.noun"))) return dir;
    }

    // Fallback: wordpos might bundle data itself (older versions)
    for (const sub of ["data", "dict", "lib/data", "src/data"]) {
      const dir = join(wordposDir, sub);
      candidates.push(dir);
      if (existsSync(join(dir, "data.noun"))) return dir;
    }
  } catch {
    // wordpos not installed — will throw below
  }

  // Last resort: search common pnpm virtual-store paths
  for (const nm of [join(ROOT, "node_modules")]) {
    for (const pkg of [
      ".pnpm/node_modules/wordnet-db/dict",
      ".pnpm/node_modules/wordnet-db/data",
    ]) {
      const dir = join(nm, pkg);
      candidates.push(dir);
      if (existsSync(join(dir, "data.noun"))) return dir;
    }
  }

  throw new Error(
    "Cannot find WordNet 3.1 data files.\n" +
      "Run:  pnpm add -D wordpos\n" +
      "Checked:\n" +
      candidates.map((d) => `  ${d}`).join("\n"),
  );
}

// ── WN raw-file parsers ──────────────────────────────────────────────────────

// Satellite adjectives share the same POS slot as adjectives.
const normPos = (p) => (p === "s" ? "a" : p);

function parseDataLine(line) {
  if (!line || line.charCodeAt(0) === 32) return null; // WN header lines start with space
  const pipeIdx = line.indexOf("|");
  const gloss = pipeIdx >= 0 ? line.slice(pipeIdx + 2).trim() : "";
  const head = (pipeIdx >= 0 ? line.slice(0, pipeIdx) : line).trimEnd();
  const tok = head.split(" ");
  let i = 0;

  const offset = parseInt(tok[i++]);
  if (isNaN(offset)) return null;
  i++; // lex_filenum
  const ssType = tok[i++];
  const wCnt = parseInt(tok[i++], 16);

  const words = [];
  for (let w = 0; w < wCnt; w++) {
    words.push(tok[i++].replace(/_/g, " ").toLowerCase());
    i++; // lex_id (hex)
  }

  const pCnt = parseInt(tok[i++]);
  const ptrs = [];
  for (let p = 0; p < pCnt; p++) {
    const sym = tok[i++];
    const tgtOffset = parseInt(tok[i++]);
    const tgtPos = normPos(tok[i++]);
    i++; // source/target word indices
    ptrs.push({ sym, tgtOffset, tgtPos });
  }

  // Gloss format: "definition text; "example one"; "example two""
  const semiQuoteIdx = gloss.search(/;\s*"/);
  const definition = (semiQuoteIdx >= 0 ? gloss.slice(0, semiQuoteIdx) : gloss).trim();
  const examples = [...gloss.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  return {
    offset,
    pos: normPos(ssType),
    words,
    ptrs,
    definition,
    examples,
  };
}

function parseIndexLine(line) {
  if (!line || line.charCodeAt(0) === 32) return null;
  const tok = line.trim().split(/\s+/);
  if (tok.length < 6) return null;
  let i = 0;

  const lemma = tok[i++].replace(/_/g, " ");
  const pos = normPos(tok[i++]);
  const synCnt = parseInt(tok[i++]);
  const pCnt = parseInt(tok[i++]);
  i += pCnt; // skip pointer symbols listed in the index
  i++; // sense_cnt
  i++; // tagsense_cnt

  const offsets = [];
  for (let o = 0; o < synCnt; o++) offsets.push(parseInt(tok[i++]));
  return { lemma, pos, offsets };
}

async function readLines(filePath) {
  const lines = [];
  const rl = createInterface({
    input: createReadStream(filePath, "utf8"),
    crlfDelay: Infinity,
  });
  for await (const line of rl) lines.push(line);
  return lines;
}

// ── pointer-symbol sets ──────────────────────────────────────────────────────

// '@' = hypernym, '@i' = instance hypernym
const HYPER = new Set(["@", "@i"]);
// '~' = hyponym, '~i' = instance hyponym
const HYPO = new Set(["~", "~i"]);

// ── POS → filename mapping ───────────────────────────────────────────────────

const FILES = {
  n: { data: "data.noun", index: "index.noun" },
  v: { data: "data.verb", index: "index.verb" },
  a: { data: "data.adj", index: "index.adj" },
  r: { data: "data.adv", index: "index.adv" },
};

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dataDir = findDataDir();
  console.log("WordNet data:", dataDir);

  // Pass 1 — load all synsets into memory for pointer resolution
  console.log("Loading synsets…");
  const synsets = new Map(Object.keys(FILES).map((p) => [p, new Map()]));

  for (const [pos, f] of Object.entries(FILES)) {
    const fp = join(dataDir, f.data);
    if (!existsSync(fp)) {
      console.warn("  missing:", fp);
      continue;
    }
    const lines = await readLines(fp);
    let n = 0;
    for (const line of lines) {
      const s = parseDataLine(line);
      if (s) {
        synsets.get(s.pos)?.set(s.offset, s);
        n++;
      }
    }
    console.log(`  ${pos}: ${n.toLocaleString()} synsets`);
  }

  // Pass 2 — walk index files, resolve direct hypernym/hyponym pointers
  console.log("Building word index…");
  const wordnet = Object.create(null);

  for (const [pos, f] of Object.entries(FILES)) {
    const fp = join(dataDir, f.index);
    if (!existsSync(fp)) {
      console.warn("  missing:", fp);
      continue;
    }
    const lines = await readLines(fp);
    let n = 0;
    for (const line of lines) {
      const entry = parseIndexLine(line);
      if (!entry) continue;

      const { lemma, offsets } = entry;
      for (const offset of offsets) {
        const syn = synsets.get(pos)?.get(offset);
        if (!syn) continue;

        const hypernyms = [
          ...new Set(
            syn.ptrs
              .filter((p) => HYPER.has(p.sym))
              .flatMap((p) => synsets.get(p.tgtPos)?.get(p.tgtOffset)?.words ?? []),
          ),
        ];
        const hyponyms = [
          ...new Set(
            syn.ptrs
              .filter((p) => HYPO.has(p.sym))
              .flatMap((p) => synsets.get(p.tgtPos)?.get(p.tgtOffset)?.words ?? []),
          ),
        ];
        const synonyms = syn.words.filter((w) => w !== lemma);

        if (!wordnet[lemma]) wordnet[lemma] = [];
        wordnet[lemma].push({
          p: pos,
          d: syn.definition,
          e: syn.examples,
          s: synonyms,
          up: hypernyms,
          dn: hyponyms,
        });
      }
      n++;
    }
    console.log(`  ${pos}: ${n.toLocaleString()} lemmas`);
  }

  mkdirSync(join(ROOT, "data"), { recursive: true });
  console.log("Serialising…");
  const json = JSON.stringify(wordnet);
  writeFileSync(OUTPUT, json, "utf8");

  const sizeKiB = Math.round(Buffer.byteLength(json) / 1024);
  const wordCount = Object.keys(wordnet).length;
  console.log(
    `✓ ${wordCount.toLocaleString()} lemmas → data/wordnet.json (${sizeKiB.toLocaleString()} KiB uncompressed)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
