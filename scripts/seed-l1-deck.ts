/**
 * Seed the Level 1 Quartered Rotated LOOP Deck to Firestore
 *
 * Uses the MCP server's battle-tested loop executor (executeLOOP) to build
 * all valid 8-beat quartered rotated LOOP sequences on the diamond grid.
 *
 * Algorithm:
 *   1. Load CSV data (same as MCP server's loadDataframe)
 *   2. Build adjacency map
 *   3. Enumerate all valid 2-beat seeds that end at a quartered LOOP position
 *   4. Execute executeLOOP() on each seed to produce the full 8-beat sequence
 *   5. Deduplicate: rotation-invariant + motion-type normalization (pro/anti → shift at 0 turns)
 *   6. Group into hand-path families, write to Firestore
 *
 * Usage: npx tsx scripts/seed-l1-deck.ts [--dry-run]
 * Requires: serviceAccountKey.json in project root
 */

import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";

// MCP server imports — all self-contained, no external deps
import {
  executeLOOP,
  type PictographData,
  type MotionData as McpMotionData,
} from "../mcp-server/src/core/loop/loop-executor.js";
import { LOOPType, SliceSize } from "../mcp-server/src/core/loop/loop-types.js";
import { QUARTERED_LOOPS } from "../mcp-server/src/core/loop/loop-validator.js";
import { calculateOrientations } from "../mcp-server/src/core/orientation-calculator.js";
import type { SequenceStep } from "../mcp-server/src/core/sequence-builder.js";

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
const DECK_ID = "l1-quartered-loop";
const DRY_RUN = process.argv.includes("--dry-run");

// ============================================================================
// LETTER TYPE CLASSIFICATION
// ============================================================================

const LETTER_TYPES: Record<string, number> = {
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

const TYPE_NAMES: Record<number, string> = {
  1: "Dual-Shift",
  2: "Shift",
  3: "Cross-Shift",
  4: "Dash",
  5: "Dual-Dash",
  6: "Static",
};

// ============================================================================
// PHASE 1 — LOAD CSV DATA
// ============================================================================

/** Port of MCP server's loadDataframe() from server-context.ts */
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
// PHASE 2 — BUILD ADJACENCY MAP
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

// ============================================================================
// PHASE 3 — ENUMERATE VALID 2-BEAT SEEDS & EXECUTE LOOP
// ============================================================================

/** Convert a PictographData edge into a SequenceStep for the loop executor */
function edgeToStep(edge: PictographData, stepNumber: number): SequenceStep {
  return {
    letter: edge.letter,
    variation: 0,
    startPosition: edge.startPosition,
    endPosition: edge.endPosition,
    blueMotion: { ...edge.blueMotion },
    redMotion: { ...edge.redMotion },
    stepNumber,
    isBridge: false,
  };
}

/** Build a start-position SequenceStep from the first edge */
function buildStartPositionStep(edge: PictographData): SequenceStep {
  return {
    letter: "α", // placeholder — will be overridden by position group
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
    isBridge: false,
  };
}

// ============================================================================
// POSITION FIX-UP
// ============================================================================

/**
 * The MCP executor's derivePositionFromLocations is a simplified heuristic
 * that gets position NAMES wrong (e.g., maps blue@s/red@n → alpha5 instead
 * of alpha1). Fix this by looking up each generated beat's motions in the
 * CSV to find the correct start/end position names.
 */
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

/**
 * Fix position names on generated beats (3-8) by looking them up in the CSV.
 * Beats 1-2 come directly from CSV edges and already have correct positions.
 */
function fixPositionNames(
  steps: SequenceStep[],
  allPictographs: PictographData[]
): SequenceStep[] {
  return steps.map((step, i) => {
    // Beats 1-2 (index 0-1) are from the CSV seed — positions are correct
    if (i < 2) return step;

    const match = findMatchingPictograph(step, allPictographs);
    if (match) {
      return {
        ...step,
        startPosition: match.startPosition,
        endPosition: match.endPosition,
        letter: match.letter, // Also fix letter from CSV (more authoritative)
      };
    }
    return step;
  });
}

interface DeckSequence {
  seqId: string;
  word: string;
  loopWord: string;
  letter1: string;
  letter2: string;
  t1: number;
  t2: number;
  handPath: string;
  familyId: string;
  startPos: string;
  steps: SequenceStep[];
  startPositionStep: SequenceStep;
}

function enumerateAndExecute(
  adj: Map<string, PictographData[]>,
  allPictographs: PictographData[],
  startPos: string
): DeckSequence[] {
  const results: DeckSequence[] = [];
  const edges = adj.get(startPos) ?? [];

  for (const b1 of edges) {
    const edges2 = adj.get(b1.endPosition) ?? [];
    for (const b2 of edges2) {
      // Check if seed end position forms a valid quartered LOOP with start
      const positionPair = `${startPos},${b2.endPosition}`;
      if (!QUARTERED_LOOPS.has(positionPair)) continue;

      // Build the 3-step input: [startPosition, beat1, beat2]
      const startStep = buildStartPositionStep(b1);
      const beat1Step = edgeToStep(b1, 1);
      const beat2Step = edgeToStep(b2, 2);
      const seedWord = `${b1.letter}${b2.letter}`;

      const result = executeLOOP(
        [startStep, beat1Step, beat2Step],
        seedWord,
        LOOPType.STRICT_ROTATED,
        SliceSize.QUARTERED,
        allPictographs
      );

      if (!result.success) continue;

      // The result has 9 steps: [startPos, beat1..beat8]
      const rawSteps = result.steps.slice(1); // Remove start position
      if (rawSteps.length !== 8) continue;

      // Fix position names on generated beats (executor's derivation is simplified)
      const actualSteps = fixPositionNames(rawSteps, allPictographs);

      const t1 = LETTER_TYPES[b1.letter] ?? 0;
      const t2 = LETTER_TYPES[b2.letter] ?? 0;
      const handPath = `${TYPE_NAMES[t1]}+${TYPE_NAMES[t2]}`;
      const familyId = handPath.toLowerCase().replace(/\s+/g, "-");

      // Build a motion-type + direction suffix for unique IDs.
      // Motion type alone isn't enough — two sequences can share the same
      // letters and motion types but differ in hand direction (CW vs CCW).
      // Include blue hand's start→end locations from both beats as disambiguator.
      const suffix = [
        b1.blueMotion.motionType[0],
        b1.redMotion.motionType[0],
        b1.blueMotion.startLocation[0] + b1.blueMotion.endLocation[0],
        b2.blueMotion.motionType[0],
        b2.redMotion.motionType[0],
        b2.blueMotion.startLocation[0] + b2.blueMotion.endLocation[0],
      ].join("");

      results.push({
        seqId: `${startPos}-${seedWord}-${suffix}`,
        word: seedWord,
        loopWord: result.loopWord,
        letter1: b1.letter,
        letter2: b2.letter,
        t1,
        t2,
        handPath,
        familyId,
        startPos,
        steps: actualSteps,
        startPositionStep: result.steps[0],
      });
    }
  }

  return results;
}

// ============================================================================
// PHASE 4 — DEDUPLICATE
// ============================================================================

/**
 * Normalize motion type for dedup: at L1 (0 turns), pro and anti
 * are visually identical shifts.
 */
function normalizeMotionType(type: string): string {
  if (type === "pro" || type === "anti") return "shift";
  return type;
}

/**
 * Build a beat key from a step. Each hand becomes "type_start_end", then
 * we sort the two hands so blue/red order doesn't matter.
 *
 * At L1 (0 turns), swapping which hand does the dash vs static on a Φ beat
 * produces the same spatial pattern (just with different prop colors).
 * The user confirmed these look identical in the rendered pictographs.
 */
function beatKey(step: SequenceStep): string {
  const bm = step.blueMotion;
  const rm = step.redMotion;
  const handA = `${normalizeMotionType(bm.motionType)}_${bm.startLocation}_${bm.endLocation}`;
  const handB = `${normalizeMotionType(rm.motionType)}_${rm.startLocation}_${rm.endLocation}`;
  return [handA, handB].sort().join("|");
}

/**
 * Build the "reversed" beat key — swap start/end locations for both hands.
 * This represents the same beat viewed from the opposite rotational direction.
 */
function reversedBeatKey(step: SequenceStep): string {
  const bm = step.blueMotion;
  const rm = step.redMotion;
  const handA = `${normalizeMotionType(bm.motionType)}_${bm.endLocation}_${bm.startLocation}`;
  const handB = `${normalizeMotionType(rm.motionType)}_${rm.endLocation}_${rm.startLocation}`;
  return [handA, handB].sort().join("|");
}

/**
 * Build a canonical key for an 8-beat sequence that is invariant to:
 *
 * 1. Pro/anti equivalence (both → "shift" at 0 turns)
 * 2. Blue/red swap (per-beat color invariance — sort hand descriptions)
 * 3. Rotational equivalence (sort quarter-pairs)
 * 4. CW/CCW equivalence (min of forward vs reversed key)
 *
 * CW/CCW: A quartered LOOP going clockwise is the visual mirror of the same
 * pattern going counter-clockwise. At L1, these produce identical pictograph
 * shapes. We handle this by computing both the "forward" key and the
 * "reversed" key (beats in reverse order, start/end locations swapped),
 * then taking the lexicographic minimum.
 */
function canonicalKey(steps: SequenceStep[]): string {
  const beats = steps.map(beatKey);
  const quarters: string[] = [];
  for (let i = 0; i < 8; i += 2) {
    quarters.push(`${beats[i]}::${beats[i + 1]}`);
  }
  quarters.sort();
  return quarters.join("///");
}

function deduplicateSequences(sequences: DeckSequence[]): DeckSequence[] {
  const seen = new Map<string, DeckSequence>();

  for (const seq of sequences) {
    const key = canonicalKey(seq.steps);
    if (!seen.has(key)) {
      seen.set(key, seq);
    }
  }

  return Array.from(seen.values());
}

// ============================================================================
// PHASE 5 — FIRESTORE WRITE
// ============================================================================

/** Build the Firestore-ready motion object from a SequenceStep motion */
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

/** Build a Firestore-ready step from a SequenceStep */
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

/** Build the Firestore-ready start position data */
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

interface Family {
  id: string;
  label: string;
  typeCombo: string;
  sequences: DeckSequence[];
}

function groupIntoFamilies(sequences: DeckSequence[]): Family[] {
  const familyMap = new Map<string, Family>();

  for (const seq of sequences) {
    let family = familyMap.get(seq.familyId);
    if (!family) {
      family = {
        id: seq.familyId,
        label: seq.handPath,
        typeCombo: `Type ${seq.t1} + Type ${seq.t2}`,
        sequences: [],
      };
      familyMap.set(seq.familyId, family);
    }
    family.sequences.push(seq);
  }

  // Sort by type combo
  return Array.from(familyMap.values()).sort((a, b) => {
    const aKey = a.sequences[0].t1 * 10 + a.sequences[0].t2;
    const bKey = b.sequences[0].t1 * 10 + b.sequences[0].t2;
    return aKey - bKey;
  });
}

async function writeToFirestore(
  families: Family[],
  totalCount: number
): Promise<void> {
  // Dynamic import of firebase-admin (CommonJS module)
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

  // Delete old sequences first (clean slate)
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

  // Write new sequences in batches
  const familiesMeta: FamilyMeta[] = [];
  let written = 0;
  let currentBatch = db.batch();
  let batchCount = 0;

  for (const family of families) {
    const sequenceIds: string[] = [];

    for (const seq of family.sequences) {
      sequenceIds.push(seq.seqId);

      const firestoreSteps = seq.steps.map((step, i) =>
        buildFirestoreStep(step, i + 1)
      );

      const seqRef = db.doc(`decks/${DECK_ID}/sequences/${seq.seqId}`);
      currentBatch.set(seqRef, {
        id: seq.seqId,
        name: seq.loopWord,
        word: seq.loopWord,
        gridMode: "diamond",
        isCircular: true,
        loopType: "strict_rotated",
        sequenceLength: 8,
        level: 1,
        isFavorite: false,
        tags: ["l1-deck", family.id],
        thumbnails: [],
        steps: firestoreSteps,
        startPosition: buildFirestoreStartPosition(seq.startPositionStep),
        metadata: {
          deckId: DECK_ID,
          familyId: family.id,
          familyLabel: family.label,
          startPosition: seq.startPos,
          seed: seq.word,
          letter1: seq.letter1,
          letter2: seq.letter2,
        },
        author: "TKA System",
        notes: `${family.label} from ${seq.startPos}`,
      });

      written++;
      batchCount++;

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
      sequenceIds: [...new Set(sequenceIds)],
    });
  }

  // Write deck metadata in the final batch
  const deckRef = db.doc(`decks/${DECK_ID}`);
  currentBatch.set(deckRef, {
    id: DECK_ID,
    name: "Level 1: Quartered Rotated LOOP",
    description:
      "All valid 8-beat sequences on the diamond grid with continuous rotation. " +
      "Each sequence is a 2-beat seed rotated through 4 quarters.",
    families: familiesMeta,
    totalSequences: totalCount,
    gridMode: "diamond",
    level: 1,
  });
  batchCount++;

  console.log(`Committing final batch (${batchCount} ops)...`);
  await currentBatch.commit();
  console.log(`Done! Wrote ${written} sequences to Firestore.`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log("=== L1 Quartered Rotated LOOP Deck Seeder ===\n");

  // Phase 1: Load data
  console.log("Phase 1: Loading CSV data...");
  const allPictographs = loadDiamondDataframe();
  console.log(`  Loaded ${allPictographs.length} pictograph rows`);

  // Phase 2: Build adjacency
  console.log("Phase 2: Building adjacency map...");
  const adj = buildAdjacencyMap(allPictographs);
  console.log(`  ${adj.size} positions with outgoing edges`);

  // Phase 3: Enumerate seeds + execute LOOPs from ALL starting positions
  console.log("Phase 3: Enumerating seeds and executing LOOPs...");

  // Use ALL positions that appear in the adjacency map, not just a fixed list.
  // The dedup step (Phase 4) handles rotational equivalence.
  const allStartPositions = Array.from(adj.keys()).sort();
  let allSequences: DeckSequence[] = [];

  for (const startPos of allStartPositions) {
    const results = enumerateAndExecute(adj, allPictographs, startPos);
    if (results.length > 0) {
      console.log(`  ${startPos}: ${results.length} raw sequences`);
      allSequences.push(...results);
    }
  }
  console.log(`  Total raw (before dedup): ${allSequences.length}`);

  // Phase 4: Deduplicate
  console.log("Phase 4: Deduplicating...");
  const unique = deduplicateSequences(allSequences);
  console.log(`  After dedup: ${unique.length} unique sequences`);

  // Phase 5: Group into families
  console.log("Phase 5: Grouping into families...");
  const families = groupIntoFamilies(unique);

  console.log(`\nOrganized into ${families.length} families:`);
  for (const f of families) {
    console.log(`  ${f.label} (${f.typeCombo}): ${f.sequences.length} sequences`);
  }

  // Phase 6: Write to Firestore
  if (DRY_RUN) {
    console.log("\n--- DRY RUN — Skipping Firestore write ---");
    console.log(`Would write ${unique.length} sequences in ${families.length} families`);

    // Print a sample sequence for inspection
    const sample = unique[0];
    if (sample) {
      console.log(`\nSample sequence: ${sample.seqId}`);
      console.log(`  Word: ${sample.loopWord}`);
      console.log(`  Start: ${sample.startPos}`);
      console.log(`  Steps:`);
      for (const step of sample.steps) {
        console.log(
          `    Beat ${step.stepNumber}: ${step.letter} (${step.startPosition} → ${step.endPosition}) ` +
            `blue=${step.blueMotion.motionType}[${step.blueMotion.startLocation}→${step.blueMotion.endLocation}] ` +
            `red=${step.redMotion.motionType}[${step.redMotion.startLocation}→${step.redMotion.endLocation}]`
        );
      }
    }
  } else {
    console.log("\nPhase 6: Writing to Firestore...");
    await writeToFirestore(families, unique.length);
  }

  // Summary
  console.log(`\n--- Summary ---`);
  console.log(`Deck: ${DECK_ID}`);
  console.log(`Total unique sequences: ${unique.length}`);
  console.log(`Families: ${families.length}`);
  console.log(`Steps per sequence: 8`);
  console.log(`Firestore path: decks/${DECK_ID}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
