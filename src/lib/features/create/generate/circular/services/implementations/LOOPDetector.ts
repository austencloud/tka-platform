/**
 * LOOP Detection Service Implementation
 *
 * Analyzes sequences to detect their Linked Offset Operation Pattern (LOOP) type.
 * This is the reverse of LOOP generation - given a sequence, determine what
 * LOOP type (if any) it follows.
 *
 * Algorithm: Component-based detection
 * 1. Check if sequence is circular (end matches start)
 * 2. Detect individual components (ROTATED, MIRRORED, SWAPPED, INVERTED)
 * 3. Map detected components to LOOPType
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "../../../../shared/domain/models/BeatData";
import type { LOOPType } from "../../domain/models/circular-models";
import { SliceSize } from "../../domain/models/circular-models";
import { LOOPComponent } from "../../../shared/domain/models/generate-models";
import type {
  ILOOPDetector,
  LOOPDetectionResult,
  CompoundPattern,
} from "../contracts/ILOOPDetector";
import type { ISequenceLoopabilityChecker } from "$lib/features/compose/services/contracts/ISequenceLoopabilityChecker";
import type { ILOOPTypeResolver } from "../../../shared/services/contracts/ILOOPTypeResolver";
import {
  QUARTER_POSITION_MAP_CW,
  QUARTER_POSITION_MAP_CCW,
  HALF_POSITION_MAP,
} from "../../domain/constants/circular-position-maps";
import {
  VERTICAL_MIRROR_POSITION_MAP,
  INVERTED_LETTER_MAP,
} from "../../domain/constants/strict-loop-position-maps";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  MotionType,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export class LOOPDetector implements ILOOPDetector {
  constructor(
    private loopabilityChecker: ISequenceLoopabilityChecker,
    private LOOPTypeResolver: ILOOPTypeResolver
  ) {}

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
        sliceSize: null,
        confidence: "accidental",
      };
    }

    const beats = sequence.beats;

    // Too short to be a LOOP
    if (!beats || beats.length < 2) {
      return {
        isCircular: true,
        loopType: null,
        sliceSize: null,
        confidence: "accidental",
      };
    }

    // Step 2: Detect transformations at BOTH intervals independently
    const quarteredTransformations = this.detectAtQuartered(beats);
    const halvedTransformations = this.detectAtHalved(beats);

    // Step 3: Check for compound pattern (transformations at different intervals)
    const compoundPattern = this.detectCompoundPattern(
      beats,
      quarteredTransformations,
      halvedTransformations
    );

    // Step 4: Determine primary slice size and components for LOOP type
    let sliceSize: SliceSize | null = null;
    const detectedComponents = new Set<LOOPComponent>();

    if (compoundPattern) {
      // Compound pattern: use quartered as primary slice size
      sliceSize = SliceSize.QUARTERED;
      // Combine all components
      compoundPattern.quarteredTransformations.forEach((c) =>
        detectedComponents.add(c)
      );
      compoundPattern.halvedTransformations.forEach((c) =>
        detectedComponents.add(c)
      );
    } else {
      // Simple pattern: use traditional detection
      sliceSize = this.determineSliceSize(beats);

      if (this.detectsRotation(beats, sliceSize)) {
        detectedComponents.add(LOOPComponent.ROTATED);
      }
      if (this.detectsMirroring(beats)) {
        detectedComponents.add(LOOPComponent.MIRRORED);
      }
      if (this.detectsSwapping(beats)) {
        detectedComponents.add(LOOPComponent.SWAPPED);
      }
      if (this.detectsInversion(beats)) {
        detectedComponents.add(LOOPComponent.INVERTED);
      }
    }

    // Step 5: Map components to LOOP type
    let loopType: LOOPType | null = null;
    let confidence: "strict" | "probable" | "accidental" = "accidental";

    if (detectedComponents.size > 0) {
      if (this.LOOPTypeResolver.isImplemented(detectedComponents)) {
        loopType = this.LOOPTypeResolver.generateLOOPType(detectedComponents);
        confidence = "strict";
      } else {
        // Has components but combination not implemented
        confidence = "probable";
      }
    }

    return {
      isCircular: true,
      loopType,
      sliceSize: detectedComponents.has(LOOPComponent.ROTATED)
        ? sliceSize
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
    return this.loopabilityChecker.isSeamlesslyLoopable(sequence);
  }

  /**
   * Determine slice size based on sequence length and position patterns
   *
   * Key insight: For quartered rotation, compare START positions of first beat
   * of each quarter. If q1->q2->q3->q4 follows 90 degree rotation, it's quartered.
   */
  private determineSliceSize(beats: readonly BeatData[]): SliceSize {
    const length = beats.length;

    // Check quartered FIRST (more specific)
    if (length >= 4 && length % 4 === 0) {
      if (this.detectsQuarteredRotation(beats)) {
        return SliceSize.QUARTERED;
      }
    }

    // Default to halved
    return SliceSize.HALVED;
  }

  /**
   * Detect quartered (90 degree) rotation by comparing START positions of each quarter
   */
  private detectsQuarteredRotation(beats: readonly BeatData[]): boolean {
    const length = beats.length;
    if (length < 4 || length % 4 !== 0) return false;

    const quarterLength = length / 4;

    // Get start positions of first beat of each quarter
    const q1Start = beats[0]?.startPosition;
    const q2Start = beats[quarterLength]?.startPosition;
    const q3Start = beats[quarterLength * 2]?.startPosition;
    const q4Start = beats[quarterLength * 3]?.startPosition;

    if (!q1Start || !q2Start || !q3Start || !q4Start) return false;

    // Check clockwise rotation: q1 -> q2 -> q3 -> q4 follows QUARTER_CW
    const cwMatch =
      QUARTER_POSITION_MAP_CW[q1Start as GridPosition] === q2Start &&
      QUARTER_POSITION_MAP_CW[q2Start as GridPosition] === q3Start &&
      QUARTER_POSITION_MAP_CW[q3Start as GridPosition] === q4Start;

    // Check counter-clockwise rotation
    const ccwMatch =
      QUARTER_POSITION_MAP_CCW[q1Start as GridPosition] === q2Start &&
      QUARTER_POSITION_MAP_CCW[q2Start as GridPosition] === q3Start &&
      QUARTER_POSITION_MAP_CCW[q3Start as GridPosition] === q4Start;

    return cwMatch || ccwMatch;
  }

  /**
   * Detect if sequence follows rotation transformation
   *
   * For halved: Compare START position of first beat vs START position of half beat
   * For quartered: Already detected in determineSliceSize via detectsQuarteredRotation
   */
  private detectsRotation(
    beats: readonly BeatData[],
    sliceSize: SliceSize
  ): boolean {
    const length = beats.length;

    // Quartered rotation is detected via slice size determination
    if (sliceSize === SliceSize.QUARTERED) {
      return this.detectsQuarteredRotation(beats);
    }

    // Halved rotation: compare START positions of first beat of each half
    if (sliceSize === SliceSize.HALVED && length >= 2 && length % 2 === 0) {
      const halfLength = length / 2;
      const h1Start = beats[0]?.startPosition;
      const h2Start = beats[halfLength]?.startPosition;

      if (!h1Start || !h2Start) return false;

      // Check if h2 start is 180 degree rotated from h1 start
      return HALF_POSITION_MAP[h1Start as GridPosition] === h2Start;
    }

    return false;
  }

  /**
   * Detect if sequence follows mirroring transformation
   */
  private detectsMirroring(beats: readonly BeatData[]): boolean {
    const length = beats.length;
    if (length < 2 || length % 2 !== 0) return false;

    const halfLength = length / 2;

    // Check if position pattern matches vertical mirror
    for (let i = 0; i < halfLength; i++) {
      const firstBeat = beats[i];
      const secondBeat = beats[halfLength + i];

      if (!firstBeat?.endPosition || !secondBeat?.endPosition) continue;

      const expectedPosition =
        VERTICAL_MIRROR_POSITION_MAP[firstBeat.endPosition as GridPosition];

      if (secondBeat.endPosition !== expectedPosition) {
        return false;
      }
    }

    return true;
  }

  /**
   * Detect if sequence follows swapping transformation (blue/red exchange)
   *
   * Key insight: Only detect swap if hands have different motion types.
   * If both hands have the same motion type, swapping is meaningless
   * and would cause false positives.
   */
  private detectsSwapping(beats: readonly BeatData[]): boolean {
    const length = beats.length;
    if (length < 2 || length % 2 !== 0) return false;

    const halfLength = length / 2;
    let swapCount = 0;
    let checkCount = 0;
    let hasDifferentMotionTypes = false;

    for (let i = 0; i < Math.min(halfLength, 4); i++) {
      const firstBeat = beats[i];
      const secondBeat = beats[halfLength + i];

      const firstBlue = firstBeat?.motions?.[MotionColor.BLUE];
      const firstRed = firstBeat?.motions?.[MotionColor.RED];
      const secondBlue = secondBeat?.motions?.[MotionColor.BLUE];
      const secondRed = secondBeat?.motions?.[MotionColor.RED];

      if (firstBlue && firstRed && secondBlue && secondRed) {
        checkCount++;

        // Check if hands have different motion types (meaningful swap)
        if (firstBlue.motionType !== firstRed.motionType) {
          hasDifferentMotionTypes = true;
        }

        // Second blue should match first red, second red should match first blue
        if (
          secondBlue.motionType === firstRed.motionType &&
          secondRed.motionType === firstBlue.motionType
        ) {
          swapCount++;
        }
      }
    }

    // Only report swap if:
    // 1. Majority of beats show swap pattern
    // 2. Hands have different motion types (swap is meaningful)
    return (
      checkCount > 0 &&
      swapCount >= checkCount * 0.75 &&
      hasDifferentMotionTypes
    );
  }

  /**
   * Detect if sequence follows inversion transformation (complementary motion types)
   */
  private detectsInversion(beats: readonly BeatData[]): boolean {
    const length = beats.length;
    if (length < 2 || length % 2 !== 0) return false;

    const halfLength = length / 2;

    for (let i = 0; i < halfLength; i++) {
      const firstBeat = beats[i];
      const secondBeat = beats[halfLength + i];

      if (!firstBeat || !secondBeat) continue;

      // Check letter inversion if both have letters
      if (firstBeat.letter && secondBeat.letter) {
        const expectedLetter = INVERTED_LETTER_MAP[firstBeat.letter];
        if (expectedLetter && secondBeat.letter !== expectedLetter) {
          return false;
        }
      }

      // Check motion type inversion (PRO <-> ANTI)
      const firstBlue = firstBeat.motions?.[MotionColor.BLUE];
      const secondBlue = secondBeat.motions?.[MotionColor.BLUE];
      const firstRed = firstBeat.motions?.[MotionColor.RED];
      const secondRed = secondBeat.motions?.[MotionColor.RED];

      if (firstBlue && secondBlue) {
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
        if (
          !this.isMotionTypeInverted(firstRed.motionType, secondRed.motionType)
        ) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if two motion types are inverted pairs
   */
  private isMotionTypeInverted(type1: MotionType, type2: MotionType): boolean {
    // PRO and ANTI are inverted pairs
    if (type1 === MotionType.PRO && type2 === MotionType.ANTI) return true;
    if (type1 === MotionType.ANTI && type2 === MotionType.PRO) return true;

    // STATIC, FLOAT, DASH are self-inverted
    if (type1 === type2) {
      return [MotionType.STATIC, MotionType.FLOAT, MotionType.DASH].includes(
        type1
      );
    }

    return false;
  }

  // ============ COMPOUND PATTERN DETECTION ============

  /**
   * Detect transformations at quartered interval (90 degree rotation period)
   */
  private detectAtQuartered(beats: readonly BeatData[]): LOOPComponent[] {
    const components: LOOPComponent[] = [];
    const length = beats.length;

    if (length < 4 || length % 4 !== 0) return components;

    // Check for 90 degree rotation at quartered interval
    if (this.detectsQuarteredRotation(beats)) {
      components.push(LOOPComponent.ROTATED);
    }

    // Check for swap at quartered interval (every quarter)
    if (this.detectsSwappingAtInterval(beats, length / 4)) {
      components.push(LOOPComponent.SWAPPED);
    }

    // Check for inversion at quartered interval
    if (this.detectsInversionAtInterval(beats, length / 4)) {
      components.push(LOOPComponent.INVERTED);
    }

    return components;
  }

  /**
   * Detect transformations at halved interval (180 degree rotation period)
   */
  private detectAtHalved(beats: readonly BeatData[]): LOOPComponent[] {
    const components: LOOPComponent[] = [];
    const length = beats.length;

    if (length < 2 || length % 2 !== 0) return components;

    const halfLength = length / 2;

    // Check for 180 degree rotation at halved interval
    const h1Start = beats[0]?.startPosition;
    const h2Start = beats[halfLength]?.startPosition;
    if (h1Start && h2Start) {
      if (HALF_POSITION_MAP[h1Start as GridPosition] === h2Start) {
        components.push(LOOPComponent.ROTATED);
      }
    }

    // Check for swap at halved interval
    if (this.detectsSwappingAtInterval(beats, halfLength)) {
      components.push(LOOPComponent.SWAPPED);
    }

    // Check for inversion at halved interval
    if (this.detectsInversionAtInterval(beats, halfLength)) {
      components.push(LOOPComponent.INVERTED);
    }

    // Check for mirroring at halved interval
    if (this.detectsMirroring(beats)) {
      components.push(LOOPComponent.MIRRORED);
    }

    return components;
  }

  /**
   * Detect swap at a specific interval
   * @param interval The number of beats between comparisons
   */
  private detectsSwappingAtInterval(
    beats: readonly BeatData[],
    interval: number
  ): boolean {
    const length = beats.length;
    if (interval <= 0 || interval >= length) return false;

    let swapCount = 0;
    let checkCount = 0;
    let hasDifferentMotionTypes = false;

    // Check first few beat pairs at this interval
    const pairsToCheck = Math.min(4, length - interval);

    for (let i = 0; i < pairsToCheck; i++) {
      const firstBeat = beats[i];
      const secondBeat = beats[i + interval];

      const firstBlue = firstBeat?.motions?.[MotionColor.BLUE];
      const firstRed = firstBeat?.motions?.[MotionColor.RED];
      const secondBlue = secondBeat?.motions?.[MotionColor.BLUE];
      const secondRed = secondBeat?.motions?.[MotionColor.RED];

      if (firstBlue && firstRed && secondBlue && secondRed) {
        checkCount++;

        if (firstBlue.motionType !== firstRed.motionType) {
          hasDifferentMotionTypes = true;
        }

        if (
          secondBlue.motionType === firstRed.motionType &&
          secondRed.motionType === firstBlue.motionType
        ) {
          swapCount++;
        }
      }
    }

    return (
      checkCount > 0 &&
      swapCount >= checkCount * 0.75 &&
      hasDifferentMotionTypes
    );
  }

  /**
   * Detect inversion at a specific interval
   */
  private detectsInversionAtInterval(
    beats: readonly BeatData[],
    interval: number
  ): boolean {
    const length = beats.length;
    if (interval <= 0 || interval >= length) return false;

    const pairsToCheck = Math.min(4, length - interval);

    for (let i = 0; i < pairsToCheck; i++) {
      const firstBeat = beats[i];
      const secondBeat = beats[i + interval];

      if (!firstBeat || !secondBeat) continue;

      // Check letter inversion
      if (firstBeat.letter && secondBeat.letter) {
        const expectedLetter = INVERTED_LETTER_MAP[firstBeat.letter];
        if (expectedLetter && secondBeat.letter !== expectedLetter) {
          return false;
        }
      }

      // Check motion type inversion
      const firstBlue = firstBeat.motions?.[MotionColor.BLUE];
      const secondBlue = secondBeat.motions?.[MotionColor.BLUE];
      const firstRed = firstBeat.motions?.[MotionColor.RED];
      const secondRed = secondBeat.motions?.[MotionColor.RED];

      if (firstBlue && secondBlue) {
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
        if (
          !this.isMotionTypeInverted(firstRed.motionType, secondRed.motionType)
        ) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Detect compound pattern where different transformations occur at different intervals
   * e.g., 90 degree rotation (quartered) + swap (halved)
   */
  private detectCompoundPattern(
    beats: readonly BeatData[],
    quarteredComponents: LOOPComponent[],
    halvedComponents: LOOPComponent[]
  ): CompoundPattern | null {
    const length = beats.length;

    // Need at least 8 beats for compound patterns (quartered needs 4, halved needs 2, LCM = 8 minimum for both)
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
      const rotationDirection = this.getQuarteredRotationDirection(beats);
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
        const rotationDirection = this.getQuarteredRotationDirection(beats);
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
      const rotationDirection = this.getQuarteredRotationDirection(beats);
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

    return null;
  }

  /**
   * Get the rotation direction for quartered rotation
   */
  private getQuarteredRotationDirection(
    beats: readonly BeatData[]
  ): "cw" | "ccw" | null {
    const length = beats.length;
    if (length < 4 || length % 4 !== 0) return null;

    const quarterLength = length / 4;

    const q1Start = beats[0]?.startPosition;
    const q2Start = beats[quarterLength]?.startPosition;

    if (!q1Start || !q2Start) return null;

    // Check clockwise
    if (QUARTER_POSITION_MAP_CW[q1Start as GridPosition] === q2Start) {
      return "cw";
    }

    // Check counter-clockwise
    if (QUARTER_POSITION_MAP_CCW[q1Start as GridPosition] === q2Start) {
      return "ccw";
    }

    return null;
  }
}
