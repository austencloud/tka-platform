/**
 * LOOP Detector for MCP Server
 *
 * Simplified LOOP detection that analyzes sequence steps to identify
 * transformation patterns (rotated, mirrored, swapped, inverted).
 *
 * This is a self-contained implementation for the MCP server that doesn't
 * require the complex dependency chain of the main app's LOOPDetector.
 */

import type { SequenceStep } from "../domain/models/SequenceEngineTypes.js";

/**
 * LOOP component primitives that can be detected
 */
export type LOOPComponentId = "rotated" | "mirrored" | "flipped" | "swapped" | "inverted" | "rewound";

/**
 * Result of LOOP detection analysis
 */
export interface LOOPDetectionResult {
  /** Whether the sequence is circular (ends where it starts) */
  isCircular: boolean;
  /** Detected LOOP components */
  components: LOOPComponentId[];
  /** Whether this is a freeform circular sequence (no pattern detected) */
  isFreeform: boolean;
  /** Rotation direction if detected */
  rotationDirection: "cw" | "ccw" | null;
  /** Human-readable description */
  description: string;
}

/**
 * Position transformation maps for detecting patterns
 */
const HALF_POSITION_MAP: Record<string, string> = {};
const VERTICAL_MIRROR_MAP: Record<string, string> = {};
const SWAP_MAP: Record<string, string> = {};

// Initialize position maps
function initPositionMaps() {
  // Already initialized
  if (Object.keys(HALF_POSITION_MAP).length > 0) return;

  // Alpha positions (180° rotation: 1↔5, 2↔6, 3↔7, 4↔8)
  for (let i = 1; i <= 8; i++) {
    const opposite = ((i - 1 + 4) % 8) + 1;
    HALF_POSITION_MAP[`alpha${i}`] = `alpha${opposite}`;
  }

  // Beta positions (same pattern)
  for (let i = 1; i <= 8; i++) {
    const opposite = ((i - 1 + 4) % 8) + 1;
    HALF_POSITION_MAP[`beta${i}`] = `beta${opposite}`;
  }

  // Gamma 1-8 positions
  for (let i = 1; i <= 8; i++) {
    const opposite = ((i - 1 + 4) % 8) + 1;
    HALF_POSITION_MAP[`gamma${i}`] = `gamma${opposite}`;
  }

  // Gamma 9-16 positions
  for (let i = 9; i <= 16; i++) {
    const opposite = ((i - 9 + 4) % 8) + 9;
    HALF_POSITION_MAP[`gamma${i}`] = `gamma${opposite}`;
  }

  // Vertical mirror map (alpha group - 1,5 stay same; 2↔8, 3↔7, 4↔6)
  const alphaMirror: Record<number, number> = {
    1: 1, 2: 8, 3: 7, 4: 6, 5: 5, 6: 4, 7: 3, 8: 2,
  };
  for (let i = 1; i <= 8; i++) {
    VERTICAL_MIRROR_MAP[`alpha${i}`] = `alpha${alphaMirror[i]}`;
    VERTICAL_MIRROR_MAP[`beta${i}`] = `beta${alphaMirror[i]}`;
  }

  // Gamma mirror (1-8 ↔ 9-16 with specific mapping)
  const gammaMirrorPairs = [
    [1, 9], [2, 16], [3, 15], [4, 14], [5, 13], [6, 12], [7, 11], [8, 10],
  ];
  for (const [a, b] of gammaMirrorPairs) {
    VERTICAL_MIRROR_MAP[`gamma${a}`] = `gamma${b}`;
    VERTICAL_MIRROR_MAP[`gamma${b}`] = `gamma${a}`;
  }

  // Swap map (alpha: 180° swap, beta: no change, gamma: cross-swap)
  for (let i = 1; i <= 8; i++) {
    SWAP_MAP[`alpha${i}`] = `alpha${((i - 1 + 4) % 8) + 1}`;
    SWAP_MAP[`beta${i}`] = `beta${i}`; // Beta stays same
  }

  // Gamma swap pattern
  const gammaSwapPairs = [
    [1, 15], [2, 16], [3, 9], [4, 10], [5, 11], [6, 12], [7, 13], [8, 14],
  ];
  for (const [a, b] of gammaSwapPairs) {
    SWAP_MAP[`gamma${a}`] = `gamma${b}`;
    SWAP_MAP[`gamma${b}`] = `gamma${a}`;
  }
}

/**
 * Check if a sequence is circular (ends where it starts)
 */
export function isSequenceCircular(steps: SequenceStep[]): boolean {
  if (steps.length < 2) return false;

  const startPositionStep = steps.find((s) => (s.stepNumber ?? s.beatIndex) === 0);
  const lastStep = steps[steps.length - 1];

  if (!startPositionStep || !lastStep) return false;

  return startPositionStep.startPosition === lastStep.endPosition;
}

/**
 * Detect LOOP pattern from sequence steps
 */
export function detectLOOPFromSteps(steps: SequenceStep[]): LOOPDetectionResult {
  initPositionMaps();

  const circular = isSequenceCircular(steps);

  if (!circular) {
    return {
      isCircular: false,
      components: [],
      isFreeform: false,
      rotationDirection: null,
      description: "Not a circular sequence",
    };
  }

  // Get letter steps only (exclude step 0 start position)
  const letterSteps = steps.filter((s) => (s.stepNumber ?? s.beatIndex) > 0);

  if (letterSteps.length < 2) {
    return {
      isCircular: true,
      components: [],
      isFreeform: true,
      rotationDirection: null,
      description: "Circular but too short to detect pattern",
    };
  }

  // Must have even number of steps for halved detection
  if (letterSteps.length % 2 !== 0) {
    return {
      isCircular: true,
      components: [],
      isFreeform: true,
      rotationDirection: null,
      description: "Circular with odd number of steps (freeform)",
    };
  }

  // Generate halved beat pairs (step N paired with step N + half)
  const halfLength = letterSteps.length / 2;
  const components: LOOPComponentId[] = [];

  // Check each transformation type across all beat pairs
  const rotatedMatches = checkRotatedPattern(letterSteps, halfLength);
  const mirroredMatches = checkMirroredPattern(letterSteps, halfLength);
  const swappedMatches = checkSwappedPattern(letterSteps, halfLength);
  const invertedMatches = checkInvertedPattern(letterSteps, halfLength);

  if (rotatedMatches.matched) {
    components.push("rotated");
  }
  if (mirroredMatches) {
    components.push("mirrored");
  }
  if (swappedMatches) {
    components.push("swapped");
  }
  if (invertedMatches) {
    components.push("inverted");
  }

  if (components.length === 0) {
    return {
      isCircular: true,
      components: [],
      isFreeform: true,
      rotationDirection: null,
      description: "Circular sequence with no detected pattern (freeform)",
    };
  }

  const description = `LOOP: ${components.join(" + ")}`;

  return {
    isCircular: true,
    components,
    isFreeform: false,
    rotationDirection: rotatedMatches.direction,
    description,
  };
}

/**
 * Check if beat pairs show 180° rotation pattern
 */
function checkRotatedPattern(
  steps: SequenceStep[],
  halfLength: number
): { matched: boolean; direction: "cw" | "ccw" | null } {
  let matchCount = 0;

  for (let i = 0; i < halfLength; i++) {
    const step1 = steps[i];
    const step2 = steps[i + halfLength];
    if (!step1 || !step2) continue;

    // Check if step2's position is the 180° rotation of step1
    const expectedPosition = HALF_POSITION_MAP[step1.endPosition];
    if (expectedPosition === step2.endPosition) {
      matchCount++;
    }
  }

  // Need at least 75% match for pattern detection
  const threshold = Math.floor(halfLength * 0.75);
  const matched = matchCount >= threshold;

  // Detect rotation direction from motion data
  let direction: "cw" | "ccw" | null = null;
  if (matched && steps[0]) {
    const blueRotDir = steps[0].blueMotion?.rotationDirection;
    if (blueRotDir === "cw" || blueRotDir === "ccw") {
      direction = blueRotDir;
    }
  }

  return { matched, direction };
}

/**
 * Check if beat pairs show vertical mirror pattern
 */
function checkMirroredPattern(steps: SequenceStep[], halfLength: number): boolean {
  let matchCount = 0;

  for (let i = 0; i < halfLength; i++) {
    const step1 = steps[i];
    const step2 = steps[i + halfLength];
    if (!step1 || !step2) continue;

    const expectedPosition = VERTICAL_MIRROR_MAP[step1.endPosition];
    if (expectedPosition === step2.endPosition) {
      matchCount++;
    }
  }

  const threshold = Math.floor(halfLength * 0.75);
  return matchCount >= threshold;
}

/**
 * Check if beat pairs show color swap pattern
 */
function checkSwappedPattern(steps: SequenceStep[], halfLength: number): boolean {
  let matchCount = 0;

  for (let i = 0; i < halfLength; i++) {
    const step1 = steps[i];
    const step2 = steps[i + halfLength];
    if (!step1 || !step2) continue;

    // Check position swap AND motion swap
    const expectedPosition = SWAP_MAP[step1.endPosition];
    const positionMatch = expectedPosition === step2.endPosition;

    // Check if blue and red motions are swapped
    const motionSwapped =
      step1.blueMotion?.startLocation === step2.redMotion?.startLocation &&
      step1.blueMotion?.endLocation === step2.redMotion?.endLocation &&
      step1.redMotion?.startLocation === step2.blueMotion?.startLocation &&
      step1.redMotion?.endLocation === step2.blueMotion?.endLocation;

    if (positionMatch || motionSwapped) {
      matchCount++;
    }
  }

  const threshold = Math.floor(halfLength * 0.75);
  return matchCount >= threshold;
}

/**
 * Check if beat pairs show inversion pattern (direction reversal)
 */
function checkInvertedPattern(steps: SequenceStep[], halfLength: number): boolean {
  let matchCount = 0;

  for (let i = 0; i < halfLength; i++) {
    const step1 = steps[i];
    const step2 = steps[i + halfLength];
    if (!step1 || !step2) continue;

    // Inversion means rotation directions are opposite
    const blueInverted =
      (step1.blueMotion?.rotationDirection === "cw" &&
        step2.blueMotion?.rotationDirection === "ccw") ||
      (step1.blueMotion?.rotationDirection === "ccw" &&
        step2.blueMotion?.rotationDirection === "cw");

    const redInverted =
      (step1.redMotion?.rotationDirection === "cw" &&
        step2.redMotion?.rotationDirection === "ccw") ||
      (step1.redMotion?.rotationDirection === "ccw" &&
        step2.redMotion?.rotationDirection === "cw");

    if (blueInverted || redInverted) {
      matchCount++;
    }
  }

  const threshold = Math.floor(halfLength * 0.75);
  return matchCount >= threshold;
}
