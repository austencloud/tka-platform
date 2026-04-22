// scripts/build-primitive-catalog.cjs
// Stage A primitive catalog builder.
//
// Usage: node scripts/build-primitive-catalog.cjs
//
// Output: src/lib/features/sticker-lab/data/primitive-catalog.json
//
// Each SEED_ENTRY maps to one PrimitiveCatalogEntry with paths:null.
// Paths are loaded at runtime via the sequence repository fallback in
// mandala-paths-cache.svelte.ts.
//
// Stage B NOTE: This script will be replaced by scripts/enumerate-mandala-registry.cjs
// which runs MandalaCanonicalizer and writes shapeHash values from geometry.

'use strict';

const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.resolve(
  __dirname,
  '../src/lib/features/sticker-lab/data/primitive-catalog.json'
);

const outputDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Stage A seed entries — manually curated LOOPs representing visually distinct shapes.
// shapeHash = sequenceId (Stage A proxy; Stage B replaces with geometric SHA-256).
// Populate from deck enumeration: pick diverse shapes covering sparse ↔ dense,
// symmetric ↔ asymmetric, varying beat counts.
const SEED_ENTRIES = [
  // { word, loopType, sequenceId } — fill from deck enumeration before deploying.
  // Example:
  // { word: "ALPHA", loopType: "rotated-loop", sequenceId: "abc123..." },
];

if (SEED_ENTRIES.length < 20) {
  console.warn(
    `[build-primitive-catalog] WARNING: Only ${SEED_ENTRIES.length} seed entries. ` +
    `Stage A requires at least 20 entries. ` +
    `Populate SEED_ENTRIES from deck enumeration before deploying.`
  );
}

const entries = SEED_ENTRIES.map((seed) => ({
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

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(catalog, null, 2));
console.log(`[build-primitive-catalog] Wrote ${entries.length} entries to ${OUTPUT_PATH}`);
