/**
 * Test: do odd reversal counts produce valid LOOP boundaries?
 *
 * Creates a simple rotated LOOP, applies reversal patterns with even and odd
 * counts, checks whether the end state matches the start state at the boundary.
 */

// A minimal 4-step halved rotated LOOP (all pro CW, 0 turns):
// Step 0 (start): blue@N pro CW, red@S pro CW
// Step 1: blue@E pro CW, red@W pro CW
// Step 2: blue@S pro CW, red@N pro CW  (180° rotation of step 0)
// Step 3: blue@W pro CW, red@E pro CW  (180° rotation of step 1)
// -> Returns to step 0 positions. Valid rotated LOOP.

function makeSequence(stepCount, startMotion) {
  const mt = startMotion || "pro";
  const rd = "cw";
  const steps = [];
  for (let i = 0; i < stepCount; i++) {
    steps.push({
      step: i,
      blue: { motionType: mt, rotDir: rd },
      red: { motionType: mt, rotDir: rd },
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

// Apply reversal: flip each step's motion from its ORIGINAL value (per-beat, not cumulative)
function applyReversal(steps, bluePattern, redPattern) {
  const result = steps.map((s, i) => {
    const bRev = bluePattern[i % bluePattern.length] === "X";
    const rRev = redPattern[i % redPattern.length] === "X";
    return {
      step: s.step,
      blue: bRev ? flipMotion(s.blue) : { ...s.blue },
      red: rRev ? flipMotion(s.red) : { ...s.red },
      blueReversed: bRev,
      redReversed: rRev,
    };
  });
  return result;
}

function countReversals(steps, hand) {
  return steps.filter((s) => s[hand + "Reversed"]).length;
}

// Check: does the last step's motion state match the first step's?
// (This is what matters for a seamless LOOP)
function checkBoundary(steps) {
  const first = steps[0];
  const last = steps[steps.length - 1];
  const blueMatch = last.blue.motionType === first.blue.motionType &&
                    last.blue.rotDir === first.blue.rotDir;
  const redMatch = last.red.motionType === first.red.motionType &&
                   last.red.rotDir === first.red.rotDir;
  return { blueMatch, redMatch, bothMatch: blueMatch && redMatch };
}

// Exhaustive test: try ALL possible blue/red reversal combinations for a step count
function exhaustiveTest(stepCount) {
  const totalCombos = Math.pow(2, stepCount);
  let cleanBoundary = 0;
  let boundaryReversal = 0;
  let evenEvenClean = 0;
  let evenEvenDirty = 0;
  let oddClean = 0;
  let oddDirty = 0;

  for (let bMask = 0; bMask < totalCombos; bMask++) {
    for (let rMask = 0; rMask < totalCombos; rMask++) {
      const bluePattern = [];
      const redPattern = [];
      for (let i = 0; i < stepCount; i++) {
        bluePattern.push((bMask >> i) & 1 ? "X" : "-");
        redPattern.push((rMask >> i) & 1 ? "X" : "-");
      }

      const seq = makeSequence(stepCount, "pro");
      const reversed = applyReversal(seq, bluePattern, redPattern);
      const boundary = checkBoundary(reversed);
      const blueCount = countReversals(reversed, "blue");
      const redCount = countReversals(reversed, "red");
      const blueEven = blueCount % 2 === 0;
      const redEven = redCount % 2 === 0;

      if (boundary.bothMatch) {
        cleanBoundary++;
        if (blueEven && redEven) evenEvenClean++;
        else oddClean++;
      } else {
        boundaryReversal++;
        if (blueEven && redEven) evenEvenDirty++;
        else oddDirty++;
      }
    }
  }

  return { stepCount, totalCombos: totalCombos * totalCombos, cleanBoundary, boundaryReversal, evenEvenClean, evenEvenDirty, oddClean, oddDirty };
}

// Named pattern tests
console.log("═══ Named Pattern Boundary Tests ═══\n");

const PATTERNS = [
  { name: "Continuous",  blue: "----", red: "----" },
  { name: "Book",        blue: "XXXX", red: "XXXX" },
  { name: "Red Book",    blue: "----", red: "XXXX" },
  { name: "Blue Book",   blue: "XXXX", red: "----" },
  { name: "Long Book",   blue: "X-X-", red: "X-X-" },
  { name: "Alternating", blue: "-X-X", red: "X-X-" },
];

for (const stepCount of [4, 6, 8]) {
  console.log(`── ${stepCount}-step sequences ──`);
  for (const pat of PATTERNS) {
    const seq = makeSequence(stepCount, "pro");
    const reversed = applyReversal(seq, pat.blue.split(""), pat.red.split(""));
    const blueCount = countReversals(reversed, "blue");
    const redCount = countReversals(reversed, "red");
    const boundary = checkBoundary(reversed);
    const blueEven = blueCount % 2 === 0 ? "even" : "ODD";
    const redEven = redCount % 2 === 0 ? "even" : "ODD";
    const boundaryOk = boundary.bothMatch ? "✓ CLEAN" : "✗ MISMATCH";

    console.log(`  ${pat.name.padEnd(14)} blue=${blueCount}(${blueEven}) red=${redCount}(${redEven})  boundary: ${boundaryOk}`);
    if (!boundary.bothMatch) {
      const first = reversed[0];
      const last = reversed[reversed.length - 1];
      console.log(`    last: blue=${last.blue.motionType}/${last.blue.rotDir} red=${last.red.motionType}/${last.red.rotDir}`);
      console.log(`    first: blue=${first.blue.motionType}/${first.blue.rotDir} red=${first.red.motionType}/${first.red.rotDir}`);
    }
  }
  console.log();
}

// Exhaustive combinatorial test
console.log("═══ Exhaustive Boundary Tests ═══\n");

for (const stepCount of [4, 6]) {
  const result = exhaustiveTest(stepCount);
  console.log(`── ${stepCount}-step: ${result.totalCombos} total combinations ──`);
  console.log(`  Clean boundary:    ${result.cleanBoundary}`);
  console.log(`  Boundary mismatch: ${result.boundaryReversal}`);
  console.log(`  Even+Even → clean: ${result.evenEvenClean}  dirty: ${result.evenEvenDirty}`);
  console.log(`  Any odd   → clean: ${result.oddClean}  dirty: ${result.oddDirty}`);
  console.log();
}

console.log("═══ Conclusion ═══\n");
console.log("If 'Any odd → clean' > 0, then odd reversal counts CAN produce clean boundaries.");
console.log("If 'Even+Even → dirty' > 0, then even counts DON'T guarantee clean boundaries.");
console.log("If 'Any odd → clean' === 0, then odd counts ALWAYS produce mismatches.");
