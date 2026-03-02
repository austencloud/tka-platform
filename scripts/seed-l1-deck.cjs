/**
 * Seed the Level 1 Quartered Rotated LOOP Deck to Firestore
 *
 * Enumerates all valid sequences (64 per starting position),
 * organizes into hand-path families, and writes complete step data:
 *   - decks/l1-quartered-loop (deck metadata)
 *   - decks/l1-quartered-loop/sequences/{id} (sequence docs with full steps)
 *
 * Usage: node scripts/seed-l1-deck.cjs
 * Requires: serviceAccountKey.json in project root
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

// --- Firebase Admin init ---
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "serviceAccountKey.json"), "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// --- CSV Parsing ---
const csvPath = path.join(
  __dirname,
  "..",
  "static",
  "data",
  "pictographs",
  "DiamondPictographDataframe.csv"
);
const raw = fs.readFileSync(csvPath, "utf-8");
const lines = raw
  .split("\n")
  .filter((l) => l.trim() && l.indexOf("letter,") !== 0);

const edges = [];
for (const line of lines) {
  const p = line.split(",");
  if (p.length < 13) continue;
  edges.push({
    letter: p[0],
    startPos: p[1],
    endPos: p[2],
    timing: p[3],
    direction: p[4],
    blueMotionType: p[5],
    blueRotDir: p[6],
    blueStartLoc: p[7],
    blueEndLoc: p[8],
    redMotionType: p[9],
    redRotDir: p[10],
    redStartLoc: p[11],
    redEndLoc: p[12].trim(),
  });
}

// --- Build adjacency ---
const adj = {};
for (const e of edges) {
  if (!adj[e.startPos]) adj[e.startPos] = [];
  adj[e.startPos].push(e);
}

// --- Position rotation ---
const rotatePos90 = {
  alpha1: "alpha3",
  alpha3: "alpha5",
  alpha5: "alpha7",
  alpha7: "alpha1",
  beta1: "beta3",
  beta3: "beta5",
  beta5: "beta7",
  beta7: "beta1",
  gamma1: "gamma3",
  gamma3: "gamma5",
  gamma5: "gamma7",
  gamma7: "gamma9",
  gamma9: "gamma11",
  gamma11: "gamma13",
  gamma13: "gamma15",
  gamma15: "gamma1",
};

function rotOk(prev, next) {
  if (prev === "noRotation" || next === "noRotation") return true;
  return prev === next;
}

// --- Letter types ---
const TYPES = {
  A: 1, B: 1, C: 1, D: 1, E: 1, F: 1,
  G: 1, H: 1, I: 1, J: 1, K: 1, L: 1,
  M: 1, N: 1, O: 1, P: 1, Q: 1, R: 1,
  S: 1, T: 1, U: 1, V: 1,
  W: 2, X: 2, Y: 2, Z: 2, "Σ": 2, "Δ": 2, "Θ": 2, "Ω": 2,
  "W-": 3, "X-": 3, "Y-": 3, "Z-": 3, "Σ-": 3, "Δ-": 3, "Θ-": 3, "Ω-": 3,
  "Φ": 4, "Ψ": 4, "Λ": 4,
  "Φ-": 5, "Ψ-": 5, "Λ-": 5,
  "α": 6, "β": 6, "γ": 6,
};

const TYPE_NAMES = {
  1: "Dual-Shift",
  2: "Shift",
  3: "Cross-Shift",
  4: "Dash",
  5: "Dual-Dash",
  6: "Static",
};

// --- Step data builders ---

/**
 * Find an edge from `fromPos` that matches the template edge's
 * letter, motion types, and rotation direction compatibility.
 */
function findMatchingEdge(fromPos, template) {
  const candidates = adj[fromPos] || [];
  for (const e of candidates) {
    if (e.letter !== template.letter) continue;
    if (e.blueMotionType !== template.blueMotionType) continue;
    if (e.redMotionType !== template.redMotionType) continue;
    if (!rotOk(e.blueRotDir, template.blueRotDir)) continue;
    if (!rotOk(e.redRotDir, template.redRotDir)) continue;
    return e;
  }
  return null;
}

/** Build motion data for one hand from a CSV edge */
function buildMotion(edge, color) {
  const isBlue = color === "blue";
  return {
    motionType: isBlue ? edge.blueMotionType : edge.redMotionType,
    rotationDirection: isBlue ? edge.blueRotDir : edge.redRotDir,
    startLocation: isBlue ? edge.blueStartLoc : edge.redStartLoc,
    endLocation: isBlue ? edge.blueEndLoc : edge.redEndLoc,
    turns: 0,
    startOrientation: "in",
    endOrientation: "in",
    color,
    propType: "staff",
    gridMode: "diamond",
    isVisible: true,
    arrowLocation: isBlue ? edge.blueEndLoc : edge.redEndLoc,
  };
}

/** Build one step from a CSV edge */
function buildStep(edge, stepNumber) {
  return {
    id: randomUUID(),
    isStep: true,
    stepNumber,
    letter: edge.letter,
    startPosition: edge.startPos,
    endPosition: edge.endPos,
    gridMode: "diamond",
    duration: 1.0,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    motions: {
      blue: buildMotion(edge, "blue"),
      red: buildMotion(edge, "red"),
    },
  };
}

/** Build all 8 steps for a quartered rotated LOOP */
function buildAllSteps(b1, b2, startPos) {
  const steps = [];
  let pos = startPos;

  for (let q = 0; q < 4; q++) {
    let beat1Edge, beat2Edge;

    if (q === 0) {
      beat1Edge = b1;
      beat2Edge = b2;
    } else {
      beat1Edge = findMatchingEdge(pos, b1);
      if (!beat1Edge) return null;
      beat2Edge = findMatchingEdge(beat1Edge.endPos, b2);
      if (!beat2Edge) return null;
    }

    steps.push(buildStep(beat1Edge, q * 2 + 1));
    steps.push(buildStep(beat2Edge, q * 2 + 2));

    pos = rotatePos90[pos];
  }

  return steps;
}

/** Build start position data from the first edge */
function buildStartPosition(b1Edge) {
  return {
    isStartPosition: true,
    id: randomUUID(),
    gridPosition: b1Edge.startPos,
    gridMode: "diamond",
    motions: {
      blue: {
        motionType: "static",
        rotationDirection: "noRotation",
        startLocation: b1Edge.blueStartLoc,
        endLocation: b1Edge.blueStartLoc,
        turns: 0,
        startOrientation: "in",
        endOrientation: "in",
        color: "blue",
        propType: "staff",
        gridMode: "diamond",
        isVisible: true,
        arrowLocation: b1Edge.blueStartLoc,
      },
      red: {
        motionType: "static",
        rotationDirection: "noRotation",
        startLocation: b1Edge.redStartLoc,
        endLocation: b1Edge.redStartLoc,
        turns: 0,
        startOrientation: "in",
        endOrientation: "in",
        color: "red",
        propType: "staff",
        gridMode: "diamond",
        isVisible: true,
        arrowLocation: b1Edge.redStartLoc,
      },
    },
  };
}

/**
 * Create a short motion-type suffix for unique IDs.
 * Maps first letter of each motion type: p(ro), a(nti), d(ash), s(tatic), f(loat)
 */
function motionSuffix(b1, b2) {
  return [b1.blueMotionType, b1.redMotionType, b2.blueMotionType, b2.redMotionType]
    .map((m) => m[0])
    .join("");
}

// --- Enumeration (with full step data) ---
function enumerateLoops(startPos) {
  const results = [];
  const seenVariants = {};

  const n1 = adj[startPos] || [];
  for (const b1 of n1) {
    const n2 = adj[b1.endPos] || [];
    for (const b2 of n2) {
      if (
        !rotOk(b1.blueRotDir, b2.blueRotDir) ||
        !rotOk(b1.redRotDir, b2.redRotDir)
      )
        continue;
      if (b2.endPos !== rotatePos90[startPos]) continue;
      if (
        !rotOk(b2.blueRotDir, b1.blueRotDir) ||
        !rotOk(b2.redRotDir, b1.redRotDir)
      )
        continue;

      const variantKey = `${b1.letter}|${b2.letter}|${b1.blueMotionType}/${b1.redMotionType}|${b2.blueMotionType}/${b2.redMotionType}`;
      if (seenVariants[variantKey]) continue;
      seenVariants[variantKey] = true;

      // Build full step data for all 8 beats
      const steps = buildAllSteps(b1, b2, startPos);
      if (!steps) {
        console.warn(`  Skipping ${b1.letter}${b2.letter} from ${startPos}: could not build all 8 steps`);
        continue;
      }

      const t1 = TYPES[b1.letter] || 0;
      const t2 = TYPES[b2.letter] || 0;
      const handPath = `${TYPE_NAMES[t1]}+${TYPE_NAMES[t2]}`;
      const familyId = handPath.toLowerCase().replace(/\s+/g, "-");
      const seed = `${b1.letter}${b2.letter}`;
      const suffix = motionSuffix(b1, b2);

      results.push({
        seed,
        seqId: `${startPos}-${seed}-${suffix}`,
        word: seed.repeat(4),
        letter1: b1.letter,
        letter2: b2.letter,
        t1,
        t2,
        handPath,
        familyId,
        startPos,
        midPos: b1.endPos,
        endPos: b2.endPos,
        steps,
        startPositionData: buildStartPosition(b1),
      });
    }
  }

  return results;
}

// --- Main ---
async function main() {
  const starts = ["alpha1", "beta5", "gamma11"];
  const allResults = [];

  for (const start of starts) {
    const results = enumerateLoops(start);
    console.log(`  ${start}: ${results.length} sequences`);
    allResults.push(...results);
  }

  console.log(`\nEnumerated ${allResults.length} sequences total`);

  // Group by family
  const familyMap = {};
  for (const r of allResults) {
    if (!familyMap[r.familyId]) {
      familyMap[r.familyId] = {
        id: r.familyId,
        label: r.handPath,
        typeCombo: `Type ${r.t1} + Type ${r.t2}`,
        sequences: [],
      };
    }
    familyMap[r.familyId].sequences.push(r);
  }

  // Sort families by type combo
  const sortedFamilies = Object.values(familyMap).sort((a, b) => {
    const aKey = a.sequences[0].t1 * 10 + a.sequences[0].t2;
    const bKey = b.sequences[0].t1 * 10 + b.sequences[0].t2;
    return aKey - bKey;
  });

  console.log(`Organized into ${sortedFamilies.length} families:`);
  for (const f of sortedFamilies) {
    console.log(`  ${f.label} (${f.typeCombo}): ${f.sequences.length} sequences`);
  }

  // Delete old sequences first (clean slate)
  const DECK_ID = "l1-quartered-loop";
  const oldSeqsRef = db.collection(`decks/${DECK_ID}/sequences`);
  const oldSnap = await oldSeqsRef.get();
  if (!oldSnap.empty) {
    console.log(`\nDeleting ${oldSnap.size} old sequence docs...`);
    const deleteBatch = db.batch();
    for (const doc of oldSnap.docs) {
      deleteBatch.delete(doc.ref);
    }
    await deleteBatch.commit();
    console.log("Old docs deleted.");
  }

  // Write new sequences (split into batches of 450 to stay under 500 limit)
  const familiesMeta = [];
  let written = 0;
  let currentBatch = db.batch();
  let batchCount = 0;

  for (const family of sortedFamilies) {
    const sequenceIds = [];

    for (const r of family.sequences) {
      sequenceIds.push(r.seqId);

      const seqRef = db.doc(`decks/${DECK_ID}/sequences/${r.seqId}`);

      currentBatch.set(seqRef, {
        id: r.seqId,
        name: r.word,
        word: r.word,
        gridMode: "diamond",
        isCircular: true,
        loopType: "strict_rotated",
        sequenceLength: 8,
        level: 1,
        isFavorite: false,
        tags: ["l1-deck", family.id],
        thumbnails: [],
        steps: r.steps,
        startPosition: r.startPositionData,
        metadata: {
          deckId: DECK_ID,
          familyId: family.id,
          familyLabel: family.label,
          startPosition: r.startPos,
          seed: r.seed,
          letter1: r.letter1,
          letter2: r.letter2,
        },
        author: "TKA System",
        notes: `${family.label} from ${r.startPos}`,
      });

      written++;
      batchCount++;

      // Firestore batch limit is 500
      if (batchCount >= 450) {
        console.log(`  Committing batch (${batchCount} ops)...`);
        await currentBatch.commit();
        currentBatch = db.batch();
        batchCount = 0;
      }
    }

    familiesMeta.push({
      id: family.id,
      label: family.label,
      typeCombo: family.typeCombo,
      sequenceIds: [...new Set(sequenceIds)], // deduplicate just in case
    });
  }

  // Write deck metadata in the final batch
  const deckRef = db.doc(`decks/${DECK_ID}`);
  currentBatch.set(deckRef, {
    id: DECK_ID,
    name: "Level 1: Quartered Rotated LOOP",
    description:
      "All valid 8-letter sequences on the diamond grid with continuous rotation. " +
      "Each sequence is a 2-beat seed rotated through 4 quarters. " +
      "64 sequences per starting position (alpha1, beta5, gamma11), " +
      "organized into hand-path families.",
    families: familiesMeta,
    totalSequences: allResults.length,
    gridMode: "diamond",
    level: 1,
  });
  batchCount++;

  console.log(`\nCommitting final batch (${batchCount} ops)...`);
  await currentBatch.commit();
  console.log("Done! Deck seeded successfully.");

  // Summary
  console.log(`\n--- Summary ---`);
  console.log(`Deck: ${DECK_ID}`);
  console.log(`Total sequences: ${allResults.length}`);
  console.log(`Families: ${sortedFamilies.length}`);
  console.log(`Steps per sequence: 8`);
  console.log(`Firestore path: decks/${DECK_ID}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
