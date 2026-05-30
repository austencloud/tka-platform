/**
 * Seed the Level 1 VTG Motions Deck to Firestore
 *
 * 19 VTG base motions as quartered and halved rotated LOOPs.
 * Each card represents one fundamental VTG motion category.
 *
 * Same-direction motions (10): 1-beat seed → quartered LOOP → 4-beat sequence
 * Opposite-direction motions (9): 2-beat seed → halved LOOP → 4-beat sequence
 *
 * Usage: npx tsx scripts/seed-vtg-deck.ts [--dry-run]
 * Requires: serviceAccountKey.json in project root
 */

import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";

import {
  executeLOOP,
  type PictographData,
  type MotionData as McpMotionData,
} from "../packages/sequence-engine/src/loop/execution/LOOPExecutor.js";
import { LOOPType, Period } from "../packages/sequence-engine/src/loop/loop-types.js";
import {
  calculateOrientations,
  calculateEndOrientation,
} from "../packages/sequence-engine/src/core/orientation/OrientationCalculator.js";
import type { SequenceStep } from "../packages/sequence-engine/src/core/types/sequence-engine-types.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.resolve(
  PROJECT_ROOT,
  "static/data/pictographs/DiamondPictographDataframe.csv"
);
const SERVICE_ACCOUNT_PATH = path.resolve(PROJECT_ROOT, "serviceAccountKey.json");
const DECK_ID = "l1-vtg-motions";
const DRY_RUN = process.argv.includes("--dry-run");

// ============================================================================
// VTG MOTION DEFINITIONS
// ============================================================================

/**
 * Each VTG motion is defined by its seed letter(s), starting position,
 * slice size, and VTG family.
 */
/**
 * Disambiguates which CSV pictograph variant to use for one seed beat.
 * A given (letter, startPos) can have two mirror-chirality pictographs
 * (e.g. D from beta5 → alpha7 vs → alpha3), and hybrid letters (F, L)
 * have two distinct pictographs sharing the same endPos. endPos picks the
 * chirality; blueDir breaks the hybrid tie. Both are matched against the
 * canonical DiamondPictographDataframe.csv — the CSV is never reordered.
 */
interface SeedBeat {
  endPos: string;   // target endPosition for this beat
  blueDir: string;  // blue rotationDirection ("cw" | "ccw")
}

interface VTGMotionDef {
  id: number;
  seed: string[];        // 1 letter for quartered, 2 for halved
  word: string;           // Full 4-beat word (e.g., "AAAA" or "JDJD")
  vtg: string;            // VTG category label
  familyId: string;       // Family grouping ID
  startPos: string;       // Starting position
  period: Period;   // Quartered (90°) or Halved (180°)
  /**
   * Explicit per-beat variant selection for the seed. When present, each
   * seed letter is resolved to the exact CSV row matching its endPos+blueDir
   * instead of taking the first letter match. Set only where the default
   * first-match picks the wrong chirality (tog-opp DJ/EK/FL).
   */
  seedPath?: SeedBeat[];
}

const VTG_MOTIONS: VTGMotionDef[] = [
  // Same-Direction (Quartered — 1-beat seeds)
  { id: 1,  seed: ["A"],      word: "AAAA", vtg: "Split-Same",   familyId: "split-same",   startPos: "alpha1",  period: Period.QUARTERED },
  { id: 2,  seed: ["B"],      word: "BBBB", vtg: "Split-Same",   familyId: "split-same",   startPos: "alpha1",  period: Period.QUARTERED },
  { id: 3,  seed: ["C"],      word: "CCCC", vtg: "Split-Same",   familyId: "split-same",   startPos: "alpha1",  period: Period.QUARTERED },
  { id: 4,  seed: ["G"],      word: "GGGG", vtg: "Tog-Same",     familyId: "tog-same",     startPos: "beta5",   period: Period.QUARTERED },
  { id: 5,  seed: ["H"],      word: "HHHH", vtg: "Tog-Same",     familyId: "tog-same",     startPos: "beta5",   period: Period.QUARTERED },
  { id: 6,  seed: ["I"],      word: "IIII", vtg: "Tog-Same",     familyId: "tog-same",     startPos: "beta5",   period: Period.QUARTERED },
  { id: 7,  seed: ["S"],      word: "SSSS", vtg: "Quarter-Same", familyId: "quarter-same", startPos: "gamma11", period: Period.QUARTERED },
  { id: 8,  seed: ["T"],      word: "TTTT", vtg: "Quarter-Same", familyId: "quarter-same", startPos: "gamma11", period: Period.QUARTERED },
  { id: 9,  seed: ["U"],      word: "UUUU", vtg: "Quarter-Same", familyId: "quarter-same", startPos: "gamma11", period: Period.QUARTERED },
  { id: 10, seed: ["V"],      word: "VVVV", vtg: "Quarter-Same", familyId: "quarter-same", startPos: "gamma11", period: Period.QUARTERED },

  // Opposite-Direction (Halved — 2-beat seeds)
  { id: 11, seed: ["J", "D"], word: "JDJD", vtg: "Split-Opp",   familyId: "split-opp",    startPos: "alpha1",  period: Period.HALVED },
  { id: 12, seed: ["K", "E"], word: "KEKE", vtg: "Split-Opp",   familyId: "split-opp",    startPos: "alpha1",  period: Period.HALVED },
  { id: 13, seed: ["L", "F"], word: "LFLF", vtg: "Split-Opp",   familyId: "split-opp",    startPos: "alpha1",  period: Period.HALVED },
  // tog-opp: pin the natural chirality (beta5→alpha3→beta1, blue leads CW for
  // the pro/pro DJ, CCW for the anti EK/FL). Without seedPath the seeder takes
  // the first CSV match, which is the mirror chirality (beta5→alpha7).
  { id: 14, seed: ["D", "J"], word: "DJDJ", vtg: "Tog-Opp",     familyId: "tog-opp",      startPos: "beta5",   period: Period.HALVED, seedPath: [{ endPos: "alpha3", blueDir: "cw" }, { endPos: "beta1", blueDir: "cw" }] },
  { id: 15, seed: ["E", "K"], word: "EKEK", vtg: "Tog-Opp",     familyId: "tog-opp",      startPos: "beta5",   period: Period.HALVED, seedPath: [{ endPos: "alpha3", blueDir: "ccw" }, { endPos: "beta1", blueDir: "ccw" }] },
  { id: 16, seed: ["F", "L"], word: "FLFL", vtg: "Tog-Opp",     familyId: "tog-opp",      startPos: "beta5",   period: Period.HALVED, seedPath: [{ endPos: "alpha3", blueDir: "ccw" }, { endPos: "beta1", blueDir: "ccw" }] },
  { id: 17, seed: ["M", "P"], word: "MPMP", vtg: "Quarter-Opp", familyId: "quarter-opp",  startPos: "gamma11", period: Period.HALVED },
  { id: 18, seed: ["N", "Q"], word: "NQNQ", vtg: "Quarter-Opp", familyId: "quarter-opp",  startPos: "gamma11", period: Period.HALVED },
  { id: 19, seed: ["O", "R"], word: "OROR", vtg: "Quarter-Opp", familyId: "quarter-opp",  startPos: "gamma11", period: Period.HALVED },
];

// ============================================================================
// VTG FAMILY DEFINITIONS (for Firestore deck metadata)
// ============================================================================

const VTG_FAMILIES = [
  { id: "split-same",   label: "Split-Same",   typeCombo: "Quartered" },
  { id: "tog-same",     label: "Tog-Same",     typeCombo: "Quartered" },
  { id: "quarter-same", label: "Quarter-Same", typeCombo: "Quartered" },
  { id: "split-opp",    label: "Split-Opp",    typeCombo: "Halved" },
  { id: "tog-opp",      label: "Tog-Opp",      typeCombo: "Halved" },
  { id: "quarter-opp",  label: "Quarter-Opp",  typeCombo: "Halved" },
];

// ============================================================================
// CSV LOADING (shared with seed-l1-deck.ts)
// ============================================================================

function loadDiamondDataframe(): PictographData[] {
  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const pictographs: PictographData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    if (!row.letter || row.letter.trim() === "") continue;

    const blueOrientations = calculateOrientations({
      motionType: row.blueMotionType,
      turns: 0,
      rotationDirection: row.blueRotationDirection || "cw",
      startLocation: row.blueStartLocation,
      endLocation: row.blueEndLocation,
      startOrientation: "in",
    });

    const redOrientations = calculateOrientations({
      motionType: row.redMotionType,
      turns: 0,
      rotationDirection: row.redRotationDirection || "cw",
      startLocation: row.redStartLocation,
      endLocation: row.redEndLocation,
      startOrientation: "in",
    });

    pictographs.push({
      letter: row.letter,
      startPosition: row.startPosition,
      endPosition: row.endPosition,
      timing: row.timing,
      direction: row.direction,
      blueMotion: {
        color: "blue",
        startLocation: row.blueStartLocation,
        endLocation: row.blueEndLocation,
        motionType: row.blueMotionType,
        rotationDirection: row.blueRotationDirection,
        startOrientation: blueOrientations.startOrientation,
        endOrientation: blueOrientations.endOrientation,
      },
      redMotion: {
        color: "red",
        startLocation: row.redStartLocation,
        endLocation: row.redEndLocation,
        motionType: row.redMotionType,
        rotationDirection: row.redRotationDirection,
        startOrientation: redOrientations.startOrientation,
        endOrientation: redOrientations.endOrientation,
      },
    });
  }

  return pictographs;
}

// ============================================================================
// ADJACENCY & SEED LOOKUP
// ============================================================================

function buildAdjacencyMap(
  pictographs: PictographData[]
): Map<string, PictographData[]> {
  const adj = new Map<string, PictographData[]>();
  for (const p of pictographs) {
    const list = adj.get(p.startPosition) ?? [];
    list.push(p);
    adj.set(p.startPosition, list);
  }
  return adj;
}

/**
 * Find a specific pictograph edge by letter and starting position.
 * For the VTG deck, each motion is precisely defined — we look up
 * the exact letter from the exact starting position.
 *
 * When a `beat` constraint is given, the match is narrowed to the exact
 * variant (endPosition + blue rotationDirection). This is how DJ/EK/FL pin
 * their natural chirality rather than relying on CSV row order.
 */
function findEdge(
  letter: string,
  startPos: string,
  adj: Map<string, PictographData[]>,
  beat?: SeedBeat
): PictographData | null {
  const edges = adj.get(startPos) ?? [];
  return (
    edges.find(
      (e) =>
        e.letter === letter &&
        (!beat || e.endPosition === beat.endPos) &&
        (!beat || e.blueMotion.rotationDirection === beat.blueDir)
    ) ?? null
  );
}

// ============================================================================
// STEP BUILDERS (shared patterns from seed-l1-deck.ts)
// ============================================================================

function edgeToStep(edge: PictographData, stepNumber: number): SequenceStep {
  return {
    letter: edge.letter,
    variation: 0,
    startPosition: edge.startPosition,
    endPosition: edge.endPosition,
    blueMotion: { ...edge.blueMotion },
    redMotion: { ...edge.redMotion },
    stepNumber: stepNumber,
    stepNumber,
    isBridge: false,
  };
}

function buildStartPositionStep(edge: PictographData): SequenceStep {
  return {
    letter: "α",
    variation: 0,
    startPosition: edge.startPosition,
    endPosition: edge.startPosition,
    blueMotion: {
      color: "blue",
      motionType: "static",
      rotationDirection: "noRotation",
      startLocation: edge.blueMotion.startLocation,
      endLocation: edge.blueMotion.startLocation,
      startOrientation: "in",
      endOrientation: "in",
    },
    redMotion: {
      color: "red",
      motionType: "static",
      rotationDirection: "noRotation",
      startLocation: edge.redMotion.startLocation,
      endLocation: edge.redMotion.startLocation,
      startOrientation: "in",
      endOrientation: "in",
    },
    stepNumber: 0,
    stepNumber: 0,
    isBridge: false,
  };
}

// ============================================================================
// POSITION FIX-UP (same as seed-l1-deck.ts)
// ============================================================================

function findMatchingPictograph(
  step: SequenceStep,
  allPictographs: PictographData[]
): PictographData | null {
  const bm = step.blueMotion;
  const rm = step.redMotion;

  for (const p of allPictographs) {
    if (
      p.blueMotion.motionType.toLowerCase() === bm.motionType.toLowerCase() &&
      p.blueMotion.startLocation.toLowerCase() === bm.startLocation.toLowerCase() &&
      p.blueMotion.endLocation.toLowerCase() === bm.endLocation.toLowerCase() &&
      p.redMotion.motionType.toLowerCase() === rm.motionType.toLowerCase() &&
      p.redMotion.startLocation.toLowerCase() === rm.startLocation.toLowerCase() &&
      p.redMotion.endLocation.toLowerCase() === rm.endLocation.toLowerCase()
    ) {
      return p;
    }
  }
  return null;
}

function fixPositionNames(
  steps: SequenceStep[],
  seedLength: number,
  allPictographs: PictographData[]
): SequenceStep[] {
  return steps.map((step, i) => {
    // Seed beats come from CSV — positions are correct
    if (i < seedLength) return step;

    const match = findMatchingPictograph(step, allPictographs);
    if (match) {
      return {
        ...step,
        startPosition: match.startPosition,
        endPosition: match.endPosition,
        letter: match.letter,
      };
    }
    return step;
  });
}

// ============================================================================
// ORIENTATION CHAINING (same as seed-l1-deck.ts)
// ============================================================================

function chainOrientations(steps: SequenceStep[]): SequenceStep[] {
  if (steps.length === 0) return steps;

  let blueOri = "in";
  let redOri = "in";

  return steps.map((step) => {
    const blueStart = blueOri;
    const redStart = redOri;

    const blueEnd = calculateEndOrientation({
      motionType: step.blueMotion.motionType,
      turns: 0,
      rotationDirection: step.blueMotion.rotationDirection || "cw",
      startLocation: step.blueMotion.startLocation,
      endLocation: step.blueMotion.endLocation,
      startOrientation: blueStart,
    });

    const redEnd = calculateEndOrientation({
      motionType: step.redMotion.motionType,
      turns: 0,
      rotationDirection: step.redMotion.rotationDirection || "cw",
      startLocation: step.redMotion.startLocation,
      endLocation: step.redMotion.endLocation,
      startOrientation: redStart,
    });

    blueOri = blueEnd;
    redOri = redEnd;

    return {
      ...step,
      blueMotion: {
        ...step.blueMotion,
        startOrientation: blueStart,
        endOrientation: blueEnd,
      },
      redMotion: {
        ...step.redMotion,
        startOrientation: redStart,
        endOrientation: redEnd,
      },
    };
  });
}

// ============================================================================
// HAND PATH TRACING (same as seed-l1-deck.ts)
// ============================================================================

function traceHandPath(steps: SequenceStep[]): { blue: string; red: string } {
  const blueLocations = [steps[0].blueMotion.startLocation];
  const redLocations = [steps[0].redMotion.startLocation];

  for (const step of steps) {
    blueLocations.push(step.blueMotion.endLocation);
    redLocations.push(step.redMotion.endLocation);
  }

  return {
    blue: blueLocations.join("→"),
    red: redLocations.join("→"),
  };
}

function computeHandPathKey(steps: SequenceStep[]): string {
  const trace = traceHandPath(steps);
  return [trace.blue, trace.red].sort().join("|");
}

// ============================================================================
// VTG SEQUENCE BUILDER
// ============================================================================

interface VTGSequence {
  seqId: string;
  word: string;
  vtg: string;
  familyId: string;
  startPos: string;
  period: Period;
  handPathId: string;
  steps: SequenceStep[];
  startPositionStep: SequenceStep;
}

/**
 * Build a single VTG motion sequence from its definition.
 *
 * For quartered (same-direction): look up the 1-beat seed letter,
 * feed [startPos, beat1] to executeLOOP with QUARTERED → 4 beats.
 *
 * For halved (opposite-direction): look up both seed letters,
 * feed [startPos, beat1, beat2] to executeLOOP with HALVED → 4 beats.
 */
function buildVTGSequence(
  def: VTGMotionDef,
  adj: Map<string, PictographData[]>,
  allPictographs: PictographData[]
): VTGSequence | null {
  // Look up seed edges from the CSV
  const seedEdges: PictographData[] = [];
  let currentPos = def.startPos;

  for (let i = 0; i < def.seed.length; i++) {
    const letter = def.seed[i];
    const beat = def.seedPath?.[i];
    const edge = findEdge(letter, currentPos, adj, beat);
    if (!edge) {
      const want = beat ? ` (endPos=${beat.endPos}, blueDir=${beat.blueDir})` : "";
      console.error(`  ERROR: Could not find edge for letter "${letter}" from "${currentPos}"${want}`);
      return null;
    }
    seedEdges.push(edge);
    currentPos = edge.endPosition;
  }

  // Build the seed steps: [startPosition, ...beats]
  const startStep = buildStartPositionStep(seedEdges[0]);
  const beatSteps = seedEdges.map((edge, i) => edgeToStep(edge, i + 1));
  const seedWord = def.seed.join("");

  const inputSteps = [startStep, ...beatSteps];

  // Execute the LOOP
  const result = executeLOOP(
    inputSteps,
    seedWord,
    LOOPType.ROTATED,
    def.period,
    allPictographs
  );

  if (!result.success) {
    console.error(`  ERROR: LOOP execution failed for ${def.word}: ${result.error}`);
    return null;
  }

  // The result has [startPos, beat1..beat4]
  const rawSteps = result.steps.slice(1);
  if (rawSteps.length !== 4) {
    console.error(`  ERROR: Expected 4 beats, got ${rawSteps.length} for ${def.word}`);
    return null;
  }

  // Fix position names on generated beats
  const seedLength = def.seed.length;
  const positionFixedSteps = fixPositionNames(rawSteps, seedLength, allPictographs);

  // Chain orientations
  const actualSteps = chainOrientations(positionFixedSteps);

  // Compute hand path
  const handPathId = computeHandPathKey(actualSteps);

  const seqId = `vtg-${def.familyId}-${def.word.toLowerCase()}`;

  return {
    seqId,
    word: def.word,
    vtg: def.vtg,
    familyId: def.familyId,
    startPos: def.startPos,
    period: def.period,
    handPathId,
    steps: actualSteps,
    startPositionStep: result.steps[0],
  };
}

// ============================================================================
// FIRESTORE WRITE
// ============================================================================

function buildFirestoreMotion(motion: McpMotionData, color: string) {
  return {
    motionType: motion.motionType,
    rotationDirection: motion.rotationDirection,
    startLocation: motion.startLocation,
    endLocation: motion.endLocation,
    turns: 0,
    startOrientation: motion.startOrientation,
    endOrientation: motion.endOrientation,
    color,
    propType: "staff",
    gridMode: "diamond",
    isVisible: true,
    arrowLocation: motion.endLocation,
  };
}

function buildFirestoreStep(step: SequenceStep, stepNumber: number) {
  return {
    id: randomUUID(),
    isStep: true,
    stepNumber,
    letter: step.letter,
    startPosition: step.startPosition,
    endPosition: step.endPosition,
    gridMode: "diamond",
    duration: 1.0,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    motions: {
      blue: buildFirestoreMotion(step.blueMotion, "blue"),
      red: buildFirestoreMotion(step.redMotion, "red"),
    },
  };
}

function buildFirestoreStartPosition(step: SequenceStep) {
  return {
    isStartPosition: true,
    id: randomUUID(),
    gridPosition: step.startPosition,
    gridMode: "diamond",
    motions: {
      blue: buildFirestoreMotion(step.blueMotion, "blue"),
      red: buildFirestoreMotion(step.redMotion, "red"),
    },
  };
}

interface FamilyMeta {
  id: string;
  label: string;
  typeCombo: string;
  sequenceIds: string[];
}

async function writeToFirestore(sequences: VTGSequence[]): Promise<void> {
  const admin = await import("firebase-admin");

  const serviceAccount = JSON.parse(
    fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8")
  );

  if (!admin.default.apps.length) {
    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount),
    });
  }

  const db = admin.default.firestore();

  // Delete old sequences first
  const oldSeqsRef = db.collection(`decks/${DECK_ID}/sequences`);
  const oldSnap = await oldSeqsRef.get();
  if (!oldSnap.empty) {
    console.log(`Deleting ${oldSnap.size} old sequence docs...`);
    const deleteBatch = db.batch();
    for (const doc of oldSnap.docs) {
      deleteBatch.delete(doc.ref);
    }
    await deleteBatch.commit();
    console.log("Old docs deleted.");
  }

  // Write sequences
  const familySequenceIds = new Map<string, string[]>();
  let batch = db.batch();
  let batchCount = 0;

  for (const seq of sequences) {
    const ids = familySequenceIds.get(seq.familyId) ?? [];
    ids.push(seq.seqId);
    familySequenceIds.set(seq.familyId, ids);

    const firestoreSteps = seq.steps.map((step, i) =>
      buildFirestoreStep(step, i + 1)
    );

    const seqRef = db.doc(`decks/${DECK_ID}/sequences/${seq.seqId}`);
    batch.set(seqRef, {
      id: seq.seqId,
      name: seq.word,
      word: seq.word,
      gridMode: "diamond",
      isCircular: true,
      loopType: "rotated",
      sequenceLength: 4,
      level: 1,
      isFavorite: false,
      tags: ["vtg-deck", seq.familyId],
      thumbnails: [],
      steps: firestoreSteps,
      startPosition: buildFirestoreStartPosition(seq.startPositionStep),
      metadata: {
        deckId: DECK_ID,
        familyId: seq.familyId,
        familyLabel: seq.vtg,
        handPathId: seq.handPathId,
        startPosition: seq.startPos,
        seed: seq.word.slice(0, seq.period === Period.QUARTERED ? 1 : 2),
        vtgCategory: seq.vtg,
      },
      author: "TKA System",
      notes: `VTG ${seq.vtg}: ${seq.word}`,
    });

    batchCount++;
  }

  // Write deck metadata
  const familiesMeta: FamilyMeta[] = VTG_FAMILIES.map((f) => ({
    ...f,
    sequenceIds: familySequenceIds.get(f.id) ?? [],
  }));

  const deckRef = db.doc(`decks/${DECK_ID}`);
  batch.set(deckRef, {
    id: DECK_ID,
    name: "Level 1: VTG Motions",
    description: "The 19 fundamental VTG motion categories as rotated LOOPs.",
    families: familiesMeta,
    totalSequences: sequences.length,
    gridMode: "diamond",
    level: 1,
  });
  batchCount++;

  console.log(`Committing batch (${batchCount} ops)...`);
  await batch.commit();
  console.log(`Done! Wrote ${sequences.length} sequences to Firestore.`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log("=== Level 1 VTG Motions Deck Seeder ===\n");

  // Load CSV
  console.log("Loading CSV data...");
  const allPictographs = loadDiamondDataframe();
  console.log(`  Loaded ${allPictographs.length} pictograph rows`);

  // Build adjacency
  console.log("Building adjacency map...");
  const adj = buildAdjacencyMap(allPictographs);
  console.log(`  ${adj.size} positions with outgoing edges`);

  // Build all 19 VTG sequences
  console.log("\nBuilding VTG sequences...");
  const sequences: VTGSequence[] = [];

  for (const def of VTG_MOTIONS) {
    const seq = buildVTGSequence(def, adj, allPictographs);
    if (seq) {
      sequences.push(seq);
      const sliceLabel = def.period === Period.QUARTERED ? "quartered" : "halved";
      console.log(`  #${def.id} ${def.word} (${def.vtg}, ${sliceLabel}) ✓`);
    } else {
      console.error(`  #${def.id} ${def.word} FAILED`);
    }
  }

  console.log(`\nBuilt ${sequences.length}/${VTG_MOTIONS.length} sequences`);

  // Group by family for display
  console.log("\nFamilies:");
  for (const family of VTG_FAMILIES) {
    const familySeqs = sequences.filter((s) => s.familyId === family.id);
    console.log(`  ${family.label} (${family.typeCombo}): ${familySeqs.length} sequences`);
    for (const seq of familySeqs) {
      console.log(`    ${seq.word}`);
    }
  }

  // Hand path stats
  const handPaths = new Map<string, VTGSequence[]>();
  for (const seq of sequences) {
    const group = handPaths.get(seq.handPathId) ?? [];
    group.push(seq);
    handPaths.set(seq.handPathId, group);
  }
  console.log(`\n${handPaths.size} unique hand paths across ${sequences.length} sequences`);

  // Hand path traces
  console.log("\nHand path traces:");
  let hpNum = 1;
  for (const [hpId, seqs] of [...handPaths.entries()].sort()) {
    const trace = traceHandPath(seqs[0].steps);
    const words = seqs.map((s) => s.word).join(", ");
    console.log(`  #${hpNum} [${seqs[0].vtg}] — ${seqs.length} sequence(s): ${words}`);
    console.log(`    Hand A: ${trace.blue}`);
    console.log(`    Hand B: ${trace.red}`);
    hpNum++;
  }

  // Sample sequence detail
  if (sequences.length > 0) {
    const sample = sequences[0];
    console.log(`\nSample: ${sample.seqId}`);
    console.log(`  Word: ${sample.word} | VTG: ${sample.vtg} | Start: ${sample.startPos}`);
    for (const step of sample.steps) {
      console.log(
        `    Beat ${step.stepNumber}: ${step.letter} ` +
          `blue=${step.blueMotion.motionType}[${step.blueMotion.startLocation}→${step.blueMotion.endLocation}] ` +
          `ori=${step.blueMotion.startOrientation}→${step.blueMotion.endOrientation} | ` +
          `red=${step.redMotion.motionType}[${step.redMotion.startLocation}→${step.redMotion.endLocation}] ` +
          `ori=${step.redMotion.startOrientation}→${step.redMotion.endOrientation}`
      );
    }
  }

  // Write or dry-run
  if (DRY_RUN) {
    console.log("\n--- DRY RUN — Skipping Firestore write ---");
    console.log(`Would write ${sequences.length} sequences in ${VTG_FAMILIES.length} families`);
    console.log(`Firestore path: decks/${DECK_ID}`);
  } else {
    console.log("\nWriting to Firestore...");
    await writeToFirestore(sequences);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Deck: ${DECK_ID}`);
  console.log(`Total sequences: ${sequences.length}`);
  console.log(`Unique hand paths: ${handPaths.size}`);
  console.log(`Families: ${VTG_FAMILIES.length}`);
  console.log(`Steps per sequence: 4`);
  console.log(`Firestore path: decks/${DECK_ID}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
