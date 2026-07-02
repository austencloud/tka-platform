/**
 * LOOP Detection Service Implementation
 *
 * Analyzes sequences to detect their Linked Orbital Offset Pattern (LOOP) type.
 * This is the reverse of LOOP generation - given a sequence, determine what
 * LOOP type (if any) it follows.
 *
 * Algorithm: Component-based detection
 * 1. Check if sequence is circular (end matches start)
 * 2. Detect individual components (ROTATED, MIRRORED, SWAPPED, INVERTED)
 * 3. Map detected components to LOOPType
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepLike } from "$lib/shared/foundation/domain/models/step-like";
import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
import { Period } from "$lib/shared/foundation/domain/models/generation/circular-models";
import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import type {
  ILOOPDetector,
  LOOPDetectionResult,
  CompoundPattern,
} from "$lib/shared/create/services/ILOOPDetector";
import { isSeamlesslyLoopable } from "$lib/shared/foundation/services/sequence-loopability-checker";
import { generateLOOPType } from "$lib/shared/create/services/loop-type-utils";
import {
  QUARTER_POSITION_MAP_CW,
  QUARTER_POSITION_MAP_CCW,
  HALF_POSITION_MAP,
} from "$lib/shared/foundation/domain/models/generation/circular-position-maps";
import {
  VERTICAL_MIRROR_POSITION_MAP,
  INVERTED_LETTER_MAP,
} from "$lib/shared/create/domain/strict-loop-position-maps";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import {
  MotionColor,
  MotionType,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
// Canonical MotionType is a superset of the app enum (adds "shift"); StepLike
// motions carry the canonical type, so type-level comparisons use it.
import type { MotionType as CanonicalMotionType } from "@tka/tka-types";

export class LOOPDetector implements ILOOPDetector {

  // ============ POSITION DERIVATION ============

  /**
   * Derive start position from motion locations
   * Position is determined by blue and red hand start locations
   */
  private deriveStartPosition(step: StepLike): GridPosition | null {
    const blueMotion = step.motions?.[MotionColor.BLUE];
    const redMotion = step.motions?.[MotionColor.RED];

    if (!blueMotion?.startLocation || !redMotion?.startLocation) {
      return null;
    }

    try {
      return getGridPositionFromLocations(
        blueMotion.startLocation as GridLocation,
        redMotion.startLocation as GridLocation
      );
    } catch {
      // Unknown location combination
      return null;
    }
  }

  /**
   * Derive end position from motion locations
   * Position is determined by blue and red hand end locations
   */
  private deriveEndPosition(step: StepLike): GridPosition | null {
    const blueMotion = step.motions?.[MotionColor.BLUE];
    const redMotion = step.motions?.[MotionColor.RED];

    if (!blueMotion?.endLocation || !redMotion?.endLocation) {
      return null;
    }

    try {
      return getGridPositionFromLocations(
        blueMotion.endLocation as GridLocation,
        redMotion.endLocation as GridLocation
      );
    } catch {
      // Unknown location combination
      return null;
    }
  }

  /**
   * Analyze a sequence and detect its LOOP type
   */
  detectLOOPType(sequence: SequenceData): LOOPDetectionResult {
    // Step 1: Check basic circularity
    const isCircular = this.isCircular(sequence);

    if (!isCircular) {
      return {
        isCircular: false,
        loopType: null,
        period: null,
        confidence: "accidental",
      };
    }

    const steps = sequence.steps;

    // Too short to be a LOOP
    if (!steps || steps.length < 2) {
      return {
        isCircular: true,
        loopType: null,
        period: null,
        confidence: "accidental",
      };
    }

    // Step 2: Detect transformations at BOTH intervals independently
    const quarteredTransformations = this.detectAtQuartered(steps);
    const halvedTransformations = this.detectAtHalved(steps);

    // Step 3: Check for compound pattern (transformations at different intervals)
    const compoundPattern = this.detectCompoundPattern(
      steps,
      quarteredTransformations,
      halvedTransformations
    );

    // Step 4: Determine primary slice size and components for LOOP type
    let period: Period | null = null;
    const detectedComponents = new Set<LOOPComponent>();

    if (compoundPattern) {
      // For existing quartered-rotation compounds: period = QUARTERED.
      // For inner-halved-rotation compounds: period = HALVED.
      period = this.detectsQuarteredRotation(steps) ? Period.QUARTERED : Period.HALVED;
      compoundPattern.quarteredTransformations.forEach((c) =>
        detectedComponents.add(c as LOOPComponent)
      );
      compoundPattern.halvedTransformations.forEach((c) =>
        detectedComponents.add(c as LOOPComponent)
      );
    } else {
      // Simple pattern: use traditional detection
      period = this.determinePeriod(steps);

      if (this.detectsRotation(steps, period)) {
        detectedComponents.add(LOOPComponent.ROTATED);
      }
      if (this.detectsMirroring(steps)) {
        detectedComponents.add(LOOPComponent.MIRRORED);
      }
      if (this.detectsSwapping(steps)) {
        detectedComponents.add(LOOPComponent.SWAPPED);
      }
      if (this.detectsInversion(steps)) {
        detectedComponents.add(LOOPComponent.INVERTED);
      }
    }

    // Step 5: Map components to LOOP type
    let loopType: LOOPType | null = null;
    let confidence: "strict" | "probable" | "accidental" = "accidental";

    if (detectedComponents.size > 0) {
      loopType = generateLOOPType(detectedComponents);
      confidence = "strict";
    }

    return {
      isCircular: true,
      loopType,
      period: detectedComponents.has(LOOPComponent.ROTATED)
        ? period
        : null,
      confidence,
      compoundPattern: compoundPattern ?? undefined,
    };
  }

  /**
   * Batch detect LOOP types for multiple sequences
   */
  async batchDetect(sequences: SequenceData[]): Promise<LOOPDetectionResult[]> {
    const results: LOOPDetectionResult[] = [];
    const CHUNK_SIZE = 50;

    for (let i = 0; i < sequences.length; i += CHUNK_SIZE) {
      const chunk = sequences.slice(i, i + CHUNK_SIZE);
      const chunkResults = chunk.map((seq) => this.detectLOOPType(seq));
      results.push(...chunkResults);

      // Yield to event loop between chunks
      if (i + CHUNK_SIZE < sequences.length) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return results;
  }

  /**
   * Quick check if a sequence is circular
   */
  isCircular(sequence: SequenceData): boolean {
    return isSeamlesslyLoopable(sequence);
  }

  /**
   * Determine slice size based on sequence length and position patterns
   *
   * Key insight: For quartered rotation, compare START positions of first step
   * of each quarter. If q1->q2->q3->q4 follows 90 degree rotation, it's quartered.
   */
  private determinePeriod(steps: readonly StepLike[]): Period {
    const length = steps.length;

    // Check quartered FIRST (more specific)
    if (length >= 4 && length % 4 === 0) {
      if (this.detectsQuarteredRotation(steps)) {
        return Period.QUARTERED;
      }
    }

    // Default to halved
    return Period.HALVED;
  }

  /**
   * Detect quartered (90 degree) rotation by comparing START positions of each quarter
   */
  private detectsQuarteredRotation(steps: readonly StepLike[]): boolean {
    const length = steps.length;
    if (length < 4 || length % 4 !== 0) return false;

    const quarterLength = length / 4;

    // Derive start positions of first step of each quarter from motion locations
    const step1 = steps[0];
    const step2 = steps[quarterLength];
    const step3 = steps[quarterLength * 2];
    const step4 = steps[quarterLength * 3];

    const q1Start = step1 ? this.deriveStartPosition(step1) : null;
    const q2Start = step2 ? this.deriveStartPosition(step2) : null;
    const q3Start = step3 ? this.deriveStartPosition(step3) : null;
    const q4Start = step4 ? this.deriveStartPosition(step4) : null;

    if (!q1Start || !q2Start || !q3Start || !q4Start) return false;

    // Check clockwise rotation: q1 -> q2 -> q3 -> q4 follows QUARTER_CW
    const cwMatch =
      QUARTER_POSITION_MAP_CW[q1Start] === q2Start &&
      QUARTER_POSITION_MAP_CW[q2Start] === q3Start &&
      QUARTER_POSITION_MAP_CW[q3Start] === q4Start;

    // Check counter-clockwise rotation
    const ccwMatch =
      QUARTER_POSITION_MAP_CCW[q1Start] === q2Start &&
      QUARTER_POSITION_MAP_CCW[q2Start] === q3Start &&
      QUARTER_POSITION_MAP_CCW[q3Start] === q4Start;

    return cwMatch || ccwMatch;
  }

  /**
   * Detect if sequence follows rotation transformation
   *
   * For halved: Compare START position of first step vs START position of half step
   * For quartered: Already detected in determinePeriod via detectsQuarteredRotation
   */
  private detectsRotation(
    steps: readonly StepLike[],
    period: Period
  ): boolean {
    const length = steps.length;

    // Quartered rotation is detected via slice size determination
    if (period === Period.QUARTERED) {
      return this.detectsQuarteredRotation(steps);
    }

    // Halved rotation: compare START positions of first step of each half
    if (period === Period.HALVED && length >= 2 && length % 2 === 0) {
      const halfLength = length / 2;
      // Derive positions from motion locations
      const h1Start = steps[0] ? this.deriveStartPosition(steps[0]) : null;
      const h2Start = steps[halfLength]
        ? this.deriveStartPosition(steps[halfLength])
        : null;

      if (!h1Start || !h2Start) return false;

      // Check if h2 start is 180 degree rotated from h1 start
      return HALF_POSITION_MAP[h1Start] === h2Start;
    }

    return false;
  }

  /**
   * Detect if sequence follows mirroring transformation
   */
  private detectsMirroring(steps: readonly StepLike[]): boolean {
    const length = steps.length;
    if (length < 2 || length % 2 !== 0) return false;

    const halfLength = length / 2;
    let validComparisons = 0;

    // Check if position pattern matches vertical mirror
    for (let i = 0; i < halfLength; i++) {
      const firstStep = steps[i];
      const secondStep = steps[halfLength + i];

      // Derive end positions from motion locations
      const firstEndPosition = firstStep
        ? this.deriveEndPosition(firstStep)
        : null;
      const secondEndPosition = secondStep
        ? this.deriveEndPosition(secondStep)
        : null;

      if (!firstEndPosition || !secondEndPosition) continue;

      validComparisons++;

      const expectedPosition = VERTICAL_MIRROR_POSITION_MAP[firstEndPosition];

      if (secondEndPosition !== expectedPosition) {
        return false;
      }
    }

    // Only return true if we actually made at least one valid comparison
    return validComparisons > 0;
  }

  /**
   * Detect if sequence follows swapping transformation (blue/red exchange)
   *
   * Key insight: Only detect swap if hands have different motion types.
   * If both hands have the same motion type, swapping is meaningless
   * and would cause false positives.
   */
  private detectsSwapping(steps: readonly StepLike[]): boolean {
    const length = steps.length;
    if (length < 2 || length % 2 !== 0) return false;

    const halfLength = length / 2;
    let swapCount = 0;
    let checkCount = 0;

    for (let i = 0; i < Math.min(halfLength, 4); i++) {
      const firstStep = steps[i];
      const secondStep = steps[halfLength + i];

      const firstBlue = firstStep?.motions?.[MotionColor.BLUE];
      const firstRed = firstStep?.motions?.[MotionColor.RED];
      const secondBlue = secondStep?.motions?.[MotionColor.BLUE];
      const secondRed = secondStep?.motions?.[MotionColor.RED];

      if (firstBlue && firstRed && secondBlue && secondRed) {
        // Skip pairs where both hands have the same motion type -
        // swapping two identical types is trivially true and meaningless.
        // When both hands are pro, "secondBlue.type === firstRed.type" is
        // always true regardless of what the hands are actually doing.
        if (firstBlue.motionType === firstRed.motionType) continue;

        checkCount++;

        // Second blue should match first red, second red should match first blue
        if (
          secondBlue.motionType === firstRed.motionType &&
          secondRed.motionType === firstBlue.motionType
        ) {
          swapCount++;
        }
      }
    }

    // Only report swap if we found meaningful pairs (different motion types)
    // and the majority show the swap pattern
    return checkCount > 0 && swapCount >= checkCount * 0.75;
  }

  /**
   * Detect if sequence follows inversion transformation (inverted motion types)
   */
  private detectsInversion(steps: readonly StepLike[]): boolean {
    const length = steps.length;
    if (length < 2 || length % 2 !== 0) return false;

    const halfLength = length / 2;
    let validComparisons = 0;

    for (let i = 0; i < halfLength; i++) {
      const firstStep = steps[i];
      const secondStep = steps[halfLength + i];

      if (!firstStep || !secondStep) continue;

      // Check letter inversion if both have letters
      if (firstStep.letter && secondStep.letter) {
        validComparisons++;
        const expectedLetter = INVERTED_LETTER_MAP[firstStep.letter];
        if (expectedLetter && secondStep.letter !== expectedLetter) {
          return false;
        }
      }

      // Check motion type inversion (PRO <-> ANTI)
      const firstBlue = firstStep.motions?.[MotionColor.BLUE];
      const secondBlue = secondStep.motions?.[MotionColor.BLUE];
      const firstRed = firstStep.motions?.[MotionColor.RED];
      const secondRed = secondStep.motions?.[MotionColor.RED];

      if (firstBlue && secondBlue) {
        validComparisons++;
        if (
          !this.isMotionTypeInverted(
            firstBlue.motionType,
            secondBlue.motionType
          )
        ) {
          return false;
        }
      }

      if (firstRed && secondRed) {
        validComparisons++;
        if (
          !this.isMotionTypeInverted(firstRed.motionType, secondRed.motionType)
        ) {
          return false;
        }
      }
    }

    // Only return true if we actually made at least one valid comparison
    return validComparisons > 0;
  }

  /**
   * Check if two motion types are inverted pairs
   */
  private isMotionTypeInverted(type1: CanonicalMotionType, type2: CanonicalMotionType): boolean {
    // PRO and ANTI are inverted pairs
    if (type1 === MotionType.PRO && type2 === MotionType.ANTI) return true;
    if (type1 === MotionType.ANTI && type2 === MotionType.PRO) return true;

    // STATIC, FLOAT, DASH are self-inverted
    if (type1 === type2) {
      const selfInverted: CanonicalMotionType[] = [
        MotionType.STATIC,
        MotionType.FLOAT,
        MotionType.DASH,
      ];
      return selfInverted.includes(type1);
    }

    return false;
  }

  // ============ COMPOUND PATTERN DETECTION ============

  /**
   * Detect transformations at quartered interval (90 degree rotation period)
   */
  private detectAtQuartered(steps: readonly StepLike[]): LOOPComponent[] {
    const components: LOOPComponent[] = [];
    const length = steps.length;

    if (length < 4 || length % 4 !== 0) return components;

    // Check for 90 degree rotation at quartered interval
    if (this.detectsQuarteredRotation(steps)) {
      components.push(LOOPComponent.ROTATED);
    }

    // Check for swap at quartered interval (every quarter)
    if (this.detectsSwappingAtInterval(steps, length / 4)) {
      components.push(LOOPComponent.SWAPPED);
    }

    // Check for inversion at quartered interval
    if (this.detectsInversionAtInterval(steps, length / 4)) {
      components.push(LOOPComponent.INVERTED);
    }

    return components;
  }

  /**
   * Detect transformations at halved interval (180 degree rotation period)
   */
  private detectAtHalved(steps: readonly StepLike[]): LOOPComponent[] {
    const components: LOOPComponent[] = [];
    const length = steps.length;

    if (length < 2 || length % 2 !== 0) return components;

    const halfLength = length / 2;

    // Check for 180 degree rotation at halved interval
    // Derive positions from motion locations
    const h1Start = steps[0] ? this.deriveStartPosition(steps[0]) : null;
    const h2Start = steps[halfLength]
      ? this.deriveStartPosition(steps[halfLength])
      : null;
    if (h1Start && h2Start) {
      if (HALF_POSITION_MAP[h1Start] === h2Start) {
        components.push(LOOPComponent.ROTATED);
      }
    }

    // Check for swap at halved interval
    if (this.detectsSwappingAtInterval(steps, halfLength)) {
      components.push(LOOPComponent.SWAPPED);
    }

    // Check for inversion at halved interval
    if (this.detectsInversionAtInterval(steps, halfLength)) {
      components.push(LOOPComponent.INVERTED);
    }

    // Check for mirroring at halved interval
    if (this.detectsMirroring(steps)) {
      components.push(LOOPComponent.MIRRORED);
    }

    return components;
  }

  /**
   * Detect swap at a specific interval
   * @param interval The number of steps between comparisons
   */
  private detectsSwappingAtInterval(
    steps: readonly StepLike[],
    interval: number
  ): boolean {
    const length = steps.length;
    if (interval <= 0 || interval >= length) return false;

    let swapCount = 0;
    let checkCount = 0;

    // Check first few step pairs at this interval
    const pairsToCheck = Math.min(4, length - interval);

    for (let i = 0; i < pairsToCheck; i++) {
      const firstStep = steps[i];
      const secondStep = steps[i + interval];

      const firstBlue = firstStep?.motions?.[MotionColor.BLUE];
      const firstRed = firstStep?.motions?.[MotionColor.RED];
      const secondBlue = secondStep?.motions?.[MotionColor.BLUE];
      const secondRed = secondStep?.motions?.[MotionColor.RED];

      if (firstBlue && firstRed && secondBlue && secondRed) {
        // Skip pairs where both hands have the same motion type -
        // swapping two identical types is trivially true and meaningless.
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

  /**
   * Detect inversion at a specific interval
   */
  private detectsInversionAtInterval(
    steps: readonly StepLike[],
    interval: number
  ): boolean {
    const length = steps.length;
    if (interval <= 0 || interval >= length) return false;

    const pairsToCheck = Math.min(4, length - interval);
    let validComparisons = 0;

    for (let i = 0; i < pairsToCheck; i++) {
      const firstStep = steps[i];
      const secondStep = steps[i + interval];

      if (!firstStep || !secondStep) continue;

      // Check letter inversion
      if (firstStep.letter && secondStep.letter) {
        validComparisons++;
        const expectedLetter = INVERTED_LETTER_MAP[firstStep.letter];
        if (expectedLetter && secondStep.letter !== expectedLetter) {
          return false;
        }
      }

      // Check motion type inversion
      const firstBlue = firstStep.motions?.[MotionColor.BLUE];
      const secondBlue = secondStep.motions?.[MotionColor.BLUE];
      const firstRed = firstStep.motions?.[MotionColor.RED];
      const secondRed = secondStep.motions?.[MotionColor.RED];

      if (firstBlue && secondBlue) {
        validComparisons++;
        if (
          !this.isMotionTypeInverted(
            firstBlue.motionType,
            secondBlue.motionType
          )
        ) {
          return false;
        }
      }

      if (firstRed && secondRed) {
        validComparisons++;
        if (
          !this.isMotionTypeInverted(firstRed.motionType, secondRed.motionType)
        ) {
          return false;
        }
      }
    }

    // Only return true if we actually made at least one valid comparison
    return validComparisons > 0;
  }

  /**
   * Detect inner halved rotation: the first half of the sequence is itself a ROTATED loop.
   * Checks if step[0].startPosition -> step[N/4].startPosition follows HALF_POSITION_MAP.
   * Example: 16-step sequence where steps 1-8 form a 2-period rotated loop.
   */
  private detectsInnerHalvedRotation(steps: readonly StepLike[]): boolean {
    const length = steps.length;
    if (length < 8 || length % 4 !== 0) return false;

    const quarterLength = length / 4;
    const q1Start = steps[0] ? this.deriveStartPosition(steps[0]) : null;
    const q2Start = steps[quarterLength] ? this.deriveStartPosition(steps[quarterLength]) : null;

    if (!q1Start || !q2Start) return false;
    return HALF_POSITION_MAP[q1Start] === q2Start;
  }

  /**
   * Detect compound pattern where different transformations occur at different intervals
   * e.g., 90 degree rotation (quartered) + swap (halved)
   */
  private detectCompoundPattern(
    steps: readonly StepLike[],
    quarteredComponents: LOOPComponent[],
    halvedComponents: LOOPComponent[]
  ): CompoundPattern | null {
    const length = steps.length;

    // Need at least 8 steps for compound patterns (quartered needs 4, halved needs 2, LCM = 8 minimum for both)
    if (length < 8 || length % 4 !== 0) return null;

    // Check if we have rotation at quartered but NOT swap at quartered
    const hasQuarteredRotation = quarteredComponents.includes(
      LOOPComponent.ROTATED
    );
    const hasQuarteredSwap = quarteredComponents.includes(
      LOOPComponent.SWAPPED
    );

    // Check if we have swap at halved
    const hasHalvedSwap = halvedComponents.includes(LOOPComponent.SWAPPED);
    const hasHalvedInversion = halvedComponents.includes(
      LOOPComponent.INVERTED
    );

    // Compound pattern: rotation at quartered + swap ONLY at halved (not at quartered)
    if (hasQuarteredRotation && !hasQuarteredSwap && hasHalvedSwap) {
      const rotationDirection = this.getQuarteredRotationDirection(steps);
      const rotationDesc =
        rotationDirection === "ccw"
          ? "90 deg CCW Rotated"
          : "90 deg CW Rotated";

      return {
        isCompound: true,
        quarteredTransformations: [LOOPComponent.ROTATED],
        halvedTransformations: [LOOPComponent.SWAPPED],
        description: `${rotationDesc} (quartered) + Swapped (halved)`,
      };
    }

    // Compound pattern: rotation at quartered + inversion ONLY at halved
    if (hasQuarteredRotation && hasHalvedInversion) {
      const hasQuarteredInversion = quarteredComponents.includes(
        LOOPComponent.INVERTED
      );
      if (!hasQuarteredInversion) {
        const rotationDirection = this.getQuarteredRotationDirection(steps);
        const rotationDesc =
          rotationDirection === "ccw"
            ? "90 deg CCW Rotated"
            : "90 deg CW Rotated";

        return {
          isCompound: true,
          quarteredTransformations: [LOOPComponent.ROTATED],
          halvedTransformations: [LOOPComponent.INVERTED],
          description: `${rotationDesc} (quartered) + Inverted (halved)`,
        };
      }
    }

    // Compound pattern: rotation at quartered + swap + inversion at halved
    if (
      hasQuarteredRotation &&
      !hasQuarteredSwap &&
      hasHalvedSwap &&
      hasHalvedInversion
    ) {
      const rotationDirection = this.getQuarteredRotationDirection(steps);
      const rotationDesc =
        rotationDirection === "ccw"
          ? "90 deg CCW Rotated"
          : "90 deg CW Rotated";

      return {
        isCompound: true,
        quarteredTransformations: [LOOPComponent.ROTATED],
        halvedTransformations: [LOOPComponent.SWAPPED, LOOPComponent.INVERTED],
        description: `${rotationDesc} (quartered) + Swapped + Inverted (halved)`,
      };
    }

    // Compound pattern: inner halved rotation + outer mirrored/swapped
    // Detects sequences where the first half is itself a ROTATED loop,
    // and the second half applies MIRRORED and/or SWAPPED on top of the first half.
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

  /**
   * Get the rotation direction for quartered rotation
   */
  private getQuarteredRotationDirection(
    steps: readonly StepLike[]
  ): "cw" | "ccw" | null {
    const length = steps.length;
    if (length < 4 || length % 4 !== 0) return null;

    const quarterLength = length / 4;

    // Derive positions from motion locations
    const q1Start = steps[0] ? this.deriveStartPosition(steps[0]) : null;
    const q2Start = steps[quarterLength]
      ? this.deriveStartPosition(steps[quarterLength])
      : null;

    if (!q1Start || !q2Start) return null;

    // Check clockwise
    if (QUARTER_POSITION_MAP_CW[q1Start] === q2Start) {
      return "cw";
    }

    // Check counter-clockwise
    if (QUARTER_POSITION_MAP_CCW[q1Start] === q2Start) {
      return "ccw";
    }

    return null;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const loopDetector = new LOOPDetector();
