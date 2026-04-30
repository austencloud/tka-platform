/**
 * LOOP Executor for MCP Server
 *
 * Executes LOOP transformations on sequences.
 * Phase 1 supports: REWOUND and ROTATED
 *
 * Each executor takes a partial sequence and produces a complete circular sequence
 * by applying the appropriate transformation.
 *
 * CRITICAL: When reversing motions (e.g., REWOUND), the resulting letter is derived
 * from the motion parameters, NOT assumed to be the same letter. For example,
 * reversing E's motions produces K (they are inverses of each other).
 */

import type { SequenceStep } from "../sequence-builder.js";
import { LOOPType, Period } from "./loop-types.js";
import { HALVED_LOOPS, QUARTERED_LOOPS } from "./loop-validator.js";
import { findLetterByMotions } from "./letter-lookup.js";

// ============================================================================
// TYPES
// ============================================================================

export interface MotionData {
  color: string;
  startLocation: string;
  endLocation: string;
  motionType: string;
  rotationDirection: string;
  startOrientation: string;
  endOrientation: string;
}

export interface PictographData {
  letter: string;
  startPosition: string;
  endPosition: string;
  timing: string;
  direction: string;
  blueMotion: MotionData;
  redMotion: MotionData;
}

export interface LOOPExecutionResult {
  success: boolean;
  steps: SequenceStep[];
  word: string;
  /** The full loop word - derived letters may differ from seed word */
  loopWord: string;
  /** Original seed word (first half for rewound, first quarter for quartered) */
  seedWord: string;
  /** Derived word from the transformation (may differ from seed) */
  derivedWord: string;
  loopType: LOOPType;
  period: Period;
  isCircular: boolean;
  /** Which beat indices are derived (not part of seed) */
  derivedBeatIndices: number[];
  error?: string;
}

// ============================================================================
// LOCATION ROTATION MAPS
// ============================================================================

/**
 * Grid location identifiers
 */
type GridLocation = "n" | "e" | "s" | "w" | "ne" | "se" | "sw" | "nw";

/**
 * Clockwise location rotation map (90°)
 * S → W → N → E → S
 */
const LOCATION_MAP_CLOCKWISE: Record<string, string> = {
  n: "e",
  e: "s",
  s: "w",
  w: "n",
  ne: "se",
  se: "sw",
  sw: "nw",
  nw: "ne",
};

/**
 * Counter-clockwise location rotation map (90°)
 * S → E → N → W → S
 */
const LOCATION_MAP_COUNTER_CLOCKWISE: Record<string, string> = {
  n: "w",
  w: "s",
  s: "e",
  e: "n",
  ne: "nw",
  nw: "sw",
  sw: "se",
  se: "ne",
};

/**
 * Dash location map (180°)
 * S ↔ N, E ↔ W
 */
const LOCATION_MAP_DASH: Record<string, string> = {
  n: "s",
  s: "n",
  e: "w",
  w: "e",
  ne: "sw",
  sw: "ne",
  se: "nw",
  nw: "se",
};

/**
 * Static location map (no change)
 */
const LOCATION_MAP_STATIC: Record<string, string> = {
  n: "n",
  s: "s",
  e: "e",
  w: "w",
  ne: "ne",
  se: "se",
  sw: "sw",
  nw: "nw",
};

/**
 * Determine hand rotation direction from start to end location
 */
function getHandRotationDirection(
  startLocation: string,
  endLocation: string
): "cw" | "ccw" | "dash" | "static" {
  const key = `${startLocation},${endLocation}`;

  // Static (no movement)
  if (startLocation === endLocation) {
    return "static";
  }

  // Check dash (opposite)
  if (LOCATION_MAP_DASH[startLocation] === endLocation) {
    return "dash";
  }

  // Check clockwise
  if (LOCATION_MAP_CLOCKWISE[startLocation] === endLocation) {
    return "cw";
  }

  // Check counter-clockwise
  if (LOCATION_MAP_COUNTER_CLOCKWISE[startLocation] === endLocation) {
    return "ccw";
  }

  // Default to static if unknown
  return "static";
}

/**
 * Get the appropriate location map for a hand rotation direction
 */
function getLocationMapForHandRotation(
  direction: "cw" | "ccw" | "dash" | "static"
): Record<string, string> {
  switch (direction) {
    case "cw":
      return LOCATION_MAP_CLOCKWISE;
    case "ccw":
      return LOCATION_MAP_COUNTER_CLOCKWISE;
    case "dash":
      return LOCATION_MAP_DASH;
    case "static":
      return LOCATION_MAP_STATIC;
  }
}

// ============================================================================
// REWOUND EXECUTOR
// ============================================================================

/**
 * Execute the Rewound LOOP
 *
 * Rewound is a temporal transformation that plays the sequence backwards.
 * It takes the partial sequence and appends a reversed copy.
 *
 * Example: CAKE → CAKE + [reversed motions] → CAKEKEAC
 *
 * CRITICAL: The reversed letters are DERIVED from the reversed motion parameters,
 * NOT assumed to be the same letters in reverse order. For example, E and K are
 * motion inverses - reversing E's motions produces K, not E.
 *
 * IMPORTANT: Rewound works on ANY sequence regardless of position relationships.
 */
function executeRewound(
  steps: SequenceStep[],
  word: string,
  allPictographs: PictographData[]
): LOOPExecutionResult {
  if (steps.length < 2) {
    return {
      success: false,
      steps: [],
      word,
      loopWord: "",
      seedWord: word,
      derivedWord: "",
      loopType: LOOPType.REWOUND,
      period: Period.HALVED,
      isCircular: false,
      derivedBeatIndices: [],
      error: "Sequence must have at least 2 steps (start position + 1 beat)",
    };
  }

  // Separate start position from actual steps
  const startPositionStep = steps[0]!;
  const actualSteps = steps.slice(1);
  const originalLength = actualSteps.length;

  // Create reversed steps and derive their letters
  const reversedSteps: SequenceStep[] = [];
  const derivedLetters: string[] = [];
  const stepsToReverse = [...actualSteps].reverse();

  for (let i = 0; i < stepsToReverse.length; i++) {
    const sourceStep = stepsToReverse[i]!;
    const newStepNumber = originalLength + i + 1;

    // Get the previous beat's end position for continuity
    const previousStep =
      i === 0
        ? actualSteps[actualSteps.length - 1]!
        : reversedSteps[i - 1]!;

    const rewoundBeat = createRewoundBeat(sourceStep, previousStep, newStepNumber);

    // Derive the letter from the reversed motion parameters
    const derivedLetter = findLetterByMotions(
      rewoundBeat.blueMotion,
      rewoundBeat.redMotion,
      allPictographs
    );

    // Update the beat with the derived letter (or keep original if not found)
    rewoundBeat.letter = derivedLetter || sourceStep.letter;
    derivedLetters.push(rewoundBeat.letter);

    reversedSteps.push(rewoundBeat);
  }

  // Combine: start position + original steps + reversed steps
  const allSteps = [startPositionStep, ...actualSteps, ...reversedSteps];

  // Build the loop word from seed + derived
  const derivedWord = derivedLetters.join("");
  const loopWord = word + derivedWord;

  // Track which beat indices are derived (1-indexed, excluding start position)
  const derivedBeatIndices = Array.from(
    { length: originalLength },
    (_, i) => originalLength + i + 1
  );

  return {
    success: true,
    steps: allSteps,
    word,
    loopWord,
    seedWord: word,
    derivedWord,
    loopType: LOOPType.REWOUND,
    period: Period.HALVED,
    isCircular: true,
    derivedBeatIndices,
  };
}

/**
 * Create a rewound beat from a source beat
 * Swaps start/end positions and reverses motion directions
 */
function createRewoundBeat(
  sourceStep: SequenceStep,
  previousStep: SequenceStep,
  newStepNumber: number
): SequenceStep {
  return {
    ...sourceStep,
    stepNumber: newStepNumber,
    // Swap positions: new start = previous end, new end = source's start
    startPosition: previousStep.endPosition,
    endPosition: sourceStep.startPosition,
    // Reverse motions
    blueMotion: createRewoundMotion(sourceStep.blueMotion, previousStep.blueMotion),
    redMotion: createRewoundMotion(sourceStep.redMotion, previousStep.redMotion),
    variation: 0, // Variation doesn't apply to generated steps
  };
}

/**
 * Create a rewound motion from source motion
 * Swaps start/end locations and reverses rotation direction
 */
function createRewoundMotion(
  sourceMotion: SequenceStep["blueMotion"],
  previousMotion: SequenceStep["blueMotion"]
): SequenceStep["blueMotion"] {
  // Reverse rotation direction
  let reversedRotation = sourceMotion.rotationDirection;
  if (reversedRotation === "cw") {
    reversedRotation = "ccw";
  } else if (reversedRotation === "ccw") {
    reversedRotation = "cw";
  }

  return {
    ...sourceMotion,
    // Swap locations
    startLocation: previousMotion.endLocation,
    endLocation: sourceMotion.startLocation,
    // Reverse rotation direction
    rotationDirection: reversedRotation,
    // Swap orientations
    startOrientation: sourceMotion.endOrientation,
    endOrientation: sourceMotion.startOrientation,
  };
}

// ============================================================================
// STRICT ROTATED EXECUTOR
// ============================================================================

/**
 * Execute the Strict Rotated LOOP
 *
 * Takes a partial sequence (first half or quarter) and applies rotational
 * transformations to each beat to complete the circular pattern.
 *
 * The rotation works by:
 * - Taking each pictograph from the first section
 * - Rotating its hand locations based on the hand's rotation direction
 * - Creating new steps that fit the rotated positions
 * - Deriving letters from the rotated motion parameters
 */
function executeStrictRotated(
  steps: SequenceStep[],
  word: string,
  period: Period,
  allPictographs: PictographData[]
): LOOPExecutionResult {
  // Validate sequence
  if (steps.length < 2) {
    return {
      success: false,
      steps: [],
      word,
      loopWord: "",
      seedWord: word,
      derivedWord: "",
      loopType: LOOPType.ROTATED,
      period,
      isCircular: false,
      derivedBeatIndices: [],
      error: "Sequence must have at least 2 steps (start position + 1 beat)",
    };
  }

  const startPositionStep = steps[0]!;
  const actualSteps = steps.slice(1);

  // Validate position pair
  const startPos = startPositionStep.startPosition;
  const endPos = actualSteps[actualSteps.length - 1]!.endPosition;
  const positionPair = `${startPos},${endPos}`;

  const validationSet = period === Period.HALVED ? HALVED_LOOPS : QUARTERED_LOOPS;
  if (!validationSet.has(positionPair)) {
    return {
      success: false,
      steps: [],
      word,
      loopWord: "",
      seedWord: word,
      derivedWord: "",
      loopType: LOOPType.ROTATED,
      period,
      isCircular: false,
      derivedBeatIndices: [],
      error: `Invalid position pair for ${period} LOOP: ${startPos} → ${endPos}`,
    };
  }

  // Calculate how many steps to generate
  const originalLength = actualSteps.length;
  const entriesToAdd =
    period === Period.HALVED
      ? originalLength
      : originalLength * 3;

  // Generate the new steps and derive letters
  const generatedSteps: SequenceStep[] = [];
  const derivedLetters: string[] = [];
  const allStepsForGeneration = [...actualSteps];
  let lastStep = actualSteps[actualSteps.length - 1]!;
  let nextStepNumber = lastStep.stepNumber + 1;

  for (let i = 0; i < entriesToAdd; i++) {
    const finalIntendedLength = originalLength + entriesToAdd;

    // Get the corresponding beat from the first section
    const matchingIndex = getMatchingIndex(nextStepNumber, finalIntendedLength, period);
    const matchingStep = allStepsForGeneration[matchingIndex - 1];

    if (!matchingStep) {
      return {
        success: false,
        steps: [],
        word,
        loopWord: "",
        seedWord: word,
        derivedWord: "",
        loopType: LOOPType.ROTATED,
        period,
        isCircular: false,
        derivedBeatIndices: [],
        error: `Failed to find matching step at index ${matchingIndex}`,
      };
    }

    const newStep = createRotatedStep(matchingStep, lastStep, nextStepNumber);

    // Derive the letter from the rotated motion parameters
    const derivedLetter = findLetterByMotions(
      newStep.blueMotion,
      newStep.redMotion,
      allPictographs
    );
    newStep.letter = derivedLetter || matchingStep.letter;
    derivedLetters.push(newStep.letter);

    generatedSteps.push(newStep);
    allStepsForGeneration.push(newStep);
    lastStep = newStep;
    nextStepNumber++;
  }

  // Combine: start position + original steps + generated steps
  const allSteps = [startPositionStep, ...actualSteps, ...generatedSteps];

  // Build the loop word from seed + derived
  const derivedWord = derivedLetters.join("");
  const loopWord = word + derivedWord;

  // Track which beat indices are derived
  const derivedBeatIndices = Array.from(
    { length: entriesToAdd },
    (_, i) => originalLength + i + 1
  );

  return {
    success: true,
    steps: allSteps,
    word,
    loopWord,
    seedWord: word,
    derivedWord,
    loopType: LOOPType.ROTATED,
    period,
    isCircular: true,
    derivedBeatIndices,
  };
}

/**
 * Get the matching index for index mapping
 */
function getMatchingIndex(
  stepNumber: number,
  finalLength: number,
  period: Period
): number {
  if (period === Period.QUARTERED) {
    const quarterLength = Math.floor(finalLength / 4);
    return stepNumber > quarterLength ? stepNumber - quarterLength : stepNumber;
  } else {
    const halfLength = Math.floor(finalLength / 2);
    return stepNumber > halfLength ? stepNumber - halfLength : stepNumber;
  }
}

/**
 * Create a rotated step from a matching step
 */
function createRotatedStep(
  matchingStep: SequenceStep,
  previousStep: SequenceStep,
  stepNumber: number
): SequenceStep {
  // Get hand rotation directions from the matching step
  const blueHandRotDir = getHandRotationDirection(
    matchingStep.blueMotion.startLocation,
    matchingStep.blueMotion.endLocation
  );
  const redHandRotDir = getHandRotationDirection(
    matchingStep.redMotion.startLocation,
    matchingStep.redMotion.endLocation
  );

  // Get location maps
  const blueLocationMap = getLocationMapForHandRotation(blueHandRotDir);
  const redLocationMap = getLocationMapForHandRotation(redHandRotDir);

  // Calculate new end locations
  const newBlueEndLoc = blueLocationMap[previousStep.blueMotion.endLocation] || previousStep.blueMotion.endLocation;
  const newRedEndLoc = redLocationMap[previousStep.redMotion.endLocation] || previousStep.redMotion.endLocation;

  // Create the new step
  return {
    letter: matchingStep.letter,
    variation: 0,
    startPosition: previousStep.endPosition,
    endPosition: derivePositionFromLocations(newBlueEndLoc, newRedEndLoc),
    blueMotion: {
      ...matchingStep.blueMotion,
      startLocation: previousStep.blueMotion.endLocation,
      endLocation: newBlueEndLoc,
    },
    redMotion: {
      ...matchingStep.redMotion,
      startLocation: previousStep.redMotion.endLocation,
      endLocation: newRedEndLoc,
    },
    stepNumber,
    isBridge: false,
  };
}

/**
 * Derive grid position from blue and red end locations
 * This is a simplified version - the full implementation would use GridPositionDeriver
 */
function derivePositionFromLocations(blueLoc: string, redLoc: string): string {
  // Simple heuristic based on relationship between locations
  // This should be replaced with proper GridPositionDeriver logic

  // Same location = beta
  if (blueLoc === redLoc) {
    const locIndex = getLocationIndex(blueLoc);
    return `beta${locIndex}`;
  }

  // Opposite locations = alpha
  if (LOCATION_MAP_DASH[blueLoc] === redLoc) {
    const locIndex = getLocationIndex(blueLoc);
    return `alpha${locIndex}`;
  }

  // Adjacent locations = gamma
  // This is simplified - full implementation needs proper gamma mapping
  const locIndex = getLocationIndex(blueLoc);
  return `gamma${locIndex}`;
}

/**
 * Get numeric index for a location (for position derivation)
 */
function getLocationIndex(loc: string): number {
  const mapping: Record<string, number> = {
    n: 1,
    ne: 2,
    e: 3,
    se: 4,
    s: 5,
    sw: 6,
    w: 7,
    nw: 8,
  };
  return mapping[loc] || 1;
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

/**
 * Execute a LOOP transformation on a sequence
 *
 * @param steps - The sequence steps (including start position)
 * @param word - The seed word
 * @param loopType - Type of LOOP transformation
 * @param period - Halved (180°) or Quartered (90°)
 * @param allPictographs - Pictograph data for letter derivation
 */
export function executeLOOP(
  steps: SequenceStep[],
  word: string,
  loopType: LOOPType,
  period: Period = Period.HALVED,
  allPictographs: PictographData[] = []
): LOOPExecutionResult {
  switch (loopType) {
    case LOOPType.REWOUND:
      return executeRewound(steps, word, allPictographs);

    case LOOPType.ROTATED:
      return executeStrictRotated(steps, word, period, allPictographs);

    default:
      return {
        success: false,
        steps: [],
        word,
        loopWord: "",
        seedWord: word,
        derivedWord: "",
        loopType,
        period,
        isCircular: false,
        derivedBeatIndices: [],
        error: `LOOP type "${loopType}" is not yet implemented. Supported types: REWOUND, ROTATED`,
      };
  }
}
