/**
 * Enumerate all valid 8-letter Level 1 Quartered Rotated LOOP sequences
 * on Diamond grid from 3 starting positions: alpha1, beta5, gamma11
 * with Continuous rotation (no reversals)
 *
 * Quartered Rotated LOOP = 2-beat seed repeated via 90° rotations
 * Constraint: seed's end position must equal rotatePos90(start) so the
 * rotated copies chain seamlessly and loop back.
 */

const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'static', 'data', 'pictographs', 'DiamondPictographDataframe.csv');
const raw = fs.readFileSync(csvPath, 'utf-8');
const lines = raw.split('\n').filter(l => l.trim() && l.indexOf('letter,') !== 0);

const edges = [];
for (const line of lines) {
  const parts = line.split(',');
  if (parts.length < 13) continue;
  edges.push({
    letter: parts[0],
    startPos: parts[1],
    endPos: parts[2],
    timing: parts[3],
    direction: parts[4],
    blueMotionType: parts[5],
    blueRotDir: parts[6],
    blueStartLoc: parts[7],
    blueEndLoc: parts[8],
    redMotionType: parts[9],
    redRotDir: parts[10],
    redStartLoc: parts[11],
    redEndLoc: parts[12].trim(),
  });
}

// Build adjacency: position -> edges
const adj = {};
for (const e of edges) {
  if (!adj[e.startPos]) adj[e.startPos] = [];
  adj[e.startPos].push(e);
}

// 90° CW rotation of positions on diamond grid
const rotatePos90 = {
  alpha1: 'alpha3', alpha3: 'alpha5', alpha5: 'alpha7', alpha7: 'alpha1',
  beta1: 'beta3', beta3: 'beta5', beta5: 'beta7', beta7: 'beta1',
  gamma1: 'gamma3', gamma3: 'gamma5', gamma5: 'gamma7', gamma7: 'gamma9',
  gamma9: 'gamma11', gamma11: 'gamma13', gamma13: 'gamma15', gamma15: 'gamma1',
};

// Continuous rotation compatibility
function rotOk(prev, next) {
  if (prev === 'noRotation' || next === 'noRotation') return true;
  return prev === next;
}

// Letter type classification
const TYPE_1 = new Set('A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V'.split(','));
const TYPE_2 = new Set('W,X,Y,Z,Σ,Δ,Θ,Ω'.split(','));
const TYPE_3 = new Set('W-,X-,Y-,Z-,Σ-,Δ-,Θ-,Ω-'.split(','));
const TYPE_4 = new Set('Φ,Ψ,Λ'.split(','));
const TYPE_5 = new Set('Φ-,Ψ-,Λ-'.split(','));
const TYPE_6 = new Set('α,β,γ'.split(','));

function getType(letter) {
  if (TYPE_1.has(letter)) return 1;
  if (TYPE_2.has(letter)) return 2;
  if (TYPE_3.has(letter)) return 3;
  if (TYPE_4.has(letter)) return 4;
  if (TYPE_5.has(letter)) return 5;
  if (TYPE_6.has(letter)) return 6;
  return 0;
}

function getTypeName(type) {
  switch (type) {
    case 1: return 'Dual-Shift';
    case 2: return 'Shift';
    case 3: return 'Cross-Shift';
    case 4: return 'Dash';
    case 5: return 'Dual-Dash';
    case 6: return 'Static';
    default: return 'Unknown';
  }
}

// Hand path description for a letter
function getHandPath(edge) {
  const blue = edge.blueMotionType;
  const red = edge.redMotionType;
  const timing = edge.timing;
  const dir = edge.direction;
  return `${timing}-${dir} (${blue}/${red})`;
}

// Enumerate all valid Quartered Rotated LOOPs from a starting position
function enumerateLoops(startPos) {
  const results = [];
  const seen = new Set(); // deduplicate by letter pair + rotation dirs

  const neighbors1 = adj[startPos] || [];
  for (const beat1 of neighbors1) {
    const neighbors2 = adj[beat1.endPos] || [];
    for (const beat2 of neighbors2) {
      // Check continuity between beats 1 and 2
      if (!rotOk(beat1.blueRotDir, beat2.blueRotDir) ||
          !rotOk(beat1.redRotDir, beat2.redRotDir)) continue;

      // LOOP constraint: beat2 must end at rotatePos90(startPos)
      // so Q2 starts where Q1 ends, and ultimately loops back
      if (beat2.endPos !== rotatePos90[startPos]) continue;

      // Continuity across quarter boundaries:
      // Q1.beat2 -> Q2.beat1 (rotated beat1): same rotation dirs as beat1
      if (!rotOk(beat2.blueRotDir, beat1.blueRotDir) ||
          !rotOk(beat2.redRotDir, beat1.redRotDir)) continue;

      // Deduplicate by letter pair (same letters + same hand path = same word)
      const key = `${beat1.letter}|${beat2.letter}|${beat1.blueRotDir}|${beat1.redRotDir}|${beat2.blueRotDir}|${beat2.redRotDir}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Build the full 8-letter word: seed repeated 4 times
      const word = [
        beat1.letter, beat2.letter,
        beat1.letter, beat2.letter,
        beat1.letter, beat2.letter,
        beat1.letter, beat2.letter,
      ].join('');

      const type1 = getType(beat1.letter);
      const type2 = getType(beat2.letter);
      const handPath = `${getTypeName(type1)}+${getTypeName(type2)}`;

      results.push({
        word,
        seed: `${beat1.letter}${beat2.letter}`,
        beat1Letter: beat1.letter,
        beat2Letter: beat2.letter,
        type1,
        type2,
        handPath,
        beat1Detail: getHandPath(beat1),
        beat2Detail: getHandPath(beat2),
        beat1RotDirs: `blue:${beat1.blueRotDir} red:${beat1.redRotDir}`,
        beat2RotDirs: `blue:${beat2.blueRotDir} red:${beat2.redRotDir}`,
        startPos,
        midPos: beat1.endPos,
        endPos: beat2.endPos,
      });
    }
  }

  return results;
}

// Run enumeration for all 3 starting positions
const allResults = {};
const starts = ['alpha1', 'beta5', 'gamma11'];

for (const start of starts) {
  allResults[start] = enumerateLoops(start);
}

// Report
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║  LEVEL 1 QUARTERED ROTATED LOOP DECK                           ║');
console.log('║  Diamond Grid · Continuous Rotation · 8 Letters                 ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

let grandTotal = 0;

for (const start of starts) {
  const results = allResults[start];
  grandTotal += results.length;

  // Group by hand path
  const byHandPath = {};
  for (const r of results) {
    if (!byHandPath[r.handPath]) byHandPath[r.handPath] = [];
    byHandPath[r.handPath].push(r);
  }

  const posName = start.replace(/(\d+)/, ' $1');
  console.log(`\n${'═'.repeat(66)}`);
  console.log(`  START: ${posName.toUpperCase()} (${results.length} unique sequences)`);
  console.log(`${'═'.repeat(66)}`);

  // Sort hand path groups by type numbers
  const sortedPaths = Object.keys(byHandPath).sort((a, b) => {
    const items_a = byHandPath[a];
    const items_b = byHandPath[b];
    const typeKey_a = items_a[0].type1 * 10 + items_a[0].type2;
    const typeKey_b = items_b[0].type1 * 10 + items_b[0].type2;
    return typeKey_a - typeKey_b;
  });

  for (const hp of sortedPaths) {
    const items = byHandPath[hp];
    console.log(`\n  ┌─ ${hp} (${items.length} sequences)`);
    console.log(`  │  Type ${items[0].type1} + Type ${items[0].type2}`);
    console.log(`  │`);
    for (const item of items) {
      const seedDisplay = `[${item.beat1Letter}][${item.beat2Letter}]`;
      console.log(`  │  ${seedDisplay.padEnd(12)} → ${item.word.padEnd(20)} ${item.beat1Detail} | ${item.beat2Detail}`);
    }
    console.log(`  └─`);
  }
}

console.log(`\n${'═'.repeat(66)}`);
console.log(`  GRAND TOTAL: ${grandTotal} unique sequences across all 3 start positions`);
console.log(`${'═'.repeat(66)}`);

// Summary table
console.log('\n\n═══ SUMMARY BY HAND PATH TYPE ═══\n');

const globalByHandPath = {};
for (const start of starts) {
  for (const r of allResults[start]) {
    const key = r.handPath;
    if (!globalByHandPath[key]) globalByHandPath[key] = { alpha1: 0, beta5: 0, gamma11: 0, total: 0 };
    globalByHandPath[key][start]++;
    globalByHandPath[key].total++;
  }
}

console.log('Hand Path'.padEnd(30) + 'α1'.padStart(5) + 'β5'.padStart(5) + 'γ11'.padStart(5) + 'Total'.padStart(7));
console.log('─'.repeat(52));

let totalTotal = 0;
for (const [hp, counts] of Object.entries(globalByHandPath).sort((a, b) => b[1].total - a[1].total)) {
  console.log(
    hp.padEnd(30) +
    String(counts.alpha1).padStart(5) +
    String(counts.beta5).padStart(5) +
    String(counts.gamma11).padStart(5) +
    String(counts.total).padStart(7)
  );
  totalTotal += counts.total;
}
console.log('─'.repeat(52));
console.log('TOTAL'.padEnd(30) +
  String(allResults.alpha1.length).padStart(5) +
  String(allResults.beta5.length).padStart(5) +
  String(allResults.gamma11.length).padStart(5) +
  String(totalTotal).padStart(7)
);

// Also list all unique 2-letter seeds
console.log('\n\n═══ ALL UNIQUE SEEDS ═══\n');
const allSeeds = new Set();
for (const start of starts) {
  for (const r of allResults[start]) {
    allSeeds.add(`${r.seed} (from ${start})`);
  }
}
console.log(`${allSeeds.size} unique seed pairs:\n`);
for (const start of starts) {
  const seeds = allResults[start].map(r => r.seed);
  console.log(`${start}: ${seeds.join(', ')}`);
}
