#!/usr/bin/env tsx
/**
 * Generate `src/lib/shared/seo/notation-letter-facts.json` from the canonical
 * `DiamondPictographDataframe.csv`. Captures the representative (variation 0)
 * motion facts per letter so the per-letter SEO pages carry unique, factual copy
 * grounded in the canonical dataframe. Re-run when the dataframe changes.
 *
 *   tsx scripts/gen-notation-letter-facts.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_LETTERS } from "../src/lib/shared/seo/notation-letters";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSV_PATH = path.join(ROOT, "static", "data", "pictographs", "DiamondPictographDataframe.csv");
const OUT = path.join(ROOT, "src", "lib", "shared", "seo", "notation-letter-facts.json");

const csv = fs.readFileSync(CSV_PATH, "utf-8");
const lines = csv.split("\n").filter((l) => l.trim().length > 0);
const headers = lines[0].split(",");
const idx = (n: string) => headers.indexOf(n);
const rows = lines.slice(1).map((l) => l.split(","));

const facts: Record<string, unknown> = {};
for (const letter of CANONICAL_LETTERS) {
  const row = rows.find((r) => r[0] === letter);
  if (!row) {
    console.error(`MISSING dataframe row for ${letter}`);
    process.exit(1);
  }
  facts[letter] = {
    startPosition: row[idx("startPosition")],
    endPosition: row[idx("endPosition")],
    timing: row[idx("timing")],
    direction: row[idx("direction")],
    blue: { motionType: row[idx("blueMotionType")], start: row[idx("blueStartLocation")], end: row[idx("blueEndLocation")] },
    red: { motionType: row[idx("redMotionType")], start: row[idx("redStartLocation")], end: row[idx("redEndLocation")] },
  };
}

fs.writeFileSync(OUT, JSON.stringify(facts, null, 2) + "\n");
console.log(`Wrote ${Object.keys(facts).length} letters → ${path.relative(ROOT, OUT)}`);
