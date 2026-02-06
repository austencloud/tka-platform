/**
 * generate-demo-sequences.ts
 *
 * Build-time script that generates fresh demo sequences for the landing page.
 * Produces two collections:
 *
 * 1. Motion type demos (shift, dash, static) - simple repeating patterns
 *    that teach the three fundamental hand motions.
 *
 * 2. Per-level pools following TKA's actual level system:
 *    Level 1 (No Turns): Zero turns on all motions, IN/OUT orientations only
 *    Level 2 (Whole Turns): Adds 1, 2, 3 full turns per motion
 *    Level 3 (All Turns): Half-turns, quarter turns, and float
 *
 * Uses the quartered loop builder for circular animations.
 * Turn values are allocated per-level using the turn allocator.
 *
 * Run: npx tsx scripts/generate-demo-sequences.ts
 * Output: ../apps/landing/static/data/demo-sequences.json
 */

import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { ensureDataLoaded } from "../src/shared/server-context.js";
import {
  buildSequenceFromLetters,
  buildSequenceForLoop,
  parseWordToLetters,
  detectReversals,
  type SequenceStep,
  type SequenceResult,
  type LoopConstraint,
} from "../src/core/sequence-builder.js";
import { allocateTurns } from "../src/core/turn-allocator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SequenceSpec {
  id: string;
  words: string[];      // Try each word in order until one succeeds
  group: "motionTypes" | "level1" | "level2" | "level3";
  targetBeats: number;  // Accept sequences with this many non-start steps
  useLoop?: boolean;    // If true, use quartered loop builder
  level: number;        // TKA level (1=no turns, 2=whole turns, 3=all turns)
  maxTurns?: number;    // Max turn intensity (default: level-based)
}

interface LandingMotionData {
  motionType: string;
  rotationDirection: string;
  startLocation: string;
  endLocation: string;
  turns: number;
  startOrientation: string;
  endOrientation: string;
  isVisible: boolean;
  propType: string;
  arrowLocation: string;
  color: string;
  gridMode: string;
  arrowPlacementData: {
    positionX: number;
    positionY: number;
    rotationAngle: number;
    coordinates: null;
    svgCenter: null;
    svgMirrored: boolean;
  };
  propPlacementData: {
    positionX: number;
    positionY: number;
    rotationAngle: number;
    coordinates: null;
    svgCenter: null;
  };
}

interface LandingStepData {
  id: string;
  letter: string;
  stepNumber: number;
  duration: number;
  blueReversal: boolean;
  redReversal: boolean;
  isBlank: boolean;
  startPosition: string;
  endPosition: string;
  gridMode: string;
  motions: {
    blue: LandingMotionData;
    red: LandingMotionData;
  };
}

interface LandingSequenceData {
  id: string;
  name: string;
  word: string;
  steps: LandingStepData[];
  thumbnails: string[];
  isFavorite: boolean;
  isCircular: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
  gridMode: string;
  level: number;
  beatCount: number;
}

interface DemoSequencesOutput {
  motionTypes: LandingSequenceData[];
  level1: LandingSequenceData[];
  level2: LandingSequenceData[];
  level3: LandingSequenceData[];
}

// ---------------------------------------------------------------------------
// Sequence Playlist
// ---------------------------------------------------------------------------

// Level system (from turn-allocator.ts):
//   Level 1: 0 turns only
//   Level 2: 0, 1, 2, 3 (whole numbers)
//   Level 3: 0, 0.5, 1, 1.5, 2, 2.5, 3, "fl" (all values including float)

const SPECS: SequenceSpec[] = [
  // -----------------------------------------------------------------------
  // Motion type demos - simple patterns teaching the three hand movements
  // All at Level 1 (no turns) to keep focus on the motion type itself
  // -----------------------------------------------------------------------
  { id: "mt-static", words: ["αααα", "ββββ", "γγγγ"], group: "motionTypes", targetBeats: 4, level: 1 },
  { id: "mt-shift", words: ["AAAA", "BBBB", "CCCC", "ABAB"], group: "motionTypes", targetBeats: 4, level: 1, useLoop: true },
  { id: "mt-dash", words: ["ΦΨΦΨ", "ΛΛΛΛ"], group: "motionTypes", targetBeats: 4, level: 1 },

  // -----------------------------------------------------------------------
  // Level 1: No Turns
  // Zero turns on all motions. IN/OUT orientations only.
  // Various letter types to show position variety at the simplest level.
  // -----------------------------------------------------------------------
  { id: "l1-8a", words: ["AABBCCAA", "BBCCAABB", "ABCAABCA"], group: "level1", targetBeats: 8, level: 1, useLoop: true },
  { id: "l1-8b", words: ["GGHHIIGG", "GHIGHIGH"], group: "level1", targetBeats: 8, level: 1, useLoop: true },
  { id: "l1-8c", words: ["MMNNOOMM", "MONOMONO"], group: "level1", targetBeats: 8, level: 1, useLoop: true },

  // -----------------------------------------------------------------------
  // Level 2: Whole Turns
  // Adds 1, 2, or 3 full turns per motion. Same letters, now with rotation.
  // -----------------------------------------------------------------------
  { id: "l2-8a", words: ["ABCABCAB", "ABABABAB"], group: "level2", targetBeats: 8, level: 2, maxTurns: 2, useLoop: true },
  { id: "l2-8b", words: ["GHIGHIGH", "GHGHGHGH"], group: "level2", targetBeats: 8, level: 2, maxTurns: 2, useLoop: true },
  { id: "l2-8c", words: ["DJDJDJDJ"], group: "level2", targetBeats: 8, level: 2, maxTurns: 2, useLoop: true },

  // -----------------------------------------------------------------------
  // Level 3: All Turns (half-turns, float)
  // Half-turn precision and float. The full vocabulary of rotation.
  // -----------------------------------------------------------------------
  { id: "l3-8a", words: ["DJDJDJDJ"], group: "level3", targetBeats: 8, level: 3, maxTurns: 2, useLoop: true },
  { id: "l3-8b", words: ["EKEKEKEK"], group: "level3", targetBeats: 8, level: 3, maxTurns: 2, useLoop: true },
  { id: "l3-8c", words: ["FLFLFLFL"], group: "level3", targetBeats: 8, level: 3, maxTurns: 2, useLoop: true },
];

// ---------------------------------------------------------------------------
// Transform MCP SequenceStep → landing StepData format
// ---------------------------------------------------------------------------

function mcpMotionToLanding(
  motion: SequenceStep["blueMotion"],
  color: "blue" | "red",
  turns: number
): LandingMotionData {
  return {
    motionType: motion.motionType,
    rotationDirection: motion.rotationDirection,
    startLocation: motion.startLocation,
    endLocation: motion.endLocation,
    turns,
    startOrientation: motion.startOrientation,
    endOrientation: motion.endOrientation,
    isVisible: true,
    propType: "staff",
    arrowLocation: motion.endLocation,
    color,
    gridMode: "diamond",
    arrowPlacementData: {
      positionX: 0,
      positionY: 0,
      rotationAngle: 0,
      coordinates: null,
      svgCenter: null,
      svgMirrored: false,
    },
    propPlacementData: {
      positionX: 0,
      positionY: 0,
      rotationAngle: 0,
      coordinates: null,
      svgCenter: null,
    },
  };
}

function mcpStepToLandingStep(
  step: SequenceStep,
  seqId: string,
  index: number,
  blueTurns: number,
  redTurns: number
): LandingStepData {
  return {
    id: `${seqId}-${index + 1}`,
    letter: step.letter,
    stepNumber: index + 1,
    duration: 1,
    blueReversal: step.blueReversal ?? false,
    redReversal: step.redReversal ?? false,
    isBlank: false,
    startPosition: step.startPosition,
    endPosition: step.endPosition,
    gridMode: "diamond",
    motions: {
      blue: mcpMotionToLanding(step.blueMotion, "blue", blueTurns),
      red: mcpMotionToLanding(step.redMotion, "red", redTurns),
    },
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateSequence(steps: LandingStepData[]): string | null {
  if (steps.length === 0) {
    return "No steps";
  }

  // Position continuity
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1]!;
    const curr = steps[i]!;
    if (prev.endPosition !== curr.startPosition) {
      return `Position break at step ${i}: ${prev.endPosition} → ${curr.startPosition}`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const LOOP_CONSTRAINT: LoopConstraint = {
  loopType: "strict_rotated",
  sliceSize: "quartered",
};

function tryBuildWord(
  word: string,
  targetBeats: number,
  allPictographs: ReturnType<typeof ensureDataLoaded>,
  useLoop: boolean
): SequenceResult | null {
  const letters = parseWordToLetters(word);

  let result: SequenceResult;
  if (useLoop) {
    result = buildSequenceForLoop(letters, allPictographs, LOOP_CONSTRAINT, 500);
  } else {
    result = buildSequenceFromLetters(letters, allPictographs, 500);
  }

  if (!result.isValid || result.steps.length === 0) {
    return null;
  }

  const beatSteps = result.steps.filter((s) => s.stepNumber > 0);
  if (beatSteps.length < targetBeats) {
    return null;
  }

  return result;
}

function generateSequence(
  spec: SequenceSpec,
  allPictographs: ReturnType<typeof ensureDataLoaded>
): LandingSequenceData | null {
  const useLoop = spec.useLoop ?? false;

  for (const word of spec.words) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = tryBuildWord(word, spec.targetBeats, allPictographs, useLoop);
      if (!result) continue;

      const beatSteps = result.steps.filter((s) => s.stepNumber > 0);
      const usableSteps = beatSteps.slice(0, spec.targetBeats);
      const stepsWithReversals = detectReversals(usableSteps);

      // Allocate turns using the proper level-based allocator
      const turnAllocation = allocateTurns(
        spec.targetBeats,
        spec.level,
        spec.maxTurns
      );

      // Transform to landing format with level-appropriate turns
      const landingSteps = stepsWithReversals.map((step, i) => {
        let blueTurns = turnAllocation.blue[i] ?? 0;
        let redTurns = turnAllocation.red[i] ?? 0;

        // Convert "fl" to 0 for the landing format (float not visually distinct in demo)
        if (blueTurns === "fl") blueTurns = 0;
        if (redTurns === "fl") redTurns = 0;

        // Static motions always get 0 turns regardless of level
        if (step.blueMotion.motionType === "static") blueTurns = 0;
        if (step.redMotion.motionType === "static") redTurns = 0;

        return mcpStepToLandingStep(step, spec.id, i, blueTurns as number, redTurns as number);
      });

      const validationError = validateSequence(landingSteps);
      if (validationError) {
        console.error(`    [INVALID] ${word} attempt ${attempt + 1}: ${validationError}`);
        continue;
      }

      return {
        id: spec.id,
        name: word,
        word,
        steps: landingSteps,
        thumbnails: [],
        isFavorite: false,
        isCircular: true,
        tags: ["demo", spec.group],
        metadata: {},
        gridMode: "diamond",
        level: spec.level,
        beatCount: landingSteps.length,
      };
    }
    console.error(`    [FAIL] "${word}": no valid sequence after 5 attempts`);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.error("[generate-demo-sequences] Starting...");

  const allPictographs = ensureDataLoaded("diamond");
  console.error(`[generate-demo-sequences] Loaded ${allPictographs.length} pictographs`);

  const output: DemoSequencesOutput = {
    motionTypes: [],
    level1: [],
    level2: [],
    level3: [],
  };

  let successes = 0;
  let failures = 0;

  for (const spec of SPECS) {
    const loopLabel = spec.useLoop ? " [quartered loop]" : "";
    console.error(`  Generating ${spec.id}: ${spec.group}, ${spec.targetBeats}-count, L${spec.level}${loopLabel} [${spec.words.join(", ")}]`);

    const seq = generateSequence(spec, allPictographs);

    if (seq) {
      output[spec.group].push(seq);
      successes++;
      console.error(`  [OK] "${seq.word}": ${seq.steps.length} steps`);
    } else {
      failures++;
      console.error(`  [SKIP] ${spec.id}: all candidates failed`);
    }
  }

  for (const [key, seqs] of Object.entries(output)) {
    if (seqs.length === 0) {
      console.error(`[WARN] No sequences generated for ${key}!`);
    }
  }

  const outputPath = path.resolve(
    __dirname,
    "../../apps/landing/static/data/demo-sequences.json"
  );
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.error(
    `\n[generate-demo-sequences] Done. ${successes} sequences, ${failures} failed.`
  );
  console.error(`Output: ${outputPath}`);

  for (const [key, seqs] of Object.entries(output)) {
    console.error(`  ${key}: ${seqs.length} sequences (${(seqs as LandingSequenceData[]).map((s) => `${s.word}[${s.beatCount}]`).join(", ")})`);
  }

  if (failures > 0) {
    process.exit(1);
  }
}

main();
