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

import type { SequenceStep, Motion } from "../../core/types/sequence-engine-types.js";
import { LOOPType, Period } from "../loop-types.js";
import { HALVED_LOOPS, QUARTERED_LOOPS } from "../validation/LOOPValidator.js";
import { findLetterByMotions } from "../LetterLookup.js";


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
  derivedStepIndices: number[];
  error?: string;
}


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


/**
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
      derivedStepIndices: [],
      error: "Sequence must have at least 2 steps (start position + 1 beat)",
    };
  }

  const startPositionStep = steps[0]!;
  const actualSteps = steps.slice(1);
  const originalLength = actualSteps.length;

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

    const rewoundStepRaw = createRewoundStep(sourceStep, previousStep, newStepNumber);

    // Derive the letter from the reversed motion parameters
    const derivedLetter = findLetterByMotions(
      rewoundStepRaw.motions.blue,
      rewoundStepRaw.motions.red,
      allPictographs
    );

    // Update the beat with the derived letter (or keep original if not found).
    // Step is readonly, so emit a new step with the resolved letter.
    const resolvedLetter = (derivedLetter || sourceStep.letter) as SequenceStep["letter"];
    const rewoundStep: SequenceStep = { ...rewoundStepRaw, letter: resolvedLetter };
    derivedLetters.push(rewoundStep.letter ?? "");

    reversedSteps.push(rewoundStep);
  }

  const allSteps = [startPositionStep, ...actualSteps, ...reversedSteps];

  const derivedWord = derivedLetters.join("");
  const loopWord = word + derivedWord;

  const derivedStepIndices = Array.from(
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
    derivedStepIndices,
  };
}

/**
 * Swaps start/end positions and reverses motion directions
 */
function createRewoundStep(
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
    motions: {
      blue: createRewoundMotion(sourceStep.motions.blue, previousStep.motions.blue),
      red: createRewoundMotion(sourceStep.motions.red, previousStep.motions.red),
    },
    variation: 0, // Variation doesn't apply to generated steps
  };
}

/**
 * Swaps start/end locations and reverses rotation direction
 */
function createRewoundMotion(
  sourceMotion: Motion,
  previousMotion: Motion
): Motion {
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
/**
 * Geometric post-hoc rotation path used by the MCP server's `executeLOOP`
 * dispatcher. The in-app generator uses the class-based
 * StrictRotatedExecutor in `./StrictRotatedExecutor.ts` instead.
 */
function executeStrictRotated(
  steps: SequenceStep[],
  word: string,
  period: Period,
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
      loopType: LOOPType.ROTATED,
      period,
      isCircular: false,
      derivedStepIndices: [],
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
      derivedStepIndices: [],
      error: `Invalid position pair for ${period} LOOP: ${startPos} → ${endPos}`,
    };
  }

  const originalLength = actualSteps.length;
  const entriesToAdd =
    period === Period.HALVED
      ? originalLength
      : originalLength * 3;

  const generatedSteps: SequenceStep[] = [];
  const derivedLetters: string[] = [];
  const allStepsForGeneration = [...actualSteps];
  let lastStep = actualSteps[actualSteps.length - 1]!;
  let nextStepNumber = (lastStep.stepNumber ?? lastStep.stepNumber) + 1;

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
        derivedStepIndices: [],
        error: `Failed to find matching step at index ${matchingIndex}`,
      };
    }

    const newStepRaw = createRotatedStep(matchingStep, lastStep, nextStepNumber);

    // Derive the letter from the rotated motion parameters
    const derivedLetter = findLetterByMotions(
      newStepRaw.motions.blue,
      newStepRaw.motions.red,
      allPictographs
    );
    const resolvedLetter = (derivedLetter || matchingStep.letter) as SequenceStep["letter"];
    const newStep: SequenceStep = { ...newStepRaw, letter: resolvedLetter };
    derivedLetters.push(newStep.letter ?? "");

    generatedSteps.push(newStep);
    allStepsForGeneration.push(newStep);
    lastStep = newStep;
    nextStepNumber++;
  }

  const allSteps = [startPositionStep, ...actualSteps, ...generatedSteps];

  const derivedWord = derivedLetters.join("");
  const loopWord = word + derivedWord;

  const derivedStepIndices = Array.from(
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
    derivedStepIndices,
  };
}

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

function createRotatedStep(
  matchingStep: SequenceStep,
  previousStep: SequenceStep,
  stepNumber: number
): SequenceStep {
  const blueHandRotDir = getHandRotationDirection(
    matchingStep.motions.blue.startLocation,
    matchingStep.motions.blue.endLocation
  );
  const redHandRotDir = getHandRotationDirection(
    matchingStep.motions.red.startLocation,
    matchingStep.motions.red.endLocation
  );

  const blueLocationMap = getLocationMapForHandRotation(blueHandRotDir);
  const redLocationMap = getLocationMapForHandRotation(redHandRotDir);

  const newBlueEndLoc = blueLocationMap[previousStep.motions.blue.endLocation] || previousStep.motions.blue.endLocation;
  const newRedEndLoc = redLocationMap[previousStep.motions.red.endLocation] || previousStep.motions.red.endLocation;

  // Create the new step. Cast string-typed map outputs back to the
  // unified enum types — the maps are hand-authored and the values are
  // definitionally valid GridLocations/GridPositions.
  return {
    id: `step-rotated-${stepNumber}`,
    letter: matchingStep.letter,
    variation: 0,
    startPosition: previousStep.endPosition,
    endPosition: derivePositionFromLocations(newBlueEndLoc, newRedEndLoc) as SequenceStep["endPosition"],
    motions: {
      blue: {
        ...matchingStep.motions.blue,
        startLocation: previousStep.motions.blue.endLocation as Motion["startLocation"],
        endLocation: newBlueEndLoc as Motion["endLocation"],
      },
      red: {
        ...matchingStep.motions.red,
        startLocation: previousStep.motions.red.endLocation as Motion["startLocation"],
        endLocation: newRedEndLoc as Motion["endLocation"],
      },
    },
    stepNumber,
    duration: 1,
    isBridge: false,
  };
}

/**
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


/**
 * Execute a LOOP transformation on a sequence
 * @param steps - The sequence steps (including start position)
 * @param word - The seed word
 * @param loopType - Type of LOOP transformation
 * @param period - Period enum: Halved (180°) or Quartered (90°)
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
        derivedStepIndices: [],
        error: `LOOP type "${loopType}" is not yet implemented. Supported types: REWOUND, ROTATED`,
      };
  }
}
