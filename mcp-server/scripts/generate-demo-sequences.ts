/**
 * generate-demo-sequences.ts
 *
 * Build-time script that generates fresh demo sequences for the landing page.
 * Every run produces NEW random sequences - nothing is hardcoded.
 *
 * Produces two collections:
 *
 * 1. Motion type demos (shift, dash, static) - simple repeating patterns
 *    that teach the three fundamental hand motions.
 *
 * 2. Per-level pools following TKA's actual level system:
 *    Level 1 (No Turns): Zero turns on all motions
 *    Level 2 (Whole Turns): Adds 1, 2, 3 full turns per motion
 *    Level 3 (All Turns): Half-turns, quarter turns, and float
 *
 * Uses generateRandomWord() to pick random letters, then the constrained
 * beam-search builder (same as MCP generate_sequence) to build valid
 * sequences with automatic bridge insertion.
 *
 * Run: npx tsx scripts/generate-demo-sequences.ts
 * Output: ../apps/landing/static/data/demo-sequences.json
 */

import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import {
  ensureDataLoaded,
  generateRandomWord,
} from "../src/shared/server-context.js";
import {
  buildSequenceForLoop,
  parseWordToLetters,
  detectReversals,
  type SequenceStep,
  type SequenceResult,
  type LoopConstraint,
} from "../src/core/sequence-builder.js";
import {
  buildConstrainedSequence,
  emptyConstraintSet,
  getPresetConstraintSet,
} from "../src/core/constraints/index.js";
import { ensureTransitionGraphInitialized } from "../src/core/letter-transition-graph.js";
import { allocateTurns } from "../src/core/turn-allocator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SequenceSpec {
  id: string;
  group: "motionTypes" | "level1" | "level2" | "level3";
  targetBeats: number;
  level: number;         // TKA level (1=no turns, 2=whole turns, 3=all turns)
  maxTurns?: number;     // Max turn intensity (default: level-based)
  fixedWord?: string;    // If set, use this exact word (motion type demos only)
  useLoop?: boolean;     // If true, use quartered loop builder (motion type demos only)
  maxAttempts?: number;  // How many random words to try (default: 20)
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
// Sequence Specs
// ---------------------------------------------------------------------------

// Motion type demos use fixed words - they're deliberately repeating
// one letter/motion type to teach a single concept.
// Level sequences use random generation - fresh words every build.

const SPECS: SequenceSpec[] = [
  // Motion type demos - fixed words, specific motion types
  { id: "mt-static", fixedWord: "αααα", group: "motionTypes", targetBeats: 4, level: 1 },
  { id: "mt-shift", fixedWord: "AAAA", group: "motionTypes", targetBeats: 4, level: 1, useLoop: true },
  { id: "mt-dash", fixedWord: "ΦΨΦΨ", group: "motionTypes", targetBeats: 4, level: 1 },

  // Level 1: No Turns - 4 random 8-beat sequences
  { id: "l1-8a", group: "level1", targetBeats: 8, level: 1 },
  { id: "l1-8b", group: "level1", targetBeats: 8, level: 1 },
  { id: "l1-8c", group: "level1", targetBeats: 8, level: 1 },
  { id: "l1-8d", group: "level1", targetBeats: 8, level: 1 },

  // Level 2: Whole Turns - 4 random 8-beat sequences
  { id: "l2-8a", group: "level2", targetBeats: 8, level: 2, maxTurns: 2 },
  { id: "l2-8b", group: "level2", targetBeats: 8, level: 2, maxTurns: 2 },
  { id: "l2-8c", group: "level2", targetBeats: 8, level: 2, maxTurns: 2 },
  { id: "l2-8d", group: "level2", targetBeats: 8, level: 2, maxTurns: 2 },

  // Level 3: All Turns - 4 random 8-beat sequences
  { id: "l3-8a", group: "level3", targetBeats: 8, level: 3, maxTurns: 2 },
  { id: "l3-8b", group: "level3", targetBeats: 8, level: 3, maxTurns: 2 },
  { id: "l3-8c", group: "level3", targetBeats: 8, level: 3, maxTurns: 2 },
  { id: "l3-8d", group: "level3", targetBeats: 8, level: 3, maxTurns: 2 },
];

// ---------------------------------------------------------------------------
// Transform step data → landing StepData format
// ---------------------------------------------------------------------------

function motionToLanding(
  motion: { motionType: string; rotationDirection: string; startLocation: string; endLocation: string; startOrientation: string; endOrientation: string },
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

function stepToLandingStep(
  step: { letter: string; startPosition: string; endPosition: string; blueMotion: any; redMotion: any; blueReversal?: boolean; redReversal?: boolean },
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
      blue: motionToLanding(step.blueMotion, "blue", blueTurns),
      red: motionToLanding(step.redMotion, "red", redTurns),
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
// Builders
// ---------------------------------------------------------------------------

const LOOP_CONSTRAINT: LoopConstraint = {
  loopType: "strict_rotated",
  sliceSize: "quartered",
};

const SMOOTH_CONSTRAINTS = getPresetConstraintSet("smooth") ?? emptyConstraintSet();

function tryBuildConstrained(
  word: string,
  targetBeats: number,
  allPictographs: ReturnType<typeof ensureDataLoaded>
): SequenceResult | null {
  const letters = parseWordToLetters(word);

  const result = buildConstrainedSequence({
    letters,
    allPictographs,
    constraintSet: SMOOTH_CONSTRAINTS,
    beamConfig: { maxBacktracks: 500 },
  });

  if (!result.success || result.steps.length === 0) {
    return null;
  }

  const beatSteps = result.steps.slice(1);
  if (beatSteps.length < targetBeats) {
    return null;
  }

  const steps: SequenceStep[] = result.steps.map((step, i) => ({
    letter: step.letter,
    variation: result.variationIndices[i] ?? 0,
    startPosition: step.startPosition,
    endPosition: step.endPosition,
    blueMotion: step.blueMotion,
    redMotion: step.redMotion,
    stepNumber: i,
    isBridge: (result.bridgeStepIndices ?? []).includes(i),
  }));

  return {
    word: result.word,
    steps,
    startPosition: result.startPosition,
    endPosition: result.endPosition,
    isValid: true,
  };
}

function tryBuildLoop(
  word: string,
  targetBeats: number,
  allPictographs: ReturnType<typeof ensureDataLoaded>
): SequenceResult | null {
  const letters = parseWordToLetters(word);
  const result = buildSequenceForLoop(letters, allPictographs, LOOP_CONSTRAINT, 500);

  if (!result.isValid || result.steps.length === 0) {
    return null;
  }

  const beatSteps = result.steps.filter((s) => s.stepNumber > 0);
  if (beatSteps.length < targetBeats) {
    return null;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Core generation: builds one sequence from a spec
// ---------------------------------------------------------------------------

function generateSequence(
  spec: SequenceSpec,
  allPictographs: ReturnType<typeof ensureDataLoaded>
): LandingSequenceData | null {
  const useLoop = spec.useLoop ?? false;
  const maxAttempts = spec.maxAttempts ?? 20;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Either use fixed word (motion type demos) or generate random
    const word = spec.fixedWord ?? generateRandomWord(spec.targetBeats);

    const result = useLoop
      ? tryBuildLoop(word, spec.targetBeats, allPictographs)
      : tryBuildConstrained(word, spec.targetBeats, allPictographs);

    if (!result) continue;

    const beatSteps = result.steps.filter((s) => s.stepNumber > 0);
    const usableSteps = beatSteps.slice(0, spec.targetBeats);
    const stepsWithReversals = detectReversals(usableSteps);

    const turnAllocation = allocateTurns(
      spec.targetBeats,
      spec.level,
      spec.maxTurns
    );

    const landingSteps = stepsWithReversals.map((step, i) => {
      let blueTurns = turnAllocation.blue[i] ?? 0;
      let redTurns = turnAllocation.red[i] ?? 0;

      if (blueTurns === "fl") blueTurns = 0;
      if (redTurns === "fl") redTurns = 0;

      if (step.blueMotion.motionType === "static") blueTurns = 0;
      if (step.redMotion.motionType === "static") redTurns = 0;

      return stepToLandingStep(step, spec.id, i, blueTurns as number, redTurns as number);
    });

    const validationError = validateSequence(landingSteps);
    if (validationError) {
      continue;
    }

    const displayWord = landingSteps.map((s) => s.letter).join("");

    return {
      id: spec.id,
      name: displayWord,
      word: displayWord,
      steps: landingSteps,
      thumbnails: [],
      isFavorite: false,
      isCircular: useLoop,
      tags: ["demo", spec.group],
      metadata: {},
      gridMode: "diamond",
      level: spec.level,
      beatCount: landingSteps.length,
    };
  }

  console.error(`    [FAIL] ${spec.id}: no valid sequence after ${maxAttempts} random words`);
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.error("[generate-demo-sequences] Starting...");

  const allPictographs = ensureDataLoaded("diamond");
  console.error(`[generate-demo-sequences] Loaded ${allPictographs.length} pictographs`);

  // The constrained builder uses the transition graph for bridge finding.
  // Must be initialized before any buildConstrainedSequence() calls.
  const graph = await ensureTransitionGraphInitialized();
  console.error(`[generate-demo-sequences] Transition graph initialized: ${graph.isInitialized()}`);

  const output: DemoSequencesOutput = {
    motionTypes: [],
    level1: [],
    level2: [],
    level3: [],
  };

  let successes = 0;
  let failures = 0;

  for (const spec of SPECS) {
    const label = spec.fixedWord
      ? `fixed "${spec.fixedWord}"`
      : `random ${spec.targetBeats}-letter words`;
    console.error(`  ${spec.id}: ${spec.group} L${spec.level} (${label})`);

    const seq = generateSequence(spec, allPictographs);

    if (seq) {
      output[spec.group].push(seq);
      successes++;
      console.error(`    [OK] "${seq.word}" (${seq.steps.length} steps)`);
    } else {
      failures++;
      console.error(`    [SKIP] ${spec.id}: all attempts failed`);
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

  for (const [key, seqs] of Object.entries(output)) {
    console.error(`  ${key}: ${seqs.length} sequences (${(seqs as LandingSequenceData[]).map((s) => `${s.word}[${s.beatCount}]`).join(", ")})`);
  }

  if (failures > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[generate-demo-sequences] Fatal error:", err);
  process.exit(1);
});
