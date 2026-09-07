/**
 * FINAL: Enumerate all Level 1 Quartered Rotated LOOP sequences
 * Diamond grid, Continuous rotation, 3 starts (alpha1, beta5, gamma11)
 *
 * Output: complete deck grouped by hand path type, with variant counts
 */

const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'static', 'data', 'pictographs', 'DiamondPictographDataframe.csv');
const raw = fs.readFileSync(csvPath, 'utf-8');
const lines = raw.split('\n').filter(l => l.trim() && l.indexOf('letter,') !== 0);

const edges = [];
for (const line of lines) {
  const p = line.split(',');
  if (p.length < 13) continue;
  edges.push({
    letter: p[0], startPos: p[1], endPos: p[2],
    timing: p[3], direction: p[4],
    leftMotionType: p[5], leftRotDir: p[6],
    leftStartLoc: p[7], leftEndLoc: p[8],
    rightMotionType: p[9], rightRotDir: p[10],
    rightStartLoc: p[11], rightEndLoc: p[12].trim(),
  });
}

const adj = {};
for (const e of edges) {
  if (!adj[e.startPos]) adj[e.startPos] = [];
  adj[e.startPos].push(e);
}

const rotatePos90 = {
  alpha1: 'alpha3', alpha3: 'alpha5', alpha5: 'alpha7', alpha7: 'alpha1',
  beta1: 'beta3', beta3: 'beta5', beta5: 'beta7', beta7: 'beta1',
  gamma1: 'gamma3', gamma3: 'gamma5', gamma5: 'gamma7', gamma7: 'gamma9',
  gamma9: 'gamma11', gamma11: 'gamma13', gamma13: 'gamma15', gamma15: 'gamma1',
};

function rotOk(prev, next) {
  if (prev === 'noRotation' || next === 'noRotation') return true;
  return prev === next;
}

// Letter types
const TYPES = {
  'A': 1, 'B': 1, 'C': 1, 'D': 1, 'E': 1, 'F': 1,
  'G': 1, 'H': 1, 'I': 1, 'J': 1, 'K': 1, 'L': 1,
  'M': 1, 'N': 1, 'O': 1, 'P': 1, 'Q': 1, 'R': 1,
  'S': 1, 'T': 1, 'U': 1, 'V': 1,
  'W': 2, 'X': 2, 'Y': 2, 'Z': 2, 'Σ': 2, 'Δ': 2, 'Θ': 2, 'Ω': 2,
  'W-': 3, 'X-': 3, 'Y-': 3, 'Z-': 3, 'Σ-': 3, 'Δ-': 3, 'Θ-': 3, 'Ω-': 3,
  'Φ': 4, 'Ψ': 4, 'Λ': 4,
  'Φ-': 5, 'Ψ-': 5, 'Λ-': 5,
  'α': 6, 'β': 6, 'γ': 6,
};

const TYPE_NAMES = {
  1: 'Dual-Shift', 2: 'Shift', 3: 'Cross-Shift',
  4: 'Dash', 5: 'Dual-Dash', 6: 'Static'
};

// VTG classification for Type 1 letters
function getVTG(timing, direction) {
  if (timing === 'split' && direction === 'same') return 'Split-Same';
  if (timing === 'tog' && direction === 'same') return 'Tog-Same';
  if (timing === 'split' && direction === 'opp') return 'Split-Opp';
  if (timing === 'tog' && direction === 'opp') return 'Tog-Opp';
  if (timing === 'quarter' && direction === 'same') return 'Quarter-Same';
  if (timing === 'quarter' && direction === 'opp') return 'Quarter-Opp';
  return `${timing}-${direction}`;
}

function enumerateLoops(startPos) {
  const results = [];
  const seenPairs = {};  // letter pair -> count of variants

  const n1 = adj[startPos] || [];
  for (const b1 of n1) {
    const n2 = adj[b1.endPos] || [];
    for (const b2 of n2) {
      // Continuity: b1 -> b2
      if (!rotOk(b1.leftRotDir, b2.leftRotDir) || !rotOk(b1.rightRotDir, b2.rightRotDir)) continue;
      // LOOP: end of seed = rotate90(start)
      if (b2.endPos !== rotatePos90[startPos]) continue;
      // Quarter boundary continuity: b2 -> b1(rotated) and wrap-around
      if (!rotOk(b2.leftRotDir, b1.leftRotDir) || !rotOk(b2.rightRotDir, b1.rightRotDir)) continue;

      const pairKey = `${b1.letter}|${b2.letter}`;
      const variantKey = `${pairKey}|${b1.leftMotionType}/${b1.rightMotionType}|${b2.leftMotionType}/${b2.rightMotionType}`;

      if (!seenPairs[variantKey]) {
        seenPairs[variantKey] = true;

        const t1 = TYPES[b1.letter] || 0;
        const t2 = TYPES[b2.letter] || 0;

        let vtg1 = '';
        if (t1 === 1) vtg1 = getVTG(b1.timing, b1.direction);

        let vtg2 = '';
        if (t2 === 1) vtg2 = getVTG(b2.timing, b2.direction);

        // Describe beat 1 motion
        let b1desc = `${b1.leftMotionType}/${b1.rightMotionType}`;
        if (vtg1) b1desc = `${vtg1} ${b1desc}`;

        // Describe beat 2 motion
        let b2desc = `${b2.leftMotionType}/${b2.rightMotionType}`;
        if (vtg2) b2desc = `${vtg2} ${b2desc}`;

        results.push({
          seed: `${b1.letter}${b2.letter}`,
          word: `${b1.letter}${b2.letter}`.repeat(4),
          l1: b1.letter, l2: b2.letter,
          t1, t2,
          handPath: `${TYPE_NAMES[t1]}+${TYPE_NAMES[t2]}`,
          b1desc, b2desc,
          path: `${startPos}→${b1.endPos}→${b2.endPos}`,
        });
      }
    }
  }

  return results;
}

// Run
const starts = ['alpha1', 'beta5', 'gamma11'];
const posLabels = { alpha1: 'α1', beta5: 'β5', gamma11: 'γ11' };

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║   LEVEL 1 · QUARTERED ROTATED LOOP · COMPLETE DECK          ║');
console.log('║   Diamond Grid · Continuous · 8 Beats                        ║');
console.log('║   Start positions: alpha1, beta5, gamma11                    ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');

// Collect all results grouped by hand path type
const globalGroups = {};
let grandTotal = 0;

for (const start of starts) {
  const results = enumerateLoops(start);
  grandTotal += results.length;

  for (const r of results) {
    if (!globalGroups[r.handPath]) globalGroups[r.handPath] = [];
    globalGroups[r.handPath].push({ ...r, start, label: posLabels[start] });
  }
}

// Sort groups by type combination
const sortedGroups = Object.entries(globalGroups).sort((a, b) => {
  const [, itemsA] = a;
  const [, itemsB] = b;
  return (itemsA[0].t1 * 10 + itemsA[0].t2) - (itemsB[0].t1 * 10 + itemsB[0].t2);
});

let deckNum = 1;

for (const [handPath, items] of sortedGroups) {
  const t1 = items[0].t1;
  const t2 = items[0].t2;

  console.log('');
  console.log(`  ╔═══ ${handPath} (Type ${t1} + Type ${t2}) ═══ ${items.length} sequences ═══╗`);

  // Sub-group by start position
  for (const start of starts) {
    const subset = items.filter(i => i.start === start);
    if (subset.length === 0) continue;

    console.log(`  ║`);
    console.log(`  ║  From ${posLabels[start]} (${start}):`);

    for (const item of subset) {
      const num = String(deckNum).padStart(3, ' ');
      console.log(`  ║  #${num}  ${item.seed.padEnd(6)} → ${item.word.padEnd(24)} [${item.b1desc}] + [${item.b2desc}]`);
      deckNum++;
    }
  }
  console.log(`  ╚${'═'.repeat(58)}`);
}

// Final summary
console.log('');
console.log('═'.repeat(62));
console.log(`  TOTAL: ${grandTotal} unique sequences in the Level 1 Deck`);
console.log('═'.repeat(62));

// Compact summary table
console.log('');
console.log('  ┌────────────────────────────┬─────┬─────┬─────┬───────┐');
console.log('  │ Hand Path                  │  α1 │  β5 │ γ11 │ Total │');
console.log('  ├────────────────────────────┼─────┼─────┼─────┼───────┤');

for (const [handPath, items] of sortedGroups) {
  const a1 = items.filter(i => i.start === 'alpha1').length;
  const b5 = items.filter(i => i.start === 'beta5').length;
  const g11 = items.filter(i => i.start === 'gamma11').length;
  const total = a1 + b5 + g11;
  console.log(`  │ ${handPath.padEnd(27)}│ ${String(a1).padStart(3)} │ ${String(b5).padStart(3)} │ ${String(g11).padStart(3)} │ ${String(total).padStart(5)} │`);
}

console.log('  ├────────────────────────────┼─────┼─────┼─────┼───────┤');
const a1Total = Object.values(globalGroups).flat().filter(i => i.start === 'alpha1').length;
const b5Total = Object.values(globalGroups).flat().filter(i => i.start === 'beta5').length;
const g11Total = Object.values(globalGroups).flat().filter(i => i.start === 'gamma11').length;
console.log(`  │ TOTAL                      │ ${String(a1Total).padStart(3)} │ ${String(b5Total).padStart(3)} │ ${String(g11Total).padStart(3)} │ ${String(grandTotal).padStart(5)} │`);
console.log('  └────────────────────────────┴─────┴─────┴─────┴───────┘');

// Unique letter pairs (collapsing all variants)
console.log('');
console.log('  ┌─ Unique letter pairs by start position:');
for (const start of starts) {
  const pairs = [...new Set(Object.values(globalGroups).flat().filter(i => i.start === start).map(i => i.seed))];
  console.log(`  │ ${posLabels[start]}: ${pairs.join(', ')}`);
}
console.log('  └─');

// Count truly unique letter pairs (ignoring start)
const allPairs = [...new Set(Object.values(globalGroups).flat().map(i => i.seed))];
console.log(`\n  ${allPairs.length} unique letter-pair seeds across all positions`);
console.log(`  ${grandTotal} total deck entries (including variant executions)`);
