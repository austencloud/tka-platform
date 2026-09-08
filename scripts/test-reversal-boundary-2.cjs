/**
 * Test 2: What ACTUALLY determines clean LOOP boundaries?
 *
 * Find the rule governing which reversal patterns produce clean boundaries.
 */

function makeSequence(stepCount) {
  const steps = [];
  for (let i = 0; i < stepCount; i++) {
    steps.push({
      step: i,
      left: { motionType: "pro", rotDir: "cw" },
      right: { motionType: "pro", rotDir: "cw" },
    });
  }
  return steps;
}

function flipMotion(m) {
  return {
    motionType: m.motionType === "pro" ? "anti" : "pro",
    rotDir: m.rotDir === "cw" ? "ccw" : "cw",
  };
}

function applyReversal(steps, leftMask, rightMask) {
  return steps.map((s, i) => {
    const bRev = (leftMask >> i) & 1;
    const rRev = (rightMask >> i) & 1;
    return {
      step: s.step,
      left: bRev ? flipMotion(s.left) : { ...s.left },
      right: rRev ? flipMotion(s.right) : { ...s.right },
      leftReversed: !!bRev,
      rightReversed: !!rRev,
    };
  });
}

function checkBoundary(steps) {
  const first = steps[0];
  const last = steps[steps.length - 1];
  return last.left.motionType === first.left.motionType &&
         last.left.rotDir === first.left.rotDir &&
         last.right.motionType === first.right.motionType &&
         last.right.rotDir === first.right.rotDir;
}

function maskToPattern(mask, n) {
  let s = "";
  for (let i = 0; i < n; i++) s += (mask >> i) & 1 ? "X" : "-";
  return s;
}

function maskToString(mask, n) {
  const leftPat = [];
  const rightPat = [];
  // This is for combined patterns
  return maskToPattern(mask, n);
}

// For 4 steps, enumerate all clean-boundary patterns and look for the rule
const N = 4;
const total = Math.pow(2, N);

console.log(`═══ All Clean-Boundary Patterns for ${N} Steps ═══\n`);
console.log("Blue Pattern  Red Pattern   Blue#  Red#  Combined");
console.log("─".repeat(60));

const cleanPatterns = [];

for (let bMask = 0; bMask < total; bMask++) {
  for (let rMask = 0; rMask < total; rMask++) {
    const seq = makeSequence(N);
    const reversed = applyReversal(seq, bMask, rMask);
    if (checkBoundary(reversed)) {
      const bPat = maskToPattern(bMask, N);
      const rPat = maskToPattern(rMask, N);
      const bCount = reversed.filter(s => s.leftReversed).length;
      const rCount = reversed.filter(s => s.rightReversed).length;

      // Build combined pattern string
      const combined = [];
      for (let i = 0; i < N; i++) {
        const b = (bMask >> i) & 1;
        const r = (rMask >> i) & 1;
        if (b && r) combined.push("P");
        else if (b) combined.push("B");
        else if (r) combined.push("R");
        else combined.push("-");
      }

      console.log(`${bPat.padEnd(14)}${rPat.padEnd(14)}${String(bCount).padEnd(7)}${String(rCount).padEnd(6)}${combined.join("")}`);
      cleanPatterns.push({ bMask, rMask, bCount, rCount, combined: combined.join("") });
    }
  }
}

console.log(`\nTotal clean patterns: ${cleanPatterns.length} / ${total * total}`);

// Analyze: what's common to all clean patterns?
console.log("\n═══ Analysis ═══\n");

// Check: is it about the FIRST and LAST step being the same?
console.log("Checking if first step reversal state determines boundary...");
const firstLastSame = cleanPatterns.every(p => {
  const bFirst = (p.bMask >> 0) & 1;
  const bLast = (p.bMask >> (N-1)) & 1;
  const rFirst = (p.rMask >> 0) & 1;
  const rLast = (p.rMask >> (N-1)) & 1;
  return bFirst === bLast && rFirst === rLast;
});
console.log(`  First step reversal == Last step reversal for all clean? ${firstLastSame}`);

// Check: is it about the step 1 (first beat) matching what the last beat expects?
// The actual boundary is: last step's OUTPUT must match first step's INPUT.
// Since we flip from original (per-beat), the first step's INPUT is:
//   - If step 0 is reversed: flipped from original
//   - If step 0 is NOT reversed: same as original
// The last step's OUTPUT is:
//   - If step N-1 is reversed: flipped from original
//   - If step N-1 is NOT reversed: same as original
// So clean boundary = (step 0 reversed) == (step N-1 reversed), for BOTH hands.

console.log("\nChecking if step[0].reversed == step[N-1].reversed determines boundary...");
const rule = cleanPatterns.every(p => {
  const b0 = (p.bMask >> 0) & 1;
  const bN = (p.bMask >> (N-1)) & 1;
  const r0 = (p.rMask >> 0) & 1;
  const rN = (p.rMask >> (N-1)) & 1;
  return b0 === bN && r0 === rN;
});
console.log(`  Result: ${rule}`);

// Also verify the inverse: all dirty patterns have step[0] != step[N-1]
console.log("\nVerifying inverse (all dirty patterns have mismatched first/last)...");
let inverseFails = 0;
for (let bMask = 0; bMask < total; bMask++) {
  for (let rMask = 0; rMask < total; rMask++) {
    const seq = makeSequence(N);
    const reversed = applyReversal(seq, bMask, rMask);
    const clean = checkBoundary(reversed);
    const b0 = (bMask >> 0) & 1;
    const bN = (bMask >> (N-1)) & 1;
    const r0 = (rMask >> 0) & 1;
    const rN = (rMask >> (N-1)) & 1;
    const predicted = (b0 === bN) && (r0 === rN);
    if (clean !== predicted) inverseFails++;
  }
}
console.log(`  Mismatches between rule and reality: ${inverseFails}`);

if (inverseFails === 0) {
  console.log("\n═══ THEOREM PROVEN ═══");
  console.log("A reversal pattern produces a clean LOOP boundary if and only if,");
  console.log("for each hand independently, the FIRST step and LAST step have the");
  console.log("same reversal state (both reversed or both not reversed).");
  console.log("Parity (even/odd total count) is IRRELEVANT.");
}

// Verify at 6 and 8 steps
console.log("\n═══ Verification at larger step counts ═══\n");
for (const n of [6, 8]) {
  const tot = Math.pow(2, n);
  let fails = 0;
  let tested = 0;
  for (let bMask = 0; bMask < tot; bMask++) {
    for (let rMask = 0; rMask < tot; rMask++) {
      const seq = makeSequence(n);
      const reversed = applyReversal(seq, bMask, rMask);
      const clean = checkBoundary(reversed);
      const b0 = (bMask >> 0) & 1;
      const bN = (bMask >> (n-1)) & 1;
      const r0 = (rMask >> 0) & 1;
      const rN = (rMask >> (n-1)) & 1;
      const predicted = (b0 === bN) && (r0 === rN);
      if (clean !== predicted) fails++;
      tested++;
    }
  }
  console.log(`${n}-step: tested ${tested} combinations, rule failures: ${fails}`);
}
