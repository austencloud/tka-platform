/**
 * Test 3: Cumulative vs per-beat reversal models.
 *
 * My previous test used the seeder's "per-beat from original" model where each
 * step's motion type is independently set. But PHYSICAL prop reversal is
 * cumulative — each reversal flips from the RUNNING direction, not from original.
 *
 * Let's test BOTH models and see which one matches physical reality.
 */

console.log("═══ Model Comparison: Per-Beat vs Cumulative ═══\n");
console.log("Per-beat: each step flips from ORIGINAL (what the seeder stores)");
console.log("Cumulative: each reversal flips from CURRENT running direction (physical reality)\n");

function testPattern(name, leftRevs, rightRevs, n) {
  // Pad/tile patterns
  const bPat = [];
  const rPat = [];
  for (let i = 0; i < n; i++) {
    bPat.push(leftRevs[i % leftRevs.length]);
    rPat.push(rightRevs[i % rightRevs.length]);
  }

  console.log(`── ${name} (${n} steps) ──`);
  console.log(`  Blue pattern: [${bPat.map(r => r ? 'R' : '·').join(' ')}]`);
  console.log(`  Red pattern:  [${rPat.map(r => r ? 'R' : '·').join(' ')}]`);
  console.log(`  Blue reversal count: ${bPat.filter(Boolean).length}`);
  console.log(`  Red reversal count:  ${rPat.filter(Boolean).length}`);

  // MODEL A: Per-beat from original
  // Each step is independently pro or anti based on whether it's reversed from original
  const perBeatLeft = bPat.map(r => r ? 'anti' : 'pro');
  const perBeatRight = rPat.map(r => r ? 'anti' : 'pro');
  const perBeatBoundary = perBeatLeft[n-1] === perBeatLeft[0] && perBeatRight[n-1] === perBeatRight[0];

  // MODEL B: Cumulative
  // Start CW/pro. Each reversal flips from current running state.
  let leftDir = 'CW';
  let rightDir = 'CW';
  const cumLeft = [];
  const cumRight = [];
  for (let i = 0; i < n; i++) {
    if (bPat[i]) leftDir = leftDir === 'CW' ? 'CCW' : 'CW';
    if (rPat[i]) rightDir = rightDir === 'CW' ? 'CCW' : 'CW';
    cumLeft.push(leftDir);
    cumRight.push(rightDir);
  }
  const cumBoundary = cumLeft[n-1] === 'CW' && cumRight[n-1] === 'CW'; // returns to start?

  console.log(`\n  Per-beat model (seeder):     blue=[${perBeatLeft.join(',')}]  red=[${perBeatRight.join(',')}]`);
  console.log(`    Boundary: last=${perBeatLeft[n-1]}/${perBeatRight[n-1]} vs first=${perBeatLeft[0]}/${perBeatRight[0]} → ${perBeatBoundary ? '✓ CLEAN' : '✗ MISMATCH'}`);

  console.log(`\n  Cumulative model (physical): blue=[${cumLeft.join(',')}]  red=[${cumRight.join(',')}]`);
  console.log(`    End state: blue=${cumLeft[n-1]} red=${cumRight[n-1]} → ${cumBoundary ? '✓ RETURNS TO START' : '✗ DOES NOT RETURN'}`);

  // Show step-by-step for cumulative
  console.log(`\n  Step-by-step (cumulative):`);
  console.log(`    Start: blue=CW, red=CW`);
  let bDir = 'CW', rDir = 'CW';
  for (let i = 0; i < n; i++) {
    const bFlip = bPat[i];
    const rFlip = rPat[i];
    if (bFlip) bDir = bDir === 'CW' ? 'CCW' : 'CW';
    if (rFlip) rDir = rDir === 'CW' ? 'CCW' : 'CW';
    const label = [];
    if (bFlip && rFlip) label.push('BOTH reverse');
    else if (bFlip) label.push('blue reverses');
    else if (rFlip) label.push('red reverses');
    else label.push('no reversal');
    console.log(`    Step ${i+1}: blue=${bDir}  red=${rDir}  (${label.join(', ')})`);
  }
  console.log(`    → Loop back to Step 1: blue needs CW, red needs CW`);
  console.log(`    → End: blue=${bDir}, red=${rDir}`);
  console.log(`    → ${bDir === 'CW' && rDir === 'CW' ? '✓ SEAMLESS' : '✗ DIRECTION MISMATCH AT BOUNDARY'}`);

  console.log();
  return { perBeatBoundary, cumBoundary };
}

const patterns = [
  { name: 'Continuous',  left: [false,false,false,false], right: [false,false,false,false] },
  { name: 'Book',        left: [true,true,true,true],     right: [true,true,true,true] },
  { name: 'Red Book',    left: [false,false,false,false], right: [true,true,true,true] },
  { name: 'Blue Book',   left: [true,true,true,true],     right: [false,false,false,false] },
  { name: 'Long Book',   left: [true,false,true,false],   right: [true,false,true,false] },
  { name: 'Alternating', left: [false,true,false,true],   right: [true,false,true,false] },
];

console.log("═══ 4-Step Patterns ═══\n");
for (const p of patterns) {
  testPattern(p.name, p.left, p.right, 4);
}

console.log("═══ 6-Step Patterns (Alternating & Long Book) ═══\n");
testPattern('Alternating (6)', [false,true,false,true], [true,false,true,false], 6);
testPattern('Long Book (6)',   [true,false,true,false], [true,false,true,false], 6);

console.log("═══ Exhaustive: Cumulative Model Parity Test (4-step) ═══\n");
let evenClean = 0, evenDirty = 0, oddClean = 0, oddDirty = 0;
for (let bMask = 0; bMask < 16; bMask++) {
  for (let rMask = 0; rMask < 16; rMask++) {
    let bDir = true, rDir = true; // true=CW
    let bCount = 0, rCount = 0;
    for (let i = 0; i < 4; i++) {
      if ((bMask >> i) & 1) { bDir = !bDir; bCount++; }
      if ((rMask >> i) & 1) { rDir = !rDir; rCount++; }
    }
    const clean = bDir && rDir; // both back to CW?
    const bothEven = bCount % 2 === 0 && rCount % 2 === 0;
    if (bothEven && clean) evenClean++;
    else if (bothEven && !clean) evenDirty++;
    else if (!bothEven && clean) oddClean++;
    else oddDirty++;
  }
}
console.log(`Even+Even → clean: ${evenClean}  dirty: ${evenDirty}`);
console.log(`Any odd   → clean: ${oddClean}  dirty: ${oddDirty}`);
console.log();

if (evenDirty === 0 && oddClean === 0) {
  console.log("═══ CUMULATIVE MODEL RESULT ═══");
  console.log("Under cumulative reversal (physical reality):");
  console.log("  Even reversal count per hand → ALWAYS returns to start direction.");
  console.log("  Odd reversal count per hand → NEVER returns to start direction.");
  console.log("  PARITY IS THE RULE. Your intuition was correct.");
}
