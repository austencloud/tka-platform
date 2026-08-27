/**
 * Beat-Pair Graph LOOP Detection
 *
 * New approach: Build a graph of beat relationships, analyze patterns bottom-up
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// Initialize Firebase Admin
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

// Position transformation maps
const ROTATE_90_CCW = { n: "w", e: "n", s: "e", w: "s" };
const ROTATE_180 = { n: "s", e: "w", s: "n", w: "e" };
const ROTATE_270_CCW = { n: "e", e: "s", s: "w", w: "n" };
const MIRROR_VERTICAL = { n: "n", e: "w", s: "s", w: "e" };
const FLIP_HORIZONTAL = { n: "s", e: "e", s: "n", w: "w" };

function invertMotionType(motionType) {
  if (motionType === "pro") return "anti";
  if (motionType === "anti") return "pro";
  return motionType;
}

function extractBeats(sequence) {
  const raw = sequence.fullMetadata?.sequence;
  if (!raw) return [];
  return raw
    .filter((b) => b.beat >= 1)
    .map((b) => ({
      beatNumber: b.beat,
      letter: b.letter,
      startPos: b.startPos,
      endPos: b.endPos,
      blue: {
        startLoc: b.blueAttributes?.startLoc?.toLowerCase(),
        endLoc: b.blueAttributes?.endLoc?.toLowerCase(),
        startOri: b.blueAttributes?.startOri?.toLowerCase(),
        endOri: b.blueAttributes?.endOri?.toLowerCase(),
        motionType: b.blueAttributes?.motionType?.toLowerCase(),
      },
      red: {
        startLoc: b.redAttributes?.startLoc?.toLowerCase(),
        endLoc: b.redAttributes?.endLoc?.toLowerCase(),
        startOri: b.redAttributes?.startOri?.toLowerCase(),
        endOri: b.redAttributes?.endOri?.toLowerCase(),
        motionType: b.redAttributes?.motionType?.toLowerCase(),
      },
    }));
}

/**
 * Compare two beats and identify ALL transformations between them
 * Returns array of transformation types
 */
function compareBeatPair(beat1, beat2) {
  const b1Blue = beat1.blue,
    b1Red = beat1.red;
  const b2Blue = beat2.blue,
    b2Red = beat2.red;

  if (
    !b1Blue?.startLoc ||
    !b2Blue?.startLoc ||
    !b1Red?.startLoc ||
    !b2Red?.startLoc
  ) {
    return [];
  }

  const transformations = [];

  // Check if beats are identical (repeated)
  if (
    b1Blue.startLoc === b2Blue.startLoc &&
    b1Blue.endLoc === b2Blue.endLoc &&
    b1Blue.motionType === b2Blue.motionType &&
    b1Red.startLoc === b2Red.startLoc &&
    b1Red.endLoc === b2Red.endLoc &&
    b1Red.motionType === b2Red.motionType
  ) {
    transformations.push("repeated");
    return transformations; // Early return - if repeated, no other transformations apply
  }

  // Check position transformations
  let positionTransform = null;

  // 90° rotation
  if (
    ROTATE_90_CCW[b1Blue.startLoc] === b2Blue.startLoc &&
    ROTATE_90_CCW[b1Blue.endLoc] === b2Blue.endLoc &&
    ROTATE_90_CCW[b1Red.startLoc] === b2Red.startLoc &&
    ROTATE_90_CCW[b1Red.endLoc] === b2Red.endLoc
  ) {
    positionTransform = "rotated_90";
  }
  // 180° rotation
  else if (
    ROTATE_180[b1Blue.startLoc] === b2Blue.startLoc &&
    ROTATE_180[b1Blue.endLoc] === b2Blue.endLoc &&
    ROTATE_180[b1Red.startLoc] === b2Red.startLoc &&
    ROTATE_180[b1Red.endLoc] === b2Red.endLoc
  ) {
    positionTransform = "rotated_180";
  }
  // 270° rotation
  else if (
    ROTATE_270_CCW[b1Blue.startLoc] === b2Blue.startLoc &&
    ROTATE_270_CCW[b1Blue.endLoc] === b2Blue.endLoc &&
    ROTATE_270_CCW[b1Red.startLoc] === b2Red.startLoc &&
    ROTATE_270_CCW[b1Red.endLoc] === b2Red.endLoc
  ) {
    positionTransform = "rotated_270";
  }
  // Vertical mirror
  else if (
    MIRROR_VERTICAL[b1Blue.startLoc] === b2Blue.startLoc &&
    MIRROR_VERTICAL[b1Blue.endLoc] === b2Blue.endLoc &&
    MIRROR_VERTICAL[b1Red.startLoc] === b2Red.startLoc &&
    MIRROR_VERTICAL[b1Red.endLoc] === b2Red.endLoc
  ) {
    positionTransform = "mirrored";
  }
  // Horizontal flip
  else if (
    FLIP_HORIZONTAL[b1Blue.startLoc] === b2Blue.startLoc &&
    FLIP_HORIZONTAL[b1Blue.endLoc] === b2Blue.endLoc &&
    FLIP_HORIZONTAL[b1Red.startLoc] === b2Red.startLoc &&
    FLIP_HORIZONTAL[b1Red.endLoc] === b2Red.endLoc
  ) {
    positionTransform = "flipped";
  }

  // Check if colors are swapped
  const colorsSwapped =
    b1Blue.startLoc === b2Red.startLoc &&
    b1Blue.endLoc === b2Red.endLoc &&
    b1Red.startLoc === b2Blue.startLoc &&
    b1Red.endLoc === b2Blue.endLoc;

  // Check if motion types are inverted
  const motionInverted =
    invertMotionType(b1Blue.motionType) === b2Blue.motionType &&
    invertMotionType(b1Red.motionType) === b2Red.motionType;

  // Build transformation description
  if (positionTransform) {
    transformations.push(positionTransform);
  }
  if (colorsSwapped) {
    transformations.push("swapped");
  }
  if (motionInverted) {
    transformations.push("inverted");
  }

  return transformations;
}

function buildBeatPairGraph(beats) {
  const graph = {};

  for (let i = 0; i < beats.length; i++) {
    const beat1 = beats[i];
    graph[beat1.beatNumber] = {};

    for (let j = 0; j < beats.length; j++) {
      if (i === j) continue;

      const beat2 = beats[j];
      const transformations = compareBeatPair(beat1, beat2);

      if (transformations.length > 0) {
        graph[beat1.beatNumber][beat2.beatNumber] = transformations;
      }
    }
  }

  return graph;
}

/**
 * Group beats by letter
 */
function groupBeatsByLetter(beats) {
  const groups = {};

  for (const beat of beats) {
    if (!groups[beat.letter]) {
      groups[beat.letter] = [];
    }
    groups[beat.letter].push(beat.beatNumber);
  }

  return groups;
}

/**
 * Analyze transformation pattern for a group of beats (same letter)
 */
function analyzeLetterGroupPattern(beatNumbers, graph) {
  if (beatNumbers.length < 2) {
    return { pattern: "single", transformations: [] };
  }

  // Check if all beats in this group follow the same transformation to the next
  const transformationSequence = [];

  for (let i = 0; i < beatNumbers.length - 1; i++) {
    const from = beatNumbers[i];
    const to = beatNumbers[i + 1];

    const transforms = graph[from]?.[to] || [];
    transformationSequence.push({
      from,
      to,
      transformations: transforms,
    });
  }

  // Also check last to first (circular)
  const lastToFirst =
    graph[beatNumbers[beatNumbers.length - 1]]?.[beatNumbers[0]] || [];
  transformationSequence.push({
    from: beatNumbers[beatNumbers.length - 1],
    to: beatNumbers[0],
    transformations: lastToFirst,
  });

  return {
    pattern: "cycle",
    transformationSequence,
  };
}

/**
 * Main detection function using beat-pair graph approach
 */
function detectLOOPWithBeatPairs(sequence) {
  const beats = extractBeats(sequence);

  if (beats.length < 2) {
    return { loopType: null, components: [], analysis: "too_short" };
  }

  const graph = buildBeatPairGraph(beats);

  // Group beats by letter
  const letterGroups = groupBeatsByLetter(beats);

  // Analyze each letter group's pattern
  const letterPatterns = {};
  for (const [letter, beatNumbers] of Object.entries(letterGroups)) {
    letterPatterns[letter] = analyzeLetterGroupPattern(beatNumbers, graph);
  }

  // Check if different letters have different patterns (= modular)
  const uniquePatterns = new Set();
  for (const [letter, analysis] of Object.entries(letterPatterns)) {
    const patternSig = JSON.stringify(
      analysis.transformationSequence.map((t) =>
        t.transformations.sort().join("+")
      )
    );
    uniquePatterns.add(patternSig);
  }

  return {
    graph,
    letterGroups,
    letterPatterns,
    isModular: uniquePatterns.size > 1,
    uniquePatternCount: uniquePatterns.size,
  };
}

/**
 * Test with a specific sequence
 */
function testSequence(sequence, name) {
  console.log("=".repeat(70));
  console.log(`BEAT-PAIR GRAPH DETECTION: ${name}`);
  console.log("=".repeat(70));
  console.log();

  const result = detectLOOPWithBeatPairs(sequence);

  console.log("Letter Groups:");
  console.log(JSON.stringify(result.letterGroups, null, 2));
  console.log();

  console.log("Letter Patterns:");
  for (const [letter, pattern] of Object.entries(result.letterPatterns)) {
    console.log(`\n${letter} pattern:`);
    for (const step of pattern.transformationSequence) {
      const transforms = step.transformations.join(" + ") || "none";
      console.log(`  Beat ${step.from} → Beat ${step.to}: ${transforms}`);
    }
  }

  console.log();
  console.log(`Is Modular: ${result.isModular}`);
  console.log(`Unique Pattern Count: ${result.uniquePatternCount}`);
  console.log();
}

/**
 * Test with multiple sequences
 */
async function runTests() {
  const sequenceIndexPath = path.join(
    __dirname,
    "..",
    "static",
    "data",
    "sequence-index.json"
  );
  const sequenceIndex = JSON.parse(fs.readFileSync(sequenceIndexPath, "utf8"));

  const testWords = ["ABC", "AAKE", "AABB", "AKE", "BBKE", "ALFALGGF"];

  for (const word of testWords) {
    const sequence = sequenceIndex.sequences.find((s) => s.word === word);
    if (sequence) {
      testSequence(sequence, word);
    } else {
      console.log(`Sequence "${word}" not found\n`);
    }
  }

  process.exit(0);
}

runTests();
