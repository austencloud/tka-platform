#!/usr/bin/env node
/**
 * L2 Quartered Rotated LOOP Deck — Canonical Enumeration + Turn Allocation
 *
 * Enumerates all 4-step quartered rotated LOOPs in diamond mode.
 * Quartered = 1-step seed rotated 90° four times.
 * Subset of halved rotated LOOPs where the seed is a single letter.
 *
 * Usage:
 *   node scripts/seed-l2-quartered-rotated-deck.cjs --dry-run
 *   node scripts/seed-l2-quartered-rotated-deck.cjs --out deck.json
 *   node scripts/seed-l2-quartered-rotated-deck.cjs --seed-firestore
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const seedFirestore = args.includes("--seed-firestore");
const outIdx = args.indexOf("--out");
const outPath = outIdx !== -1 ? args[outIdx + 1] : null;

const GRID_MODE = "diamond";
const SEED_LENGTH = 1;
const LEVEL = 2;
const MAX_TURNS = 1;
const DECK_ID = "l2-quartered-rotated-4step-t1";

// Start positions — one per position family
const DEFAULT_STARTS = ["alpha1", "beta5", "gamma11"];

// CSV Loading

const CSV_PATH = path.join(
  __dirname, "..", "static", "data", "pictographs", "DiamondPictographDataframe.csv"
);

const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
const csvLines = csvContent.split("\n");
const headers = csvLines[0].split(",").map(h => h.trim());

const edges = [];
for (let i = 1; i < csvLines.length; i++) {
  const cols = csvLines[i].split(",").map(c => c.trim());
  if (cols.length < 13 || !cols[0]) continue;
  edges.push({
    letter: cols[0],
    startPos: cols[1],
    endPos: cols[2],
    timing: cols[3],
    direction: cols[4],
    blueMotionType: cols[5],
    blueRotDir: cols[6],
    blueStartLoc: cols[7],
    blueEndLoc: cols[8],
    redMotionType: cols[9],
    redRotDir: cols[10],
    redStartLoc: cols[11],
    redEndLoc: cols[12],
  });
}

const adjacency = {};
for (const e of edges) {
  if (!adjacency[e.startPos]) adjacency[e.startPos] = [];
  adjacency[e.startPos].push(e);
}

console.log(`Loaded ${edges.length} edges from CSV`);

// ============================================================================
// Letter Types
// ============================================================================

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
  4: 'Dash', 5: 'Dual-Dash', 6: 'Static',
};

// ============================================================================
// Reversal Check
// ============================================================================

function hasReversals(beatSteps) {
  function getRotDir(step, color) {
    const m = step.motions[color];
    if (!m) return null;
    if (m.rotationDirection && m.rotationDirection !== 'noRotation') return m.rotationDirection;
    if (m.motionType === 'static' || m.motionType === 'dash') return null;
    return m.rotationDirection || null;
  }

  function getLastValidDir(steps, endIdx, color) {
    for (let offset = 1; offset <= steps.length; offset++) {
      const idx = (endIdx - offset + steps.length) % steps.length;
      const dir = getRotDir(steps[idx], color);
      if (dir) return dir;
    }
    return null;
  }

  for (let i = 0; i < beatSteps.length; i++) {
    for (const color of ['blue', 'red']) {
      const current = getRotDir(beatSteps[i], color);
      if (!current) continue;
      const prev = getLastValidDir(beatSteps, i, color);
      if (prev && prev !== current) return true;
    }
  }
  return false;
}

// ============================================================================
// Canonical Fingerprinting (same as halved — min circular rotation of 4-step)
// ============================================================================

function compareLetterArrays(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i >= a.length) return -1;
    if (i >= b.length) return 1;
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function minCircularRotation(letterArray) {
  let min = letterArray;
  for (let i = 1; i < letterArray.length; i++) {
    const rotated = [...letterArray.slice(i), ...letterArray.slice(0, i)];
    if (compareLetterArrays(rotated, min) < 0) min = rotated;
  }
  return min;
}

function canonicalFingerprint(letterArray) {
  return minCircularRotation(letterArray).join("|");
}

// ============================================================================
// Main
// ============================================================================

(async function main() {
  const circularMaps = await import("../packages/sequence-engine/dist/loop/position-maps/circular-position-maps.js");
  const { QUARTERED_LOOPS } = circularMaps;

  const { loopExecutorSelector } = await import("../packages/sequence-engine/dist/loop/execution/LOOPExecutorSelector.js");
  const { calculateEndOrientation } = await import("../packages/sequence-engine/dist/core/orientation/OrientationCalculator.js");
  const executor = loopExecutorSelector.getExecutor("rotated");

  // Build start→valid-ends map from QUARTERED_LOOPS
  const startEndMap = {};
  for (const pair of QUARTERED_LOOPS) {
    const [start, end] = pair.split(",");
    if (DEFAULT_STARTS.includes(start)) {
      if (!startEndMap[start]) startEndMap[start] = new Set();
      startEndMap[start].add(end);
    }
  }

  const validStarts = Object.keys(startEndMap);
  console.log(`\nValid starts:`);
  for (const [s, ends] of Object.entries(startEndMap)) {
    console.log(`  ${s} → ${[...ends].join(" or ")}`);
  }

  // ========================================================================
  // Phase 1: Enumerate 1-step seeds hitting 90° endpoint
  // ========================================================================

  const allSeeds = [];
  const seedSeen = new Set();
  let totalRaw = 0;

  for (const startPos of validStarts) {
    const requiredEnds = startEndMap[startPos];
    const neighbors = adjacency[startPos] || [];
    let rawCount = 0;

    for (const edge of neighbors) {
      rawCount++;
      if (requiredEnds.has(edge.endPos)) {
        const key = `${startPos}|${edge.letter}`;
        if (seedSeen.has(key)) continue;
        seedSeen.add(key);
        allSeeds.push({ startPos, edge, seedWord: edge.letter });
      }
    }
    totalRaw += rawCount;
    const posSeeds = allSeeds.filter(s => s.startPos === startPos).length;
    console.log(`  ${startPos}: ${rawCount} edges checked → ${posSeeds} valid seeds`);
  }

  console.log(`\nTotal edges checked: ${totalRaw}`);
  console.log(`Total deduped seeds: ${allSeeds.length}`);

  // ========================================================================
  // Phase 2: Execute LOOP for each seed → full 4-step sequences
  // ========================================================================

  function edgeToEngineStep(edge, beatIndex) {
    return {
      id: `beat-${beatIndex}`,
      letter: edge.letter,
      startPosition: edge.startPos,
      endPosition: edge.endPos,
      beatIndex,
      stepNumber: beatIndex,
      duration: 1,
      motions: {
        blue: {
          motionType: edge.blueMotionType,
          rotationDirection: edge.blueRotDir,
          startLocation: edge.blueStartLoc,
          endLocation: edge.blueEndLoc,
          startOrientation: "in",
          endOrientation: "in",
          turns: 0,
          color: "blue",
        },
        red: {
          motionType: edge.redMotionType,
          rotationDirection: edge.redRotDir,
          startLocation: edge.redStartLoc,
          endLocation: edge.redEndLoc,
          startOrientation: "in",
          endOrientation: "in",
          turns: 0,
          color: "red",
        },
      },
    };
  }

  function propagateOrientations(steps) {
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      const step = steps[i];
      step.motions.blue.startOrientation = prev.motions.blue.endOrientation;
      step.motions.red.startOrientation = prev.motions.red.endOrientation;
      step.motions.blue.endOrientation = calculateEndOrientation({
        motionType: step.motions.blue.motionType,
        turns: step.motions.blue.turns,
        rotationDirection: step.motions.blue.rotationDirection,
        startLocation: step.motions.blue.startLocation,
        endLocation: step.motions.blue.endLocation,
        startOrientation: step.motions.blue.startOrientation,
      });
      step.motions.red.endOrientation = calculateEndOrientation({
        motionType: step.motions.red.motionType,
        turns: step.motions.red.turns,
        rotationDirection: step.motions.red.rotationDirection,
        startLocation: step.motions.red.startLocation,
        endLocation: step.motions.red.endLocation,
        startOrientation: step.motions.red.startOrientation,
      });
    }
    return steps;
  }

  const fullSequences = [];
  let loopErrors = 0;

  for (const seed of allSeeds) {
    const edge = seed.edge;
    const startStep = {
      id: `start`,
      letter: seed.startPos.startsWith("alpha") ? "α" : seed.startPos.startsWith("beta") ? "β" : "γ",
      startPosition: seed.startPos,
      endPosition: seed.startPos,
      beatIndex: 0,
      stepNumber: 0,
      duration: 1,
      motions: {
        blue: {
          motionType: "static", rotationDirection: "noRotation",
          startLocation: edge.blueStartLoc, endLocation: edge.blueStartLoc,
          startOrientation: "in", endOrientation: "in", turns: 0, color: "blue",
        },
        red: {
          motionType: "static", rotationDirection: "noRotation",
          startLocation: edge.redStartLoc, endLocation: edge.redStartLoc,
          startOrientation: "in", endOrientation: "in", turns: 0, color: "red",
        },
      },
    };

    const seedSteps = [startStep, edgeToEngineStep(edge, 1)];
    propagateOrientations(seedSteps);

    let fullSteps;
    try {
      fullSteps = executor.executeLOOP([...seedSteps], "quartered");
    } catch (err) {
      loopErrors++;
      if (loopErrors <= 5) console.warn(`  LOOP error for ${seed.startPos}/${seed.seedWord}: ${err.message}`);
      continue;
    }

    const beatSteps = fullSteps.slice(1);
    if (hasReversals(beatSteps)) continue;

    const letterArray = beatSteps.map(s => s.letter);
    const fullWord = letterArray.join("");

    fullSequences.push({
      seed,
      fullSteps,
      beatSteps,
      fullWord,
      letterArray,
      letterType: TYPES[edge.letter] || 0,
      typeName: TYPE_NAMES[TYPES[edge.letter] || 0] || "?",
    });
  }

  if (loopErrors) console.log(`  ${loopErrors} LOOP execution errors`);
  console.log(`After LOOP execution + reversal filter: ${fullSequences.length} valid sequences`);

  // ========================================================================
  // Phase 3: Canonical Fingerprinting + Dedup
  // ========================================================================

  const canonicalGroups = new Map();
  for (const seq of fullSequences) {
    const fp = canonicalFingerprint(seq.letterArray);
    if (!canonicalGroups.has(fp)) canonicalGroups.set(fp, []);
    canonicalGroups.get(fp).push(seq);
  }

  const START_PRIORITY = { alpha1: 0, beta5: 1, gamma11: 2 };
  const canonicals = [];

  for (const [fp, members] of canonicalGroups) {
    members.sort((a, b) => (START_PRIORITY[a.seed.startPos] ?? 99) - (START_PRIORITY[b.seed.startPos] ?? 99));
    const rep = members[0];
    canonicals.push({
      fingerprint: fp,
      representative: rep,
      allMembers: members,
      memberCount: members.length,
      letterType: rep.letterType,
      typeName: rep.typeName,
    });
  }

  canonicals.sort((a, b) => {
    if (a.letterType !== b.letterType) return a.letterType - b.letterType;
    return a.fingerprint.localeCompare(b.fingerprint);
  });

  // Count by type
  const byType = {};
  for (const c of canonicals) {
    const key = c.typeName;
    byType[key] = (byType[key] || 0) + 1;
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  CANONICAL HAND PATHS: ${canonicals.length} total`);
  console.log(`${"═".repeat(60)}`);

  // ========================================================================
  // Phase 4: Turn Allocation (L2, max 1 per step per hand)
  // ========================================================================

  function findBestTurnAssignment(seq) {
    const { fullSteps } = seq.representative;
    const beatSteps = fullSteps.slice(1);
    let bestAssignment = null;
    let bestTotalTurns = -1;

    // 2^2 = 4 combinations for 1-step seed (blue, red on one step)
    // Quartered mirrors to all 4 steps
    for (let mask = 0; mask < 4; mask++) {
      const seedTurns = { blue: (mask >> 0) & 1, red: (mask >> 1) & 1 };
      const allTurns = [seedTurns, seedTurns, seedTurns, seedTurns];
      const totalTurns = allTurns.reduce((s, t) => s + t.blue + t.red, 0);
      if (totalTurns <= bestTotalTurns) continue;

      const testSteps = beatSteps.map((step, i) => ({
        ...step,
        motions: {
          blue: { ...step.motions.blue, turns: allTurns[i].blue },
          red: { ...step.motions.red, turns: allTurns[i].red },
        },
      }));

      let blueOri = "in";
      let redOri = "in";
      for (const step of testSteps) {
        step.motions.blue.startOrientation = blueOri;
        step.motions.red.startOrientation = redOri;
        step.motions.blue.endOrientation = calculateEndOrientation({
          motionType: step.motions.blue.motionType,
          turns: step.motions.blue.turns,
          rotationDirection: step.motions.blue.rotationDirection,
          startLocation: step.motions.blue.startLocation,
          endLocation: step.motions.blue.endLocation,
          startOrientation: blueOri,
        });
        step.motions.red.endOrientation = calculateEndOrientation({
          motionType: step.motions.red.motionType,
          turns: step.motions.red.turns,
          rotationDirection: step.motions.red.rotationDirection,
          startLocation: step.motions.red.startLocation,
          endLocation: step.motions.red.endLocation,
          startOrientation: redOri,
        });
        blueOri = step.motions.blue.endOrientation;
        redOri = step.motions.red.endOrientation;
      }

      if (blueOri === "in" && redOri === "in") {
        bestAssignment = allTurns;
        bestTotalTurns = totalTurns;
      }
    }

    return bestAssignment || [
      { blue: 0, red: 0 }, { blue: 0, red: 0 },
      { blue: 0, red: 0 }, { blue: 0, red: 0 },
    ];
  }

  // ========================================================================
  // Output
  // ========================================================================

  console.log(`\n╔${"═".repeat(63)}╗`);
  console.log(`║   L2 QUARTERED ROTATED LOOP DECK (max T1)`);
  console.log(`║   diamond grid · 4 steps · ${canonicals.length} canonical hand paths`);
  console.log(`╚${"═".repeat(63)}╝\n`);

  for (const [typeName, count] of Object.entries(byType).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ═══ ${typeName} ═══ ${count} canonical ═══`);
    const group = canonicals.filter(c => c.typeName === typeName);
    for (const c of group) {
      const turns = findBestTurnAssignment(c);
      const turnStr = turns.map(t => `${t.blue}${t.red}`).join(" ");
      const totalTurns = turns.reduce((s, t) => s + t.blue + t.red, 0);
      console.log(`  ${c.representative.seed.seedWord.padEnd(6)} from ${c.representative.seed.startPos.padEnd(9)} turns=[${turnStr}] total=${totalTurns} (${c.memberCount} variant${c.memberCount > 1 ? "s" : ""})`);
    }
    console.log();
  }

  console.log(`${"═".repeat(60)}`);
  console.log(`  DECK SUMMARY`);
  console.log(`  Total canonical hand paths: ${canonicals.length}`);
  console.log(`  By type:`);
  for (const [name, count] of Object.entries(byType).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`    ${name}: ${count}`);
  }
  console.log(`${"═".repeat(60)}`);

  if (outPath) {
    const output = canonicals.map((c, i) => {
      const turns = findBestTurnAssignment(c);
      return {
        index: i + 1,
        seed: c.representative.seed.seedWord,
        fullWord: c.representative.fullWord,
        letterArray: c.representative.letterArray,
        fingerprint: c.fingerprint,
        startPos: c.representative.seed.startPos,
        letterType: c.letterType,
        typeName: c.typeName,
        turns,
        totalTurns: turns.reduce((s, t) => s + t.blue + t.red, 0),
        variants: c.memberCount,
      };
    });
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`\nWrote ${outPath}`);
  }

  // ========================================================================
  // Phase 5: Firestore Seeding
  // ========================================================================

  if (seedFirestore) {
    const admin = require("firebase-admin");
    const serviceAccountPath = path.resolve(__dirname, "../serviceAccountKey.json");
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    } catch {
      console.error("Missing serviceAccountKey.json in project root.");
      process.exit(1);
    }

    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    const db = admin.firestore();

    console.log(`\nSeeding deck "${DECK_ID}" to Firestore...`);

    // Delete old sequences
    const oldRef = db.collection(`catalogs/${DECK_ID}/sequences`);
    const oldSnap = await oldRef.get();
    if (!oldSnap.empty) {
      console.log(`  Deleting ${oldSnap.size} old docs...`);
      const delBatch = db.batch();
      for (const doc of oldSnap.docs) delBatch.delete(doc.ref);
      await delBatch.commit();
    }

    let batch = db.batch();
    let batchCount = 0;
    let totalWritten = 0;

    for (const canon of canonicals) {
      const rep = canon.representative;
      const turns = findBestTurnAssignment(canon);
      const beatSteps = rep.beatSteps;

      const stepsWithTurns = beatSteps.map((step, i) => ({
        ...step,
        motions: {
          blue: { ...step.motions.blue, turns: turns[i].blue },
          red: { ...step.motions.red, turns: turns[i].red },
        },
      }));

      let blueOri = "in";
      let redOri = "in";
      for (const step of stepsWithTurns) {
        step.motions.blue.startOrientation = blueOri;
        step.motions.red.startOrientation = redOri;
        step.motions.blue.endOrientation = calculateEndOrientation({
          motionType: step.motions.blue.motionType,
          turns: step.motions.blue.turns,
          rotationDirection: step.motions.blue.rotationDirection,
          startLocation: step.motions.blue.startLocation,
          endLocation: step.motions.blue.endLocation,
          startOrientation: blueOri,
        });
        step.motions.red.endOrientation = calculateEndOrientation({
          motionType: step.motions.red.motionType,
          turns: step.motions.red.turns,
          rotationDirection: step.motions.red.rotationDirection,
          startLocation: step.motions.red.startLocation,
          endLocation: step.motions.red.endLocation,
          startOrientation: redOri,
        });
        blueOri = step.motions.blue.endOrientation;
        redOri = step.motions.red.endOrientation;
      }

      const sp = rep.fullSteps[0];
      const seqId = `${rep.seed.startPos}_${rep.fullWord}`;
      const seqRef = db.doc(`catalogs/${DECK_ID}/sequences/${seqId}`);

      const firestoreSteps = stepsWithTurns.map((step, i) => ({
        beat: i,
        letter: step.letter,
        startPosition: step.startPosition,
        endPosition: step.endPosition,
        blueReversal: false,
        redReversal: false,
        motions: {
          blue: {
            motionType: step.motions.blue.motionType,
            rotationDirection: step.motions.blue.rotationDirection,
            startLocation: step.motions.blue.startLocation,
            endLocation: step.motions.blue.endLocation,
            turns: step.motions.blue.turns,
            startOrientation: step.motions.blue.startOrientation,
            endOrientation: step.motions.blue.endOrientation,
            isVisible: true, propType: "staff", color: "blue", gridMode: GRID_MODE,
          },
          red: {
            motionType: step.motions.red.motionType,
            rotationDirection: step.motions.red.rotationDirection,
            startLocation: step.motions.red.startLocation,
            endLocation: step.motions.red.endLocation,
            turns: step.motions.red.turns,
            startOrientation: step.motions.red.startOrientation,
            endOrientation: step.motions.red.endOrientation,
            isVisible: true, propType: "staff", color: "red", gridMode: GRID_MODE,
          },
        },
      }));

      const startPosition = {
        isStartPosition: true,
        id: `start-${seqId}`,
        gridPosition: sp.startPosition,
        gridMode: GRID_MODE,
        motions: {
          blue: {
            motionType: sp.motions.blue.motionType,
            rotationDirection: sp.motions.blue.rotationDirection,
            startLocation: sp.motions.blue.startLocation,
            endLocation: sp.motions.blue.endLocation,
            turns: 0,
            startOrientation: "in", endOrientation: "in",
            isVisible: true, propType: "staff", color: "blue", gridMode: GRID_MODE,
          },
          red: {
            motionType: sp.motions.red.motionType,
            rotationDirection: sp.motions.red.rotationDirection,
            startLocation: sp.motions.red.startLocation,
            endLocation: sp.motions.red.endLocation,
            turns: 0,
            startOrientation: "in", endOrientation: "in",
            isVisible: true, propType: "staff", color: "red", gridMode: GRID_MODE,
          },
        },
      };

      const seqData = {
        id: seqId,
        name: rep.fullWord,
        word: rep.fullWord,
        canonicalHandPath: canon.fingerprint,
        gridMode: GRID_MODE,
        isCircular: true,
        loopType: "rotated",
        orientationCycleCount: 4,
        reversalPattern: "continuous",
        sequenceLength: 4,
        level: LEVEL,
        isFavorite: false,
        tags: ["vtg-overlap"],
        thumbnails: [],
        steps: firestoreSteps,
        startPosition,
        metadata: {
          deckId: DECK_ID,
          canonicalFingerprint: canon.fingerprint,
          letterType: canon.letterType,
          typeName: canon.typeName,
          turnAssignment: turns,
          totalTurns: turns.reduce((s, t) => s + t.blue + t.red, 0),
          variantCount: canon.memberCount,
        },
        author: "TKA Enumerator",
        notes: "",
      };

      batch.set(seqRef, seqData);
      batchCount++;
      totalWritten++;

      if (batchCount >= 500) {
        await batch.commit();
        console.log(`  Written ${totalWritten}/${canonicals.length}...`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) await batch.commit();

    const allSequenceIds = canonicals.map(c =>
      `${c.representative.seed.startPos}_${c.representative.fullWord}`
    );

    const families = [{
      id: "family-0",
      label: "Dual-Shift",
      typeCombo: "Dual-Shift",
      sequenceIds: allSequenceIds,
    }];

    const deckData = {
      id: DECK_ID,
      name: `Level 2: Quartered Rotated LOOP (T1)`,
      canonicalName: "Quartered Rotated · 4-Step · Max 1T · Continuous · Diamond",
      description: `${canonicals.length} canonical hand paths for 4-step quartered rotated LOOPs. Single letter rotated 90° four times. All Dual-Shift. Max 1 turn per step.`,
      families,
      totalSequences: totalWritten,
      gridMode: GRID_MODE,
      level: LEVEL,
      collection: "LOOPs",
      loopType: "rotated",
      sliceType: "quartered",
      stepCount: 4,
      maxTurnIntensity: MAX_TURNS,
      turnPattern: "l2-t1",
      reversalPattern: "continuous",
      vtgOverlapCount: totalWritten,
      newHandPathCount: 0,
    };

    await db.doc(`catalogs/${DECK_ID}`).set(deckData);
    console.log(`  Deck doc written. ${totalWritten} sequences in decks/${DECK_ID}/`);
  }

  if (!outPath && !seedFirestore) {
    console.log(`\nUse --out <path> for JSON or --seed-firestore to write to Firestore.`);
  }
})();
