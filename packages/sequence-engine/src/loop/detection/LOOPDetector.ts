/**
 * LOOP Detector for Sequence Engine
 *
 * Analyzes sequence steps to identify LOOP transformation patterns
 * (rotated, mirrored, swapped, inverted, flipped, rewound).
 *
 * Merged from:
 * - Engine's original simplified detection (functional API for MCP)
 * - App's richer class-based detection (quartered rotation, compound patterns,
 *   LOOPType resolution, interval-based detection)
 *
 * The functional API (detectLOOPFromSteps, isSequenceCircular) is preserved
 * for backward compatibility. The class-based LOOPDetector adds quartered
 * rotation detection, compound pattern analysis, and LOOPType mapping.
 */

import type { SequenceStep, MotionData } from "../../core/types/sequence-engine-types.js";
import { gridPositionDeriver } from "../../core/positions/GridPositionDeriver.js";
import {
  HALF_POSITION_MAP,
  QUARTER_POSITION_MAP_CW,
  QUARTER_POSITION_MAP_CCW,
} from "../position-maps/circular-position-maps.js";
import {
  VERTICAL_MIRROR_POSITION_MAP,
  INVERTED_LETTER_MAP,
} from "../position-maps/strict-loop-position-maps.js";
import { LOOPType, SliceSize } from "../loop-types.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * LOOP component primitives that can be detected.
 * String union for the functional API.
 */
export type LOOPComponentId = "rotated" | "mirrored" | "flipped" | "swapped" | "inverted" | "rewound";

/**
 * Result of the functional LOOP detection (backward-compatible MCP API).
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
 * Enum version of LOOP components used by the class-based detector.
 */
export enum LOOPComponent {
  ROTATED = "rotated",
  MIRRORED = "mirrored",
  FLIPPED = "flipped",
  SWAPPED = "swapped",
  INVERTED = "inverted",
  REWOUND = "rewound",
}

/**
 * Compound pattern where different transformations occur at different intervals.
 */
export interface CompoundPattern {
  isCompound: true;
  quarteredTransformations: LOOPComponent[];
  halvedTransformations: LOOPComponent[];
  description: string;
}

/**
 * Confidence level for detection.
 * - strict: known LOOP type matched via components
 * - probable: components detected but combination not implemented
 * - accidental: circular but no LOOP pattern detected
 */
export type DetectionConfidence = "strict" | "probable" | "accidental";

/**
 * Rich detection result from the class-based detector.
 */
export interface RichLOOPDetectionResult {
  isCircular: boolean;
  loopType: LOOPType | null;
  sliceSize: SliceSize | null;
  confidence: DetectionConfidence;
  compoundPattern?: CompoundPattern;
}

// ============================================================================
// COMPONENT → LOOP TYPE MAPPING
// ============================================================================

/**
 * Maps a set of detected components to a LOOPType.
 * Returns null if the combination is unknown/unimplemented.
 */
function resolveComponentsToLOOPType(components: Set<LOOPComponent>): LOOPType | null {
  const has = (c: LOOPComponent) => components.has(c);
  const size = components.size;

  // Single-component types
  if (size === 1) {
    if (has(LOOPComponent.ROTATED)) return LOOPType.ROTATED;
    if (has(LOOPComponent.MIRRORED)) return LOOPType.MIRRORED;
    if (has(LOOPComponent.FLIPPED)) return LOOPType.FLIPPED;
    if (has(LOOPComponent.SWAPPED)) return LOOPType.SWAPPED;
    if (has(LOOPComponent.INVERTED)) return LOOPType.INVERTED;
    if (has(LOOPComponent.REWOUND)) return LOOPType.REWOUND;
  }

  // Two-component types
  if (size === 2) {
    if (has(LOOPComponent.SWAPPED) && has(LOOPComponent.INVERTED)) return LOOPType.SWAPPED_INVERTED;
    if (has(LOOPComponent.ROTATED) && has(LOOPComponent.INVERTED)) return LOOPType.ROTATED_INVERTED;
    if (has(LOOPComponent.MIRRORED) && has(LOOPComponent.SWAPPED)) return LOOPType.MIRRORED_SWAPPED;
    if (has(LOOPComponent.MIRRORED) && has(LOOPComponent.INVERTED)) return LOOPType.MIRRORED_INVERTED;
    if (has(LOOPComponent.ROTATED) && has(LOOPComponent.SWAPPED)) return LOOPType.ROTATED_SWAPPED;
    if (has(LOOPComponent.MIRRORED) && has(LOOPComponent.ROTATED)) return LOOPType.MIRRORED_ROTATED;
  }

  // Three-component types
  if (size === 3) {
    if (has(LOOPComponent.MIRRORED) && has(LOOPComponent.INVERTED) && has(LOOPComponent.ROTATED)) {
      return LOOPType.MIRRORED_INVERTED_ROTATED;
    }
  }

  // Four-component type
  if (size === 4) {
    if (
      has(LOOPComponent.MIRRORED) &&
      has(LOOPComponent.ROTATED) &&
      has(LOOPComponent.INVERTED) &&
      has(LOOPComponent.SWAPPED)
    ) {
      return LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED;
    }
  }

  return null;
}

// ============================================================================
// FUNCTIONAL API (backward-compatible with MCP server)
// ============================================================================

/**
 * Check if a sequence is circular (ends where it starts).
 */
export function isSequenceCircular(steps: SequenceStep[]): boolean {
  if (steps.length < 2) return false;

  const startPositionStep = steps.find((s) => (s.stepNumber ?? s.beatIndex) === 0);
  const lastStep = steps[steps.length - 1];

  if (!startPositionStep || !lastStep) return false;

  return startPositionStep.startPosition === lastStep.endPosition;
}

/**
 * Detect LOOP pattern from sequence steps (functional API).
 */
export function detectLOOPFromSteps(steps: SequenceStep[]): LOOPDetectionResult {
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

  const halfLength = letterSteps.length / 2;
  const components: LOOPComponentId[] = [];

  const rotatedMatches = checkRotatedPattern(letterSteps, halfLength);
  const mirroredMatches = checkMirroredPattern(letterSteps, halfLength);
  const swappedMatches = checkSwappedPattern(letterSteps, halfLength);
  const invertedMatches = checkInvertedPattern(letterSteps, halfLength);

  if (rotatedMatches.matched) components.push("rotated");
  if (mirroredMatches) components.push("mirrored");
  if (swappedMatches) components.push("swapped");
  if (invertedMatches) components.push("inverted");

  if (components.length === 0) {
    return {
      isCircular: true,
      components: [],
      isFreeform: true,
      rotationDirection: null,
      description: "Circular sequence with no detected pattern (freeform)",
    };
  }

  return {
    isCircular: true,
    components,
    isFreeform: false,
    rotationDirection: rotatedMatches.direction,
    description: `LOOP: ${components.join(" + ")}`,
  };
}

// ============================================================================
// CLASS-BASED DETECTOR (richer analysis, ported from app)
// ============================================================================

/**
 * Rich LOOP detector that supports quartered rotation, compound patterns,
 * and LOOPType resolution. Operates on SequenceStep arrays without
 * needing app-specific dependencies.
 */
export class LOOPDetectorClass {
  /**
   * Derive start position from a step's motion locations.
   */
  private deriveStartPosition(step: SequenceStep): string | null {
    const blue = step.blueMotion;
    const red = step.redMotion;
    if (!blue?.startLocation || !red?.startLocation) return null;

    try {
      return gridPositionDeriver.getGridPositionFromLocations(
        blue.startLocation,
        red.startLocation
      );
    } catch {
      return null;
    }
  }

  /**
   * Derive end position from a step's motion locations.
   */
  private deriveEndPosition(step: SequenceStep): string | null {
    const blue = step.blueMotion;
    const red = step.redMotion;
    if (!blue?.endLocation || !red?.endLocation) return null;

    try {
      return gridPositionDeriver.getGridPositionFromLocations(
        blue.endLocation,
        red.endLocation
      );
    } catch {
      return null;
    }
  }

  /**
   * Analyze a sequence and detect its LOOP type.
   * Takes an array of SequenceStep where step 0 is the start position
   * and subsequent steps are the beats.
   */
  detectLOOPType(steps: SequenceStep[]): RichLOOPDetectionResult {
    // Check circularity using the start-position step and last step
    const circular = isSequenceCircular(steps);

    if (!circular) {
      return { isCircular: false, loopType: null, sliceSize: null, confidence: "accidental" };
    }

    // Get beat steps only (exclude start position)
    const beats = steps.filter((s) => (s.stepNumber ?? s.beatIndex) > 0);

    if (beats.length < 2) {
      return { isCircular: true, loopType: null, sliceSize: null, confidence: "accidental" };
    }

    // Detect transformations at BOTH intervals independently
    const quarteredTransformations = this.detectAtQuartered(beats);
    const halvedTransformations = this.detectAtHalved(beats);

    // Check for compound pattern (transformations at different intervals)
    const compoundPattern = this.detectCompoundPattern(
      beats,
      quarteredTransformations,
      halvedTransformations
    );

    // Determine primary slice size and components for LOOP type
    let sliceSize: SliceSize | null = null;
    const detectedComponents = new Set<LOOPComponent>();

    if (compoundPattern) {
      sliceSize = SliceSize.QUARTERED;
      compoundPattern.quarteredTransformations.forEach((c) => detectedComponents.add(c));
      compoundPattern.halvedTransformations.forEach((c) => detectedComponents.add(c));
    } else {
      sliceSize = this.determineSliceSize(beats);

      if (this.detectsRotation(beats, sliceSize)) detectedComponents.add(LOOPComponent.ROTATED);
      if (this.detectsMirroring(beats)) detectedComponents.add(LOOPComponent.MIRRORED);
      if (this.detectsSwapping(beats)) detectedComponents.add(LOOPComponent.SWAPPED);
      if (this.detectsInversion(beats)) detectedComponents.add(LOOPComponent.INVERTED);
    }

    // Map components to LOOP type
    let loopType: LOOPType | null = null;
    let confidence: DetectionConfidence = "accidental";

    if (detectedComponents.size > 0) {
      loopType = resolveComponentsToLOOPType(detectedComponents);
      confidence = loopType ? "strict" : "probable";
    }

    return {
      isCircular: true,
      loopType,
      sliceSize: detectedComponents.has(LOOPComponent.ROTATED) ? sliceSize : null,
      confidence,
      compoundPattern: compoundPattern ?? undefined,
    };
  }

  // ============ SLICE SIZE DETERMINATION ============

  private determineSliceSize(steps: readonly SequenceStep[]): SliceSize {
    const length = steps.length;

    // Check quartered FIRST (more specific)
    if (length >= 4 && length % 4 === 0) {
      if (this.detectsQuarteredRotation(steps)) {
        return SliceSize.QUARTERED;
      }
    }

    return SliceSize.HALVED;
  }

  /**
   * Detect quartered (90 degree) rotation by comparing start positions of each quarter.
   */
  private detectsQuarteredRotation(steps: readonly SequenceStep[]): boolean {
    const length = steps.length;
    if (length < 4 || length % 4 !== 0) return false;

    const quarterLength = length / 4;

    const q1Start = steps[0] ? this.deriveStartPosition(steps[0]) : null;
    const q2Start = steps[quarterLength] ? this.deriveStartPosition(steps[quarterLength]!) : null;
    const q3Start = steps[quarterLength * 2] ? this.deriveStartPosition(steps[quarterLength * 2]!) : null;
    const q4Start = steps[quarterLength * 3] ? this.deriveStartPosition(steps[quarterLength * 3]!) : null;

    if (!q1Start || !q2Start || !q3Start || !q4Start) return false;

    const cwMatch =
      QUARTER_POSITION_MAP_CW[q1Start] === q2Start &&
      QUARTER_POSITION_MAP_CW[q2Start] === q3Start &&
      QUARTER_POSITION_MAP_CW[q3Start] === q4Start;

    const ccwMatch =
      QUARTER_POSITION_MAP_CCW[q1Start] === q2Start &&
      QUARTER_POSITION_MAP_CCW[q2Start] === q3Start &&
      QUARTER_POSITION_MAP_CCW[q3Start] === q4Start;

    return cwMatch || ccwMatch;
  }

  // ============ ROTATION DETECTION ============

  private detectsRotation(steps: readonly SequenceStep[], sliceSize: SliceSize): boolean {
    const length = steps.length;

    if (sliceSize === SliceSize.QUARTERED) {
      return this.detectsQuarteredRotation(steps);
    }

    if (sliceSize === SliceSize.HALVED && length >= 2 && length % 2 === 0) {
      const halfLength = length / 2;
      const h1Start = steps[0] ? this.deriveStartPosition(steps[0]) : null;
      const h2Start = steps[halfLength] ? this.deriveStartPosition(steps[halfLength]!) : null;

      if (!h1Start || !h2Start) return false;
      return HALF_POSITION_MAP[h1Start] === h2Start;
    }

    return false;
  }

  // ============ MIRROR DETECTION ============

  private detectsMirroring(steps: readonly SequenceStep[]): boolean {
    const length = steps.length;
    if (length < 2 || length % 2 !== 0) return false;

    const halfLength = length / 2;
    let validComparisons = 0;

    for (let i = 0; i < halfLength; i++) {
      const firstStep = steps[i]!;
      const secondStep = steps[halfLength + i]!;

      const firstEnd = this.deriveEndPosition(firstStep);
      const secondEnd = this.deriveEndPosition(secondStep);

      if (!firstEnd || !secondEnd) continue;
      validComparisons++;

      const expected = VERTICAL_MIRROR_POSITION_MAP[firstEnd];
      if (secondEnd !== expected) return false;
    }

    return validComparisons > 0;
  }

  // ============ SWAP DETECTION ============

  private detectsSwapping(steps: readonly SequenceStep[]): boolean {
    const length = steps.length;
    if (length < 2 || length % 2 !== 0) return false;

    const halfLength = length / 2;
    let swapCount = 0;
    let checkCount = 0;

    for (let i = 0; i < Math.min(halfLength, 4); i++) {
      const firstStep = steps[i]!;
      const secondStep = steps[halfLength + i]!;

      const firstBlue = firstStep.blueMotion;
      const firstRed = firstStep.redMotion;
      const secondBlue = secondStep.blueMotion;
      const secondRed = secondStep.redMotion;

      if (firstBlue && firstRed && secondBlue && secondRed) {
        // Skip pairs where both hands have the same motion type
        if (firstBlue.motionType === firstRed.motionType) continue;

        checkCount++;
        if (
          secondBlue.motionType === firstRed.motionType &&
          secondRed.motionType === firstBlue.motionType
        ) {
          swapCount++;
        }
      }
    }

    return checkCount > 0 && swapCount >= checkCount * 0.75;
  }

  // ============ INVERSION DETECTION ============

  private detectsInversion(steps: readonly SequenceStep[]): boolean {
    const length = steps.length;
    if (length < 2 || length % 2 !== 0) return false;

    const halfLength = length / 2;
    let validComparisons = 0;

    for (let i = 0; i < halfLength; i++) {
      const firstStep = steps[i]!;
      const secondStep = steps[halfLength + i]!;

      // Check letter inversion
      if (firstStep.letter && secondStep.letter) {
        validComparisons++;
        const expectedLetter = INVERTED_LETTER_MAP[firstStep.letter];
        if (expectedLetter && secondStep.letter !== expectedLetter) return false;
      }

      // Check motion type inversion (PRO <-> ANTI)
      if (firstStep.blueMotion && secondStep.blueMotion) {
        validComparisons++;
        if (!isMotionTypeInverted(firstStep.blueMotion.motionType, secondStep.blueMotion.motionType)) {
          return false;
        }
      }

      if (firstStep.redMotion && secondStep.redMotion) {
        validComparisons++;
        if (!isMotionTypeInverted(firstStep.redMotion.motionType, secondStep.redMotion.motionType)) {
          return false;
        }
      }
    }

    return validComparisons > 0;
  }

  // ============ COMPOUND PATTERN DETECTION ============

  private detectAtQuartered(steps: readonly SequenceStep[]): LOOPComponent[] {
    const components: LOOPComponent[] = [];
    const length = steps.length;

    if (length < 4 || length % 4 !== 0) return components;

    if (this.detectsQuarteredRotation(steps)) components.push(LOOPComponent.ROTATED);
    if (this.detectsSwappingAtInterval(steps, length / 4)) components.push(LOOPComponent.SWAPPED);
    if (this.detectsInversionAtInterval(steps, length / 4)) components.push(LOOPComponent.INVERTED);

    return components;
  }

  private detectAtHalved(steps: readonly SequenceStep[]): LOOPComponent[] {
    const components: LOOPComponent[] = [];
    const length = steps.length;

    if (length < 2 || length % 2 !== 0) return components;

    const halfLength = length / 2;

    // Check 180 degree rotation
    const h1Start = steps[0] ? this.deriveStartPosition(steps[0]) : null;
    const h2Start = steps[halfLength] ? this.deriveStartPosition(steps[halfLength]!) : null;
    if (h1Start && h2Start && HALF_POSITION_MAP[h1Start] === h2Start) {
      components.push(LOOPComponent.ROTATED);
    }

    if (this.detectsSwappingAtInterval(steps, halfLength)) components.push(LOOPComponent.SWAPPED);
    if (this.detectsInversionAtInterval(steps, halfLength)) components.push(LOOPComponent.INVERTED);
    if (this.detectsMirroring(steps)) components.push(LOOPComponent.MIRRORED);

    return components;
  }

  private detectsSwappingAtInterval(steps: readonly SequenceStep[], interval: number): boolean {
    const length = steps.length;
    if (interval <= 0 || interval >= length) return false;

    let swapCount = 0;
    let checkCount = 0;
    const pairsToCheck = Math.min(4, length - interval);

    for (let i = 0; i < pairsToCheck; i++) {
      const firstStep = steps[i]!;
      const secondStep = steps[i + interval]!;

      const firstBlue = firstStep.blueMotion;
      const firstRed = firstStep.redMotion;
      const secondBlue = secondStep.blueMotion;
      const secondRed = secondStep.redMotion;

      if (firstBlue && firstRed && secondBlue && secondRed) {
        if (firstBlue.motionType === firstRed.motionType) continue;

        checkCount++;
        if (
          secondBlue.motionType === firstRed.motionType &&
          secondRed.motionType === firstBlue.motionType
        ) {
          swapCount++;
        }
      }
    }

    return checkCount > 0 && swapCount >= checkCount * 0.75;
  }

  private detectsInversionAtInterval(steps: readonly SequenceStep[], interval: number): boolean {
    const length = steps.length;
    if (interval <= 0 || interval >= length) return false;

    const pairsToCheck = Math.min(4, length - interval);
    let validComparisons = 0;

    for (let i = 0; i < pairsToCheck; i++) {
      const firstStep = steps[i]!;
      const secondStep = steps[i + interval]!;

      if (firstStep.letter && secondStep.letter) {
        validComparisons++;
        const expectedLetter = INVERTED_LETTER_MAP[firstStep.letter];
        if (expectedLetter && secondStep.letter !== expectedLetter) return false;
      }

      if (firstStep.blueMotion && secondStep.blueMotion) {
        validComparisons++;
        if (!isMotionTypeInverted(firstStep.blueMotion.motionType, secondStep.blueMotion.motionType)) {
          return false;
        }
      }

      if (firstStep.redMotion && secondStep.redMotion) {
        validComparisons++;
        if (!isMotionTypeInverted(firstStep.redMotion.motionType, secondStep.redMotion.motionType)) {
          return false;
        }
      }
    }

    return validComparisons > 0;
  }

  private detectCompoundPattern(
    steps: readonly SequenceStep[],
    quarteredComponents: LOOPComponent[],
    halvedComponents: LOOPComponent[]
  ): CompoundPattern | null {
    const length = steps.length;
    if (length < 8 || length % 4 !== 0) return null;

    const hasQuarteredRotation = quarteredComponents.includes(LOOPComponent.ROTATED);
    const hasQuarteredSwap = quarteredComponents.includes(LOOPComponent.SWAPPED);
    const hasHalvedSwap = halvedComponents.includes(LOOPComponent.SWAPPED);
    const hasHalvedInversion = halvedComponents.includes(LOOPComponent.INVERTED);

    // Compound: rotation at quartered + swap ONLY at halved
    if (hasQuarteredRotation && !hasQuarteredSwap && hasHalvedSwap) {
      const dir = this.getQuarteredRotationDirection(steps);
      const rotDesc = dir === "ccw" ? "90 deg CCW Rotated" : "90 deg CW Rotated";
      return {
        isCompound: true,
        quarteredTransformations: [LOOPComponent.ROTATED],
        halvedTransformations: [LOOPComponent.SWAPPED],
        description: `${rotDesc} (quartered) + Swapped (halved)`,
      };
    }

    // Compound: rotation at quartered + inversion ONLY at halved
    if (hasQuarteredRotation && hasHalvedInversion) {
      const hasQuarteredInversion = quarteredComponents.includes(LOOPComponent.INVERTED);
      if (!hasQuarteredInversion) {
        const dir = this.getQuarteredRotationDirection(steps);
        const rotDesc = dir === "ccw" ? "90 deg CCW Rotated" : "90 deg CW Rotated";
        return {
          isCompound: true,
          quarteredTransformations: [LOOPComponent.ROTATED],
          halvedTransformations: [LOOPComponent.INVERTED],
          description: `${rotDesc} (quartered) + Inverted (halved)`,
        };
      }
    }

    // Compound: rotation at quartered + swap + inversion at halved
    if (hasQuarteredRotation && !hasQuarteredSwap && hasHalvedSwap && hasHalvedInversion) {
      const dir = this.getQuarteredRotationDirection(steps);
      const rotDesc = dir === "ccw" ? "90 deg CCW Rotated" : "90 deg CW Rotated";
      return {
        isCompound: true,
        quarteredTransformations: [LOOPComponent.ROTATED],
        halvedTransformations: [LOOPComponent.SWAPPED, LOOPComponent.INVERTED],
        description: `${rotDesc} (quartered) + Swapped + Inverted (halved)`,
      };
    }

    return null;
  }

  private getQuarteredRotationDirection(steps: readonly SequenceStep[]): "cw" | "ccw" | null {
    const length = steps.length;
    if (length < 4 || length % 4 !== 0) return null;

    const quarterLength = length / 4;
    const q1Start = steps[0] ? this.deriveStartPosition(steps[0]) : null;
    const q2Start = steps[quarterLength] ? this.deriveStartPosition(steps[quarterLength]!) : null;

    if (!q1Start || !q2Start) return null;
    if (QUARTER_POSITION_MAP_CW[q1Start] === q2Start) return "cw";
    if (QUARTER_POSITION_MAP_CCW[q1Start] === q2Start) return "ccw";
    return null;
  }
}

// ============================================================================
// SHARED HELPERS (used by both functional and class-based APIs)
// ============================================================================

/**
 * Check if two motion types are inverted pairs.
 * PRO <-> ANTI are inverted. STATIC, FLOAT, DASH are self-inverted.
 */
function isMotionTypeInverted(type1: string, type2: string): boolean {
  const t1 = type1.toLowerCase();
  const t2 = type2.toLowerCase();

  if ((t1 === "pro" && t2 === "anti") || (t1 === "anti" && t2 === "pro")) return true;

  if (t1 === t2) {
    return ["static", "float", "dash"].includes(t1);
  }

  return false;
}

// ============================================================================
// FUNCTIONAL PATTERN CHECKERS (used by detectLOOPFromSteps)
// ============================================================================

function checkRotatedPattern(
  steps: SequenceStep[],
  halfLength: number
): { matched: boolean; direction: "cw" | "ccw" | null } {
  let matchCount = 0;

  for (let i = 0; i < halfLength; i++) {
    const step1 = steps[i];
    const step2 = steps[i + halfLength];
    if (!step1 || !step2) continue;

    const expectedPosition = HALF_POSITION_MAP[step1.endPosition];
    if (expectedPosition === step2.endPosition) {
      matchCount++;
    }
  }

  const threshold = Math.floor(halfLength * 0.75);
  const matched = matchCount >= threshold;

  let direction: "cw" | "ccw" | null = null;
  if (matched && steps[0]) {
    const blueRotDir = steps[0].blueMotion?.rotationDirection;
    if (blueRotDir === "cw" || blueRotDir === "ccw") {
      direction = blueRotDir;
    }
  }

  return { matched, direction };
}

function checkMirroredPattern(steps: SequenceStep[], halfLength: number): boolean {
  let matchCount = 0;

  for (let i = 0; i < halfLength; i++) {
    const step1 = steps[i];
    const step2 = steps[i + halfLength];
    if (!step1 || !step2) continue;

    const expectedPosition = VERTICAL_MIRROR_POSITION_MAP[step1.endPosition];
    if (expectedPosition === step2.endPosition) {
      matchCount++;
    }
  }

  const threshold = Math.floor(halfLength * 0.75);
  return matchCount >= threshold;
}

function checkSwappedPattern(steps: SequenceStep[], halfLength: number): boolean {
  let matchCount = 0;

  for (let i = 0; i < halfLength; i++) {
    const step1 = steps[i];
    const step2 = steps[i + halfLength];
    if (!step1 || !step2) continue;

    const motionSwapped =
      step1.blueMotion?.startLocation === step2.redMotion?.startLocation &&
      step1.blueMotion?.endLocation === step2.redMotion?.endLocation &&
      step1.redMotion?.startLocation === step2.blueMotion?.startLocation &&
      step1.redMotion?.endLocation === step2.blueMotion?.endLocation;

    if (motionSwapped) {
      matchCount++;
    }
  }

  const threshold = Math.floor(halfLength * 0.75);
  return matchCount >= threshold;
}

function checkInvertedPattern(steps: SequenceStep[], halfLength: number): boolean {
  let matchCount = 0;

  for (let i = 0; i < halfLength; i++) {
    const step1 = steps[i];
    const step2 = steps[i + halfLength];
    if (!step1 || !step2) continue;

    const blueInverted =
      (step1.blueMotion?.rotationDirection === "cw" && step2.blueMotion?.rotationDirection === "ccw") ||
      (step1.blueMotion?.rotationDirection === "ccw" && step2.blueMotion?.rotationDirection === "cw");

    const redInverted =
      (step1.redMotion?.rotationDirection === "cw" && step2.redMotion?.rotationDirection === "ccw") ||
      (step1.redMotion?.rotationDirection === "ccw" && step2.redMotion?.rotationDirection === "cw");

    if (blueInverted || redInverted) {
      matchCount++;
    }
  }

  const threshold = Math.floor(halfLength * 0.75);
  return matchCount >= threshold;
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const loopDetectorClass = new LOOPDetectorClass();
