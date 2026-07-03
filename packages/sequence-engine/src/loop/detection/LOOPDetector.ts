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
import { LOOPType, Period } from "../loop-types.js";
import {
  LOOPComponent,
  type LOOPSpec,
  type PropLOOPSpec,
  type ComponentSpec,
} from "../loop-spec.js";

export { LOOPComponent };

export type LOOPComponentId = "rotated" | "mirrored" | "flipped" | "swapped" | "inverted" | "rewound";

export interface LOOPDetectionResult {
  isCircular: boolean;
  components: LOOPComponentId[];
  isFreeform: boolean;
  rotationDirection: "cw" | "ccw" | null;
  description: string;
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
  spec: LOOPSpec | null;
  loopType: LOOPType | null;
  period: Period | null;
  confidence: DetectionConfidence;
  compoundPattern?: CompoundPattern;
}


/**
 * Derive a backward-compatible LOOPType from detected components.
 * Returns null if the combination has no corresponding LOOPType.
 */
function deriveLoopTypeFromComponents(components: Set<LOOPComponent>): LOOPType | null {
  if (components.size === 0) return null;
  const has = (c: LOOPComponent) => components.has(c);
  const size = components.size;

  if (size === 1) {
    if (has(LOOPComponent.ROTATED)) return LOOPType.ROTATED;
    if (has(LOOPComponent.MIRRORED)) return LOOPType.MIRRORED;
    if (has(LOOPComponent.FLIPPED)) return LOOPType.FLIPPED;
    if (has(LOOPComponent.SWAPPED)) return LOOPType.SWAPPED;
    if (has(LOOPComponent.INVERTED)) return LOOPType.INVERTED;
    if (has(LOOPComponent.REWOUND)) return LOOPType.REWOUND;
  }
  if (size === 2) {
    if (has(LOOPComponent.SWAPPED) && has(LOOPComponent.INVERTED)) return LOOPType.SWAPPED_INVERTED;
    if (has(LOOPComponent.ROTATED) && has(LOOPComponent.INVERTED)) return LOOPType.ROTATED_INVERTED;
    if (has(LOOPComponent.MIRRORED) && has(LOOPComponent.SWAPPED)) return LOOPType.MIRRORED_SWAPPED;
    if (has(LOOPComponent.MIRRORED) && has(LOOPComponent.INVERTED)) return LOOPType.MIRRORED_INVERTED;
    if (has(LOOPComponent.ROTATED) && has(LOOPComponent.SWAPPED)) return LOOPType.ROTATED_SWAPPED;
    if (has(LOOPComponent.MIRRORED) && has(LOOPComponent.ROTATED)) return LOOPType.MIRRORED_ROTATED;
  }
  if (size === 3) {
    if (has(LOOPComponent.MIRRORED) && has(LOOPComponent.INVERTED) && has(LOOPComponent.ROTATED))
      return LOOPType.MIRRORED_INVERTED_ROTATED;
    if (has(LOOPComponent.MIRRORED) && has(LOOPComponent.ROTATED) && has(LOOPComponent.SWAPPED))
      return LOOPType.MIRRORED_ROTATED_SWAPPED;
  }
  if (size === 4) {
    if (has(LOOPComponent.MIRRORED) && has(LOOPComponent.ROTATED) && has(LOOPComponent.INVERTED) && has(LOOPComponent.SWAPPED))
      return LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED;
  }
  return null;
}


export function isSequenceCircular(steps: SequenceStep[]): boolean {
  if (steps.length < 2) return false;

  const startPositionStep = steps.find((s) => (s.stepNumber ?? s.stepNumber) === 0);
  const lastStep = steps[steps.length - 1];

  if (!startPositionStep || !lastStep) return false;

  return startPositionStep.startPosition === lastStep.endPosition;
}

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
  const letterSteps = steps.filter((s) => (s.stepNumber ?? s.stepNumber) > 0);

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


/**
 * Rich LOOP detector that supports quartered rotation, compound patterns,
 * and LOOPType resolution. Operates on SequenceStep arrays without
 * needing app-specific dependencies.
 */
export class LOOPDetectorClass {
  private deriveStartPosition(step: SequenceStep): string | null {
    const blue = step.motions.blue;
    const red = step.motions.red;
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

  private deriveEndPosition(step: SequenceStep): string | null {
    const blue = step.motions.blue;
    const red = step.motions.red;
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

  private buildLOOPSpec(
    components: Set<LOOPComponent>,
    period: Period | null,
    compoundPattern?: CompoundPattern,
  ): LOOPSpec | null {
    if (components.size === 0) return null;

    const periodNum = period ? (period === Period.QUARTERED ? 4 : 2) : 2;
    const compMap = new Map<LOOPComponent, ComponentSpec>();

    for (const comp of components) {
      const canonical = comp;
      compMap.set(canonical, { period: periodNum });
    }

    if (compoundPattern) {
      // Quartered transformations get period 4, halved transformations get period 2
      for (const comp of compoundPattern.quarteredTransformations) {
        const canonical = comp;
        if (compMap.has(canonical)) {
          compMap.set(canonical, { period: 4 });
        }
      }
      for (const comp of compoundPattern.halvedTransformations) {
        const canonical = comp;
        if (compMap.has(canonical)) {
          compMap.set(canonical, { period: 2 });
        }
      }
    }

    const prop: PropLOOPSpec = { components: compMap };
    return { blue: prop, red: prop };
  }

  /**
   * Takes an array of SequenceStep where step 0 is the start position
   * and subsequent steps are the letter steps.
   */
  detectLOOPType(steps: SequenceStep[]): RichLOOPDetectionResult {
    // Check circularity using the start-position step and last step
    const circular = isSequenceCircular(steps);

    if (!circular) {
      return { isCircular: false, spec: null, loopType: null, period: null, confidence: "accidental" };
    }

    // Get letter steps only (exclude start position)
    const letterSteps = steps.filter((s) => (s.stepNumber ?? s.stepNumber) > 0);

    if (letterSteps.length < 2) {
      return { isCircular: true, spec: null, loopType: null, period: null, confidence: "accidental" };
    }

    // Detect transformations at BOTH intervals independently
    const quarteredTransformations = this.detectAtQuartered(letterSteps);
    const halvedTransformations = this.detectAtHalved(letterSteps);

    // Check for compound pattern (transformations at different intervals)
    const compoundPattern = this.detectCompoundPattern(
      letterSteps,
      quarteredTransformations,
      halvedTransformations
    );

    // Determine primary period and components for LOOP type
    let period: Period | null = null;
    const detectedComponents = new Set<LOOPComponent>();

    if (compoundPattern) {
      period = this.detectsQuarteredRotation(letterSteps) ? Period.QUARTERED : Period.HALVED;
      compoundPattern.quarteredTransformations.forEach((c) => detectedComponents.add(c));
      compoundPattern.halvedTransformations.forEach((c) => detectedComponents.add(c));
    } else {
      period = this.determinePeriod(letterSteps);

      if (this.detectsRotation(letterSteps, period)) detectedComponents.add(LOOPComponent.ROTATED);
      if (this.detectsMirroring(letterSteps)) detectedComponents.add(LOOPComponent.MIRRORED);
      if (this.detectsSwapping(letterSteps)) detectedComponents.add(LOOPComponent.SWAPPED);
      if (this.detectsInversion(letterSteps)) detectedComponents.add(LOOPComponent.INVERTED);
    }

    // Map components to LOOP type
    let loopType: LOOPType | null = null;
    let confidence: DetectionConfidence = "accidental";

    if (detectedComponents.size > 0) {
      loopType = deriveLoopTypeFromComponents(detectedComponents);
      confidence = loopType ? "strict" : "probable";
    }

    return {
      isCircular: true,
      spec: this.buildLOOPSpec(detectedComponents, period, compoundPattern ?? undefined),
      loopType,
      period: detectedComponents.has(LOOPComponent.ROTATED) ? period : null,
      confidence,
      compoundPattern: compoundPattern ?? undefined,
    };
  }

  // ============ PERIOD DETERMINATION ============

  private determinePeriod(steps: readonly SequenceStep[]): Period {
    const length = steps.length;

    // Check quartered FIRST (more specific)
    if (length >= 4 && length % 4 === 0) {
      if (this.detectsQuarteredRotation(steps)) {
        return Period.QUARTERED;
      }
    }

    return Period.HALVED;
  }

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

  private detectsRotation(steps: readonly SequenceStep[], period: Period): boolean {
    const length = steps.length;

    if (period === Period.QUARTERED) {
      return this.detectsQuarteredRotation(steps);
    }

    if (period === Period.HALVED && length >= 2 && length % 2 === 0) {
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

      const firstBlue = firstStep.motions.blue;
      const firstRed = firstStep.motions.red;
      const secondBlue = secondStep.motions.blue;
      const secondRed = secondStep.motions.red;

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
        const expectedLetter = INVERTED_LETTER_MAP[firstStep.letter ?? ""];
        if (expectedLetter && secondStep.letter !== expectedLetter) return false;
      }

      // Check motion type inversion (PRO <-> ANTI)
      if (firstStep.motions.blue && secondStep.motions.blue) {
        validComparisons++;
        if (!isMotionTypeInverted(firstStep.motions.blue.motionType, secondStep.motions.blue.motionType)) {
          return false;
        }
      }

      if (firstStep.motions.red && secondStep.motions.red) {
        validComparisons++;
        if (!isMotionTypeInverted(firstStep.motions.red.motionType, secondStep.motions.red.motionType)) {
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

      const firstBlue = firstStep.motions.blue;
      const firstRed = firstStep.motions.red;
      const secondBlue = secondStep.motions.blue;
      const secondRed = secondStep.motions.red;

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
        const expectedLetter = INVERTED_LETTER_MAP[firstStep.letter ?? ""];
        if (expectedLetter && secondStep.letter !== expectedLetter) return false;
      }

      if (firstStep.motions.blue && secondStep.motions.blue) {
        validComparisons++;
        if (!isMotionTypeInverted(firstStep.motions.blue.motionType, secondStep.motions.blue.motionType)) {
          return false;
        }
      }

      if (firstStep.motions.red && secondStep.motions.red) {
        validComparisons++;
        if (!isMotionTypeInverted(firstStep.motions.red.motionType, secondStep.motions.red.motionType)) {
          return false;
        }
      }
    }

    return validComparisons > 0;
  }

  private detectsInnerHalvedRotation(steps: readonly SequenceStep[]): boolean {
    const length = steps.length;
    if (length < 8 || length % 4 !== 0) return false;

    const quarterLength = length / 4;
    const q1Start = steps[0] ? this.deriveStartPosition(steps[0]) : null;
    const q2Start = steps[quarterLength] ? this.deriveStartPosition(steps[quarterLength]!) : null;

    if (!q1Start || !q2Start) return false;
    return HALF_POSITION_MAP[q1Start] === q2Start;
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

    // Compound: inner halved rotation + outer mirrored/swapped
    if (!hasQuarteredRotation && this.detectsInnerHalvedRotation(steps)) {
      const outerTransformations = halvedComponents.filter(
        (c) => c !== LOOPComponent.ROTATED
      );
      if (outerTransformations.length > 0) {
        return {
          isCompound: true,
          quarteredTransformations: [LOOPComponent.ROTATED],
          halvedTransformations: outerTransformations,
          description: `180° Inner Rotated (halved) + ${outerTransformations.join(" + ")} (outer halved)`,
        };
      }
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


/**
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


function checkRotatedPattern(
  steps: SequenceStep[],
  halfLength: number
): { matched: boolean; direction: "cw" | "ccw" | null } {
  let matchCount = 0;

  for (let i = 0; i < halfLength; i++) {
    const step1 = steps[i];
    const step2 = steps[i + halfLength];
    if (!step1 || !step2) continue;

    const expectedPosition = HALF_POSITION_MAP[step1.endPosition ?? ""];
    if (expectedPosition === step2.endPosition) {
      matchCount++;
    }
  }

  const threshold = Math.floor(halfLength * 0.75);
  const matched = matchCount >= threshold;

  let direction: "cw" | "ccw" | null = null;
  if (matched && steps[0]) {
    const blueRotDir = steps[0].motions.blue?.rotationDirection;
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

    const expectedPosition = VERTICAL_MIRROR_POSITION_MAP[step1.endPosition ?? ""];
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
      step1.motions.blue?.startLocation === step2.motions.red?.startLocation &&
      step1.motions.blue?.endLocation === step2.motions.red?.endLocation &&
      step1.motions.red?.startLocation === step2.motions.blue?.startLocation &&
      step1.motions.red?.endLocation === step2.motions.blue?.endLocation;

    if (motionSwapped) {
      matchCount++;
    }
  }

  const threshold = Math.floor(halfLength * 0.75);
  return matchCount >= threshold;
}

/**
 * Inversion is signalled by motion TYPE flipping PRO↔ANTI — never by rotation
 * direction. Only the INVERTED transform touches motion type; MIRROR, FLIP,
 * ROTATE, and SWAP leave it alone. Rotation direction is unreliable: MIRROR and
 * FLIP already flip it, so a composite like mirrored+inverted PRESERVES rotation
 * direction (the two flips cancel). Keying off a rotation-direction flip made
 * this detector miss inversion on every mirrored+inverted / flipped+inverted
 * loop and report a bare "mirrored" instead — matching the class detector's
 * motion-type check fixes that.
 *
 * A pair contributes a genuine flip when a PRO/ANTI motion becomes its opposite.
 * A PRO/ANTI motion that stays the same (or drops to static/dash) contradicts
 * inversion. STATIC/DASH/FLOAT carry no PRO/ANTI signal and are neutral. The
 * pattern is inverted only when at least one genuine flip is seen and nothing
 * contradicts it.
 */
function checkInvertedPattern(steps: SequenceStep[], halfLength: number): boolean {
  let genuineFlips = 0;
  let contradictions = 0;

  for (let i = 0; i < halfLength; i++) {
    const step1 = steps[i];
    const step2 = steps[i + halfLength];
    if (!step1 || !step2) continue;

    for (const color of ["blue", "red"] as const) {
      const t1 = step1.motions[color]?.motionType;
      const t2 = step2.motions[color]?.motionType;
      if (!t1 || !t2) continue;

      const proAnti1 = t1 === "pro" || t1 === "anti";
      const proAnti2 = t2 === "pro" || t2 === "anti";

      if (proAnti1 && proAnti2) {
        if (t1 !== t2) genuineFlips++;
        else contradictions++;
      } else if (proAnti1 !== proAnti2) {
        contradictions++;
      }
    }
  }

  return genuineFlips > 0 && contradictions === 0;
}


export const loopDetectorClass = new LOOPDetectorClass();
