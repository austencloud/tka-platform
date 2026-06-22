// Glyph census over static/data/mandala-index.json.
// Usage: node scripts/mandala-census.cjs
const { readFileSync } = require("fs");
const { resolve } = require("path");

const idx = JSON.parse(
  readFileSync(resolve(__dirname, "../static/data/mandala-index.json"), "utf8"),
);

const shapes = Object.entries(idx.byShape); // [shapeKey, refs[]]
const totalSeqs = shapes.reduce((n, [, refs]) => n + refs.length, 0);
const glyphCount = shapes.length;
const orbitCount = Object.keys(idx.byOrbit).length;

// Class-size histogram: how many glyphs have a class of size k.
const hist = new Map();
for (const [, refs] of shapes) hist.set(refs.length, (hist.get(refs.length) ?? 0) + 1);

// Deck census: sequences + distinct glyphs touched per deck.
const perDeck = new Map();
for (const [sk, refs] of shapes) {
  for (const r of refs) {
    const d = perDeck.get(r.deck) ?? { seqs: 0, glyphs: new Set() };
    d.seqs++;
    d.glyphs.add(sk);
    perDeck.set(r.deck, d);
  }
}

// Color make-up across the catalog.
let blueOnly = 0, redOnly = 0, combo = 0;
for (const [, refs] of shapes) {
  for (const r of refs) {
    if (r.colorSig.blueOnly) blueOnly++;
    else if (r.colorSig.redOnly) redOnly++;
    else combo++;
  }
}

// Orbits with >1 distinct glyph = rotation/mirror families (twins exist).
let orbitsWithTwins = 0, biggestOrbit = 0;
for (const ks of Object.values(idx.byOrbit)) {
  if (ks.length > 1) orbitsWithTwins++;
  if (ks.length > biggestOrbit) biggestOrbit = ks.length;
}

const pct = (a, b) => (b === 0 ? "0" : ((100 * a) / b).toFixed(1));

console.log("=".repeat(56));
console.log("MANDALA GLYPH CENSUS");
console.log("=".repeat(56));
console.log(`Sequences indexed     ${totalSeqs}`);
console.log(`Distinct glyphs       ${glyphCount}  (${pct(glyphCount, totalSeqs)}% of sequences)`);
console.log(`Collapse ratio        ${(totalSeqs / glyphCount).toFixed(1)}x  (avg pathways per glyph)`);
console.log(`Rotation/mirror orbits ${orbitCount}  (${orbitsWithTwins} contain >1 glyph; biggest folds ${biggestOrbit} glyphs)`);
console.log("");
console.log("Color make-up of pathways:");
console.log(`  blue-only ${blueOnly} (${pct(blueOnly, totalSeqs)}%) · red-only ${redOnly} (${pct(redOnly, totalSeqs)}%) · combo ${combo} (${pct(combo, totalSeqs)}%)`);
console.log("");

console.log("Class-size histogram (pathways → #glyphs with that many):");
const sizes = [...hist.keys()].sort((a, b) => a - b);
for (const s of sizes) console.log(`  ${String(s).padStart(5)} pathways  ×  ${hist.get(s)} glyphs`);
console.log("");

console.log("Top 15 most-collided glyphs (widest equivalence classes):");
const top = shapes
  .map(([sk, refs]) => ({ sk, n: refs.length, word: refs[0]?.word ?? "?", decks: new Set(refs.map((r) => r.deck)).size }))
  .sort((a, b) => b.n - a.n)
  .slice(0, 15);
for (const t of top) console.log(`  ${String(t.n).padStart(5)} pathways  "${t.word}"  across ${t.decks} deck(s)`);
console.log("");

console.log("Per-deck (sequences → distinct glyphs):");
const decks = [...perDeck.entries()].sort((a, b) => b[1].seqs - a[1].seqs);
for (const [id, d] of decks) {
  console.log(`  ${String(d.seqs).padStart(6)} → ${String(d.glyphs.size).padStart(5)} glyphs   ${id}`);
}
