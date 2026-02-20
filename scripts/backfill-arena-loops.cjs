/**
 * Backfill Arena Loop Data
 *
 * Reads all publicSequences docs from Firestore, follows each sourceRef to
 * get the full sequence with steps/motions, detects circularity and LOOP type,
 * and writes { isCircular, loopType } back to the publicSequences doc.
 *
 * Detection logic is ported from auto-label-loops.cjs (beat-pair comparison).
 *
 * Usage:
 *   node scripts/backfill-arena-loops.cjs              # Dry run
 *   node scripts/backfill-arena-loops.cjs --commit      # Write to Firestore
 *   node scripts/backfill-arena-loops.cjs --force        # Re-detect even if loopType already set
 */

const admin = require("firebase-admin");
const path = require("path");

// ============================================================================
// Firebase Admin Setup
// ============================================================================

const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
let db;

try {
  const serviceAccount = require(serviceAccountPath);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  db = admin.firestore();
} catch (error) {
  console.error("Failed to initialize Firebase:", error.message);
  process.exit(1);
}

// ============================================================================
// Position & Transformation Maps (from auto-label-loops.cjs)
// ============================================================================

const ROTATE_180 = {
  n: "s", s: "n", e: "w", w: "e",
  ne: "sw", sw: "ne", nw: "se", se: "nw",
};

const ROTATE_90_CCW = {
  n: "w", w: "s", s: "e", e: "n",
  ne: "nw", nw: "sw", sw: "se", se: "ne",
};

const ROTATE_90_CW = {
  n: "e", e: "s", s: "w", w: "n",
  ne: "se", se: "sw", sw: "nw", nw: "ne",
};

const ROTATE_270_CCW = {
  n: "e", e: "s", s: "w", w: "n",
  ne: "se", se: "sw", sw: "nw", nw: "ne",
};

const MIRROR_VERTICAL = {
  n: "n", s: "s", e: "w", w: "e",
  ne: "nw", nw: "ne", se: "sw", sw: "se",
};

const FLIP_HORIZONTAL = {
  n: "s", s: "n", e: "e", w: "w",
  ne: "se", se: "ne", nw: "sw", sw: "nw",
};

function invertMotionType(type) {
  if (type === "pro") return "anti";
  if (type === "anti") return "pro";
  return type;
}

// ============================================================================
// Firestore → Detection Format Conversion
// ============================================================================

/**
 * Extract beats from Firestore sequence document (sourceRef format).
 * Maps motions.blue.startLocation → blue.startLoc etc.
 */
function extractBeatsFromFirestore(sequenceData) {
  const steps = sequenceData.steps;
  if (!steps || !Array.isArray(steps)) return [];

  return steps
    .filter((s) => s.stepNumber >= 1)
    .map((s) => {
      const blueMotion = s.motions?.blue;
      const redMotion = s.motions?.red;

      return {
        beatNumber: s.stepNumber,
        letter: s.letter || null,
        startPos: s.startPosition || null,
        endPos: s.endPosition || null,
        blue: {
          startLoc: blueMotion?.startLocation?.toLowerCase(),
          endLoc: blueMotion?.endLocation?.toLowerCase(),
          motionType: blueMotion?.motionType?.toLowerCase(),
        },
        red: {
          startLoc: redMotion?.startLocation?.toLowerCase(),
          endLoc: redMotion?.endLocation?.toLowerCase(),
          motionType: redMotion?.motionType?.toLowerCase(),
        },
      };
    });
}

/**
 * Check circularity by comparing start position to last step end position.
 * Works with Firestore sequence format (steps array with startPosition/endPosition).
 */
function isCircularFromFirestore(sequenceData) {
  const steps = sequenceData.steps;
  if (!steps || !Array.isArray(steps) || steps.length < 1) return false;

  // Get start position from the sequence's startPosition or startingPosition
  const startPosData = sequenceData.startPosition || sequenceData.startingPosition;
  const startGridPos =
    startPosData?.startPosition ||
    startPosData?.gridPosition ||
    steps[0]?.startPosition;

  if (!startGridPos) return false;

  const lastStep = steps[steps.length - 1];
  if (!lastStep?.endPosition) return false;

  return startGridPos === lastStep.endPosition;
}

// ============================================================================
// Beat-Pair Comparison Functions (from auto-label-loops.cjs)
// ============================================================================

function compareBeatPair(beat1, beat2) {
  const b1Blue = beat1.blue, b1Red = beat1.red;
  const b2Blue = beat2.blue, b2Red = beat2.red;

  if (!b1Blue?.startLoc || !b2Blue?.startLoc || !b1Red?.startLoc || !b2Red?.startLoc) {
    return [];
  }

  const transformations = [];

  // Check repeated
  const isRepeated =
    b1Blue.startLoc === b2Blue.startLoc && b1Blue.endLoc === b2Blue.endLoc &&
    b1Blue.motionType === b2Blue.motionType &&
    b1Red.startLoc === b2Red.startLoc && b1Red.endLoc === b2Red.endLoc &&
    b1Red.motionType === b2Red.motionType;
  if (isRepeated) transformations.push("repeated");

  // Compound: rotation + swap position checks
  const positions180Swapped =
    ROTATE_180[b1Red.startLoc] === b2Blue.startLoc && ROTATE_180[b1Red.endLoc] === b2Blue.endLoc &&
    ROTATE_180[b1Blue.startLoc] === b2Red.startLoc && ROTATE_180[b1Blue.endLoc] === b2Red.endLoc;
  const positions90CCWSwapped =
    ROTATE_90_CCW[b1Red.startLoc] === b2Blue.startLoc && ROTATE_90_CCW[b1Red.endLoc] === b2Blue.endLoc &&
    ROTATE_90_CCW[b1Blue.startLoc] === b2Red.startLoc && ROTATE_90_CCW[b1Blue.endLoc] === b2Red.endLoc;
  const positions90CWSwapped =
    ROTATE_270_CCW[b1Red.startLoc] === b2Blue.startLoc && ROTATE_270_CCW[b1Red.endLoc] === b2Blue.endLoc &&
    ROTATE_270_CCW[b1Blue.startLoc] === b2Red.startLoc && ROTATE_270_CCW[b1Blue.endLoc] === b2Red.endLoc;

  const motionSameSwapped = b1Red.motionType === b2Blue.motionType && b1Blue.motionType === b2Red.motionType;
  const motionInvertedSwapped =
    invertMotionType(b1Red.motionType) === b2Blue.motionType &&
    invertMotionType(b1Blue.motionType) === b2Red.motionType;

  if (positions180Swapped && motionSameSwapped) transformations.push("rotated_180_swapped");
  if (positions180Swapped && motionInvertedSwapped) transformations.push("rotated_180_swapped_inverted");
  if (positions90CCWSwapped && motionSameSwapped) transformations.push("rotated_90_ccw_swapped");
  if (positions90CCWSwapped && motionInvertedSwapped) transformations.push("rotated_90_ccw_swapped_inverted");
  if (positions90CWSwapped && motionSameSwapped) transformations.push("rotated_90_cw_swapped");
  if (positions90CWSwapped && motionInvertedSwapped) transformations.push("rotated_90_cw_swapped_inverted");

  // Mirrored + swapped
  const mirroredSwapped =
    MIRROR_VERTICAL[b1Red.startLoc] === b2Blue.startLoc && MIRROR_VERTICAL[b1Red.endLoc] === b2Blue.endLoc &&
    b1Red.motionType === b2Blue.motionType &&
    MIRROR_VERTICAL[b1Blue.startLoc] === b2Red.startLoc && MIRROR_VERTICAL[b1Blue.endLoc] === b2Red.endLoc &&
    b1Blue.motionType === b2Red.motionType;
  if (mirroredSwapped) transformations.push("mirrored_swapped");

  // Simple position transforms (same colors)
  const positions90CCW =
    ROTATE_90_CCW[b1Blue.startLoc] === b2Blue.startLoc && ROTATE_90_CCW[b1Blue.endLoc] === b2Blue.endLoc &&
    ROTATE_90_CCW[b1Red.startLoc] === b2Red.startLoc && ROTATE_90_CCW[b1Red.endLoc] === b2Red.endLoc;
  const positions180 =
    ROTATE_180[b1Blue.startLoc] === b2Blue.startLoc && ROTATE_180[b1Blue.endLoc] === b2Blue.endLoc &&
    ROTATE_180[b1Red.startLoc] === b2Red.startLoc && ROTATE_180[b1Red.endLoc] === b2Red.endLoc;
  const positions90CW =
    ROTATE_270_CCW[b1Blue.startLoc] === b2Blue.startLoc && ROTATE_270_CCW[b1Blue.endLoc] === b2Blue.endLoc &&
    ROTATE_270_CCW[b1Red.startLoc] === b2Red.startLoc && ROTATE_270_CCW[b1Red.endLoc] === b2Red.endLoc;

  const motionSameColors = b1Blue.motionType === b2Blue.motionType && b1Red.motionType === b2Red.motionType;
  const motionInvertedSameColors =
    invertMotionType(b1Blue.motionType) === b2Blue.motionType &&
    invertMotionType(b1Red.motionType) === b2Red.motionType;

  if (positions90CCW && motionSameColors) transformations.push("rotated_90_ccw");
  if (positions90CCW && motionInvertedSameColors) transformations.push("rotated_90_ccw_inverted");
  if (positions180 && motionSameColors) transformations.push("rotated_180");
  if (positions180 && motionInvertedSameColors) transformations.push("rotated_180_inverted");
  if (positions90CW && motionSameColors) transformations.push("rotated_90_cw");
  if (positions90CW && motionInvertedSameColors) transformations.push("rotated_90_cw_inverted");

  // Vertical mirror
  if (
    MIRROR_VERTICAL[b1Blue.startLoc] === b2Blue.startLoc && MIRROR_VERTICAL[b1Blue.endLoc] === b2Blue.endLoc &&
    MIRROR_VERTICAL[b1Red.startLoc] === b2Red.startLoc && MIRROR_VERTICAL[b1Red.endLoc] === b2Red.endLoc
  ) transformations.push("mirrored");

  // Horizontal flip
  const positionsFlipped =
    FLIP_HORIZONTAL[b1Blue.startLoc] === b2Blue.startLoc && FLIP_HORIZONTAL[b1Blue.endLoc] === b2Blue.endLoc &&
    FLIP_HORIZONTAL[b1Red.startLoc] === b2Red.startLoc && FLIP_HORIZONTAL[b1Red.endLoc] === b2Red.endLoc;
  if (positionsFlipped && motionSameColors) transformations.push("flipped");
  if (positionsFlipped && motionInvertedSameColors) transformations.push("flipped_inverted");

  // Color swap (no position change)
  const colorsSwapped =
    b1Blue.startLoc === b2Red.startLoc && b1Blue.endLoc === b2Red.endLoc &&
    b1Red.startLoc === b2Blue.startLoc && b1Red.endLoc === b2Blue.endLoc &&
    b1Blue.motionType === b2Red.motionType && b1Red.motionType === b2Blue.motionType;
  if (colorsSwapped && !transformations.includes("swapped")) transformations.push("swapped");

  // Motion inversion (same positions)
  const motionInverted =
    b1Blue.startLoc === b2Blue.startLoc && b1Blue.endLoc === b2Blue.endLoc &&
    b1Red.startLoc === b2Red.startLoc && b1Red.endLoc === b2Red.endLoc &&
    invertMotionType(b1Blue.motionType) === b2Blue.motionType &&
    invertMotionType(b1Red.motionType) === b2Red.motionType;
  if (motionInverted) transformations.push("inverted");

  return transformations;
}

// ============================================================================
// LOOP Type Detection (ported from auto-label-loops.cjs)
// ============================================================================

const TRANSFORMATION_PRIORITY = [
  "rotated_90_cw", "rotated_90_ccw", "rotated_180",
  "rotated_90_cw_inverted", "rotated_90_ccw_inverted", "rotated_180_inverted",
  "rotated_90_cw_swapped", "rotated_90_ccw_swapped", "rotated_180_swapped",
  "rotated_90_cw_swapped_inverted", "rotated_90_ccw_swapped_inverted", "rotated_180_swapped_inverted",
  "flipped_inverted", "mirrored_swapped",
  "mirrored", "flipped", "swapped", "inverted", "repeated",
];

function generateHalvedBeatPairs(beats) {
  if (beats.length < 2 || beats.length % 2 !== 0) return [];
  const halfLength = beats.length / 2;
  const pairs = [];
  for (let i = 0; i < halfLength; i++) {
    const raw = compareBeatPair(beats[i], beats[halfLength + i]);
    pairs.push({ keyBeat: beats[i].beatNumber, rawTransformations: raw });
  }
  return pairs;
}

function generateQuarteredBeatPairs(beats) {
  if (beats.length < 4 || beats.length % 4 !== 0) return [];
  const quarterLength = beats.length / 4;
  const pairs = [];
  for (let i = 0; i < quarterLength * 3; i++) {
    const beat1 = beats[i];
    const beat2 = beats[(i + quarterLength) % beats.length];
    const raw = compareBeatPair(beat1, beat2);
    pairs.push({ keyBeat: beat1.beatNumber, rawTransformations: raw });
  }
  return pairs;
}

function findAllCommonTransformations(beatPairs) {
  if (beatPairs.length === 0) return [];
  const allSets = beatPairs.map((p) => new Set(p.rawTransformations || []));
  const common = [...allSets[0]].filter((t) => allSets.every((s) => s.has(t)));
  return common.sort((a, b) => {
    const pa = TRANSFORMATION_PRIORITY.indexOf(a);
    const pb = TRANSFORMATION_PRIORITY.indexOf(b);
    return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
  });
}

function deriveComponentsFromPattern(pattern) {
  const components = [];
  const upper = pattern.toUpperCase();
  if (upper.includes("INVERTED")) components.push("inverted");
  if (upper.includes("ROTATED")) components.push("rotated");
  if (upper.includes("SWAPPED") || upper.match(/\bSW\b/) || upper.match(/\bSWAP\b/)) {
    components.push("swapped");
  }
  if (upper.includes("MIRRORED") || upper.includes("MIRROR") || upper.match(/\bMIR\b/)) {
    components.push("mirrored");
  }
  if (upper.includes("FLIPPED") || upper.includes("FLIP")) {
    components.push("flipped");
  }
  if (upper.includes("REPEATED") || upper === "SAME") {
    components.push("repeated");
  }
  return components;
}

/**
 * Detect LOOP type from extracted beats.
 * Returns { loopType: string | null, components: string[] }
 */
function detectLOOPType(beats) {
  if (beats.length < 2 || beats.length % 2 !== 0) {
    return { loopType: null, components: [] };
  }

  // Check quartered patterns first (90-degree rotations)
  if (beats.length >= 4 && beats.length % 4 === 0) {
    const quarteredPairs = generateQuarteredBeatPairs(beats);
    const allQuarteredCommon = findAllCommonTransformations(quarteredPairs);
    const rotation90Patterns = allQuarteredCommon.filter(
      (t) => t.includes("rotated_90") || t.includes("90_ccw") || t.includes("90_cw")
    );

    if (rotation90Patterns.length > 0) {
      // Also check halved 180 pattern
      const halvedPairs = generateHalvedBeatPairs(beats);
      const allHalvedCommon = findAllCommonTransformations(halvedPairs);
      const halved180 = allHalvedCommon.filter(
        (t) => t.includes("rotated_180") || t === "rotated"
      );

      const primaryPattern = halved180.length > 0 ? halved180[0] : rotation90Patterns[0];
      const components = deriveComponentsFromPattern(primaryPattern);
      if (components.length > 0) {
        const loopType = components.sort().join("_");
        return { loopType, components };
      }
    }
  }

  // Halved patterns
  const halvedPairs = generateHalvedBeatPairs(beats);
  const allHalvedCommon = findAllCommonTransformations(halvedPairs);
  const commonTransformation = allHalvedCommon.length > 0 ? allHalvedCommon[0] : null;

  if (commonTransformation) {
    const components = deriveComponentsFromPattern(commonTransformation);
    if (components.length > 0) {
      const loopType = components.sort().join("_");
      return { loopType, components };
    }
  }

  return { loopType: null, components: [] };
}

// ============================================================================
// Main Execution
// ============================================================================

const PAGE_SIZE = 50;
const SOURCE_REF_DELAY_MS = 200; // Delay between sourceRef reads

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const commitMode = args.includes("--commit");
  const forceMode = args.includes("--force");

  console.log("=".repeat(70));
  console.log(commitMode
    ? forceMode
      ? "BACKFILL ARENA LOOPS (COMMIT + FORCE)"
      : "BACKFILL ARENA LOOPS (COMMIT)"
    : "BACKFILL ARENA LOOPS (DRY RUN)"
  );
  console.log("=".repeat(70));
  console.log();

  const stats = {
    total: 0,
    skipped: 0,         // Already has loopType (without --force)
    sourceRefMissing: 0, // No sourceRef on doc
    sourceNotFound: 0,   // sourceRef doc doesn't exist
    noSteps: 0,          // Source doc has no steps
    circular: 0,
    circularWithType: 0,
    circularNoType: 0,
    nonCircular: 0,
    failed: 0,
  };

  const typeBreakdown = {};
  let lastDoc = null;
  let pageNum = 0;
  const pendingWrites = []; // { docId, isCircular, loopType }

  while (true) {
    pageNum++;
    let query = db.collection("publicSequences")
      .orderBy("__name__")
      .limit(PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    console.log(`Page ${pageNum}: ${snapshot.docs.length} docs`);

    for (const pubDoc of snapshot.docs) {
      stats.total++;
      const pubData = pubDoc.data();

      // Skip if already has loopType (unless --force)
      if (!forceMode && pubData.loopType) {
        stats.skipped++;
        continue;
      }

      // Need sourceRef to get full sequence data
      const sourceRef = pubData.sourceRef;
      if (!sourceRef) {
        stats.sourceRefMissing++;
        continue;
      }

      // Follow sourceRef to get full sequence with steps/motions
      let sourceData;
      try {
        const sourceDoc = await db.doc(sourceRef).get();
        if (!sourceDoc.exists) {
          stats.sourceNotFound++;
          continue;
        }
        sourceData = sourceDoc.data();
      } catch (error) {
        console.warn(`  Failed to read sourceRef "${sourceRef}": ${error.message}`);
        stats.failed++;
        continue;
      }

      // Check if source has steps
      if (!sourceData.steps || !Array.isArray(sourceData.steps) || sourceData.steps.length === 0) {
        stats.noSteps++;
        continue;
      }

      // Check circularity
      const circular = isCircularFromFirestore(sourceData);
      if (!circular) {
        stats.nonCircular++;
        pendingWrites.push({ docId: pubDoc.id, isCircular: false, loopType: null });
        continue;
      }

      stats.circular++;

      // Extract beats and detect LOOP type
      const beats = extractBeatsFromFirestore(sourceData);
      const detection = detectLOOPType(beats);

      if (detection.loopType) {
        stats.circularWithType++;
        const key = detection.loopType;
        typeBreakdown[key] = (typeBreakdown[key] || 0) + 1;
      } else {
        stats.circularNoType++;
      }

      pendingWrites.push({
        docId: pubDoc.id,
        isCircular: true,
        loopType: detection.loopType,
      });

      // Throttle sourceRef reads
      await sleep(SOURCE_REF_DELAY_MS);
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    if (snapshot.docs.length < PAGE_SIZE) break;

    // Brief pause between pages
    await sleep(1000);
  }

  // Print summary
  console.log();
  console.log("=".repeat(70));
  console.log("DETECTION SUMMARY");
  console.log("=".repeat(70));
  console.log(`  Total docs:              ${stats.total}`);
  console.log(`  Skipped (already typed):  ${stats.skipped}`);
  console.log(`  Source ref missing:       ${stats.sourceRefMissing}`);
  console.log(`  Source not found:         ${stats.sourceNotFound}`);
  console.log(`  No steps in source:       ${stats.noSteps}`);
  console.log(`  Failed:                   ${stats.failed}`);
  console.log(`  Non-circular:             ${stats.nonCircular}`);
  console.log(`  Circular (total):         ${stats.circular}`);
  console.log(`    With detected type:     ${stats.circularWithType}`);
  console.log(`    No type (accidental):   ${stats.circularNoType}`);
  console.log();

  if (Object.keys(typeBreakdown).length > 0) {
    console.log("LOOP Type Breakdown:");
    Object.entries(typeBreakdown)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`    ${type}: ${count}`);
      });
    console.log();
  }

  console.log(`Pending writes: ${pendingWrites.length}`);

  // Apply writes
  if (commitMode && pendingWrites.length > 0) {
    console.log();
    console.log("Writing to Firestore...");

    const BATCH_LIMIT = 500;
    for (let i = 0; i < pendingWrites.length; i += BATCH_LIMIT) {
      const chunk = pendingWrites.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();

      for (const write of chunk) {
        const ref = db.collection("publicSequences").doc(write.docId);
        batch.update(ref, {
          isCircular: write.isCircular,
          loopType: write.loopType,
        });
      }

      await batch.commit();
      console.log(`  Committed batch ${Math.floor(i / BATCH_LIMIT) + 1}: ${chunk.length} docs`);
    }

    console.log(`\nDone. Updated ${pendingWrites.length} publicSequences docs.`);
  } else if (!commitMode) {
    console.log("\nDry run complete. Run with --commit to write changes.");
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
