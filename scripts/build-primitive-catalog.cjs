// Stage A primitive catalog builder — populates from public-sequences.json.
//
// Usage: node scripts/build-primitive-catalog.cjs
//
// Output: src/lib/features/sticker-lab/data/primitive-catalog.json
//
// Each entry maps to one PrimitiveCatalogEntry with paths:null.
// Paths are loaded at runtime via the sequence repository fallback in
// mandala-paths-cache.svelte.ts.
//
// Stage B NOTE: This script will be replaced by scripts/enumerate-mandala-registry.cjs
// which runs MandalaCanonicalizer and writes shapeHash values from geometry.

'use strict';

const fs = require('fs');
const path = require('path');

const INPUT_PATH = path.resolve(
  __dirname,
  '../static/data/snapshots/public-sequences.json'
);

const OUTPUT_PATH = path.resolve(
  __dirname,
  '../src/lib/features/sticker-lab/data/primitive-catalog.json'
);

// 1. Read public-sequences.json
if (!fs.existsSync(INPUT_PATH)) {
  console.error(`[build-primitive-catalog] ERROR: ${INPUT_PATH} not found.`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'));
const documents = raw.documents;

if (!Array.isArray(documents) || documents.length === 0) {
  console.error('[build-primitive-catalog] ERROR: No documents found in public-sequences.json.');
  process.exit(1);
}

console.log(`[build-primitive-catalog] Read ${documents.length} documents from public-sequences.json`);

// ---------------------------------------------------------------------------
// 2. Group documents by loopType
// ---------------------------------------------------------------------------
/** @type {Map<string, Array<{id: string, word: string, loopType: string, sequenceLength: number}>>} */
const byLoopType = new Map();

for (const doc of documents) {
  const loopType = doc.loopType || 'unknown';
  const word = doc.word;
  const id = doc.id;

  // Skip entries missing required fields
  if (!word || !id) continue;

  if (!byLoopType.has(loopType)) byLoopType.set(loopType, []);
  byLoopType.get(loopType).push({
    id,
    word,
    loopType,
    sequenceLength: doc.sequenceLength || 0,
  });
}

console.log(`[build-primitive-catalog] Found ${byLoopType.size} loop types: ${[...byLoopType.keys()].join(', ')}`);

// ---------------------------------------------------------------------------
// 3. For each loopType, pick up to 6 entries
//    - Favor short words (under 12 chars)
//    - Avoid duplicate words across all picks
// ---------------------------------------------------------------------------
const MAX_PER_TYPE = 6;

/** @type {Array<{word: string, loopType: string, sequenceId: string}>} */
const seedEntries = [];
const seenWords = new Set();

for (const [loopType, docs] of byLoopType) {
  // Sort: short words first, then alphabetically for determinism
  const sorted = docs
    .slice()
    .sort((a, b) => {
      // Prefer words under 12 chars
      const aShort = a.word.length < 12 ? 0 : 1;
      const bShort = b.word.length < 12 ? 0 : 1;
      if (aShort !== bShort) return aShort - bShort;
      // Then alphabetical
      return a.word.localeCompare(b.word);
    });

  let picked = 0;
  for (const doc of sorted) {
    if (picked >= MAX_PER_TYPE) break;

    // Skip duplicate words across all loop types
    const wordKey = doc.word.toUpperCase();
    if (seenWords.has(wordKey)) continue;

    seenWords.add(wordKey);
    seedEntries.push({
      word: doc.word,
      loopType: doc.loopType,
      sequenceId: doc.id,
    });
    picked++;
  }
}

// ---------------------------------------------------------------------------
// 4. Sort picks by word for readability
// ---------------------------------------------------------------------------
seedEntries.sort((a, b) => a.word.localeCompare(b.word));

console.log(`[build-primitive-catalog] Selected ${seedEntries.length} seed entries`);

// ---------------------------------------------------------------------------
// 5. Generate catalog JSON
// ---------------------------------------------------------------------------
const entries = seedEntries.map((seed) => ({
  shapeHash: seed.sequenceId,
  ultraHash: seed.sequenceId,
  displayName: seed.word,
  paths: null,
  sourceLoop: {
    sequenceId: seed.sequenceId,
    word: seed.word,
    loopType: seed.loopType,
  },
  symmetryOrder: 1,
  ultraCount: 1,
}));

const catalog = {
  version: 1,
  generatedAt: Date.now(),
  totalEntries: entries.length,
  entries,
};

const outputDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(catalog, null, 2));

// Print summary per loop type
const summary = {};
for (const seed of seedEntries) {
  summary[seed.loopType] = (summary[seed.loopType] || 0) + 1;
}
console.log(`[build-primitive-catalog] Entries per loop type:`);
for (const [lt, count] of Object.entries(summary).sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${lt}: ${count}`);
}
console.log(`[build-primitive-catalog] Wrote ${entries.length} entries to ${OUTPUT_PATH}`);
