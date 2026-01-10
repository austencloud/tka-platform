/**
 * Rotated Inverted LOOP Executor
 *
 * Executes the rotated-inverted LOOP (Linked Orbital Offset Pattern) by combining:
 * 1. ROTATED: Rotate locations based on handpath direction (90°, 180°, or 270°)
 * 2. INVERTED: Flip letters (A↔B), flip motion types (PRO↔ANTI), flip prop rotation (CW↔CCW)
 *
 * This creates a sequence where:
 * - Letters are flipped (inverted effect)
 * - Motion types are flipped (PRO ↔ ANTI) (inverted effect)
 * - Prop rotation directions are flipped (CW ↔ CCW) (inverted effect)
 * - Locations are rotated based on the handpath direction
 * - **Colors are NOT swapped** (Blue stays Blue, Red stays Red)
 *
 * IMPORTANT: Supports both quartered and halved slice sizes
 * IMPORTANT: End position is calculated from rotated locations
 */

import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";
import {
  MotionType,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type {
  GridLocation,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import type { ILOOPParameterProvider } from "$lib/features/create/generate/shared/services/contracts/ILOOPParameterProvider";
import {
  getHandRotationDirection,
  getLocationMapForHandRotation,
  HALVED_LOOPS,
  QUARTERED_LOOPS,
} from "../../domain/constants/circular-position-maps";
import { SliceSize } from "../../domain/models/circular-models";

export class RotatedInvertedLOOPExecutor {
  constructor(
    private OrientationCalculator: IOrientationCalculator,
    private gridPositionDeriver: IGridPositionDeriver,
    private loopParams: ILOOPParameterProvider
  ) {}

  /**
   * Execute the rotated-inverted LOOP
   *
   * @param sequence - The partial sequence to complete (must include start position at index 0)
   * @param sliceSize - Slice size for the LOOP (quartered or halved)
   * @returns The complete circular sequence with all beats
   */
  executeLOOP(sequence: BeatData[], sliceSize: SliceSize): BeatData[] {
    // Validate the sequence
    this._validateSequence(sequence, sliceSize);

    // Remove start position (index 0) for processing
    const startPosition = sequence.shift();
    if (!startPosition) {
      throw new Error("Sequence must have a start position");
    }

    // Calculate how many beats to generate based on slice size
    const sequenceLength = sequence.length;
    let entriesToAdd: number;

    if (sliceSize === SliceSize.QUARTERED) {
      // Quartered adds 3x the original length
      entriesToAdd = sequenceLength * 3;
    } else {
      // Halved adds 1x the original length (doubles total)
      entriesToAdd = sequenceLength;
    }

    // Generate the new beats
    const generatedBeats: BeatData[] = [];
    let lastBeat = sequence[sequence.length - 1]!;
    let nextBeatNumber = lastBeat.beatNumber + 1;

    // Generate LOOP beats
    const finalIntendedLength = sequenceLength + entriesToAdd;
    for (let i = 0; i < entriesToAdd; i++) {
      const nextBeat = this._createNewLOOPEntry(
        sequence,
        lastBeat,
        nextBeatNumber,
        finalIntendedLength,
        sliceSize
      );

      generatedBeats.push(nextBeat);
      sequence.push(nextBeat);
      lastBeat = nextBeat;
      nextBeatNumber++;
    }

    // Re-insert start position at the beginning
    sequence.unshift(startPosition);

    return sequence;
  }

  /**
   * Validate that the sequence can perform a rotated-inverted LOOP
   */
  private _validateSequence(sequence: BeatData[], sliceSize: SliceSize): void {
    if (sequence.length < 2) {
      throw new Error(
        "Sequence must have at least 2 beats (start position + 1 beat)"
      );
    }

    const startPos = sequence[0]!.startPosition;
    const endPos = sequence[sequence.length - 1]!.endPosition;

    if (!startPos || !endPos) {
      throw new Error("Sequence beats must have valid start and end positions");
    }

    // Check if the (start, end) pair is valid for the requested slice size
    const key = `${startPos},${endPos}`;
    const validationSet =
      sliceSize === SliceSize.QUARTERED ? QUARTERED_LOOPS : HALVED_LOOPS;

    if (!validationSet.has(key)) {
      throw new Error(
        `Invalid position pair for rotated-inverted ${sliceSize} LOOP: ${startPos} → ${endPos}. ` +
          `The end position must match the ${sliceSize} rotation requirement.`
      );
    }
  }

  /**
   * Create a new LOOP entry by transforming a previous beat with ROTATION + INVERTED
   */
  private _createNewLOOPEntry(
    sequence: BeatData[],
    previousBeat: BeatData,
    beatNumber: number,
    finalIntendedLength: number,
    sliceSize: SliceSize
  ): BeatData {
    // Get the corresponding beat from the first section using index mapping
    const previousMatchingBeat = this._getPreviousMatchingBeat(
      sequence,
      beatNumber,
      finalIntendedLength,
      sliceSize
    );

    // Get the inverted letter (INVERTED effect)
    if (!previousMatchingBeat.letter) {
      throw new Error("Previous matching beat must have a letter");
    }
    const invertedLetter = this.loopParams.getInvertedLetter(
      previousMatchingBeat.letter as string
    ) as Letter;

    // Calculate the rotated end position
    const rotatedEndPosition = this._getRotatedEndPosition(
      previousBeat,
      previousMatchingBeat
    );

    // Create the new beat with rotated and inverted attributes
    // KEY: No color swapping - Blue stays Blue, Red stays Red
    //      Motion types are flipped (PRO ↔ ANTI)
    //      Prop rotations are flipped (CW ↔ CCW)
    //      Locations are rotated based on handpath direction
    const newBeat: BeatData = {
      ...previousMatchingBeat,
      id: `beat-${beatNumber}`,
      beatNumber,
      letter: invertedLetter, // INVERTED: Flip letter
      startPosition: previousBeat.endPosition ?? null,
      endPosition: rotatedEndPosition,
      motions: {
        [MotionColor.BLUE]: this._createRotatedInvertedMotion(
          MotionColor.BLUE,
          previousBeat,
          previousMatchingBeat
        ),
        [MotionColor.RED]: this._createRotatedInvertedMotion(
          MotionColor.RED,
          previousBeat,
          previousMatchingBeat
        ),
      },
    };

    // Update orientations
    const beatWithStartOri = this.OrientationCalculator.updateStartOrientations(
      newBeat,
      previousBeat
    );
    const finalBeat =
      this.OrientationCalculator.updateEndOrientations(beatWithStartOri);

    return finalBeat;
  }

  /**
   * Get the previous matching beat using index mapping
   */
  private _getPreviousMatchingBeat(
    sequence: BeatData[],
    beatNumber: number,
    finalLength: number,
    sliceSize: SliceSize
  ): BeatData {
    const indexMap = this._getIndexMap(finalLength, sliceSize);
    const matchingBeatNumber = indexMap[beatNumber];

    if (matchingBeatNumber === undefined) {
      throw new Error(`No index mapping found for beatNumber ${beatNumber}`);
    }

    // Convert 1-based beatNumber to 0-based array index
    const arrayIndex = matchingBeatNumber - 1;

    if (arrayIndex < 0 || arrayIndex >= sequence.length) {
      throw new Error(
        `Invalid index mapping: beatNumber ${beatNumber} → matchingBeatNumber ${matchingBeatNumber} → arrayIndex ${arrayIndex} (sequence length: ${sequence.length})`
      );
    }

    return sequence[arrayIndex]!;
  }

  /**
   * Generate index mapping for retrieving corresponding beats
   * Works for both quartered and halved patterns
   */
  private _getIndexMap(
    length: number,
    sliceSize: SliceSize
  ): Record<number, number> {
    const map: Record<number, number> = {};

    // Edge case handling
    if (sliceSize === SliceSize.QUARTERED && length < 4) {
      for (let i = 1; i <= length; i++) {
        map[i] = Math.max(i - 1, 1);
      }
      return map;
    }

    if (sliceSize === SliceSize.HALVED && length < 2) {
      for (let i = 1; i <= length; i++) {
        map[i] = Math.max(i - 1, 1);
      }
      return map;
    }

    if (sliceSize === SliceSize.QUARTERED) {
      // Quartered: length = base * 4, so base = length / 4
      const baseLength = Math.floor(length / 4);
      for (let i = baseLength + 1; i <= length; i++) {
        map[i] = i - baseLength;
      }
    } else {
      // Halved: length = base * 2, so base = length / 2
      const baseLength = Math.floor(length / 2);
      for (let i = baseLength + 1; i <= length; i++) {
        map[i] = i - baseLength;
      }
    }

    return map;
  }

  /**
   * Get the rotated end position by rotating both colors' locations
   */
  private _getRotatedEndPosition(
    previousBeat: BeatData,
    previousMatchingBeat: BeatData
  ): GridPosition | null {
    // Get hand rotation directions from the matching beat (same color)
    const blueHandRotDir = getHandRotationDirection(
      previousMatchingBeat.motions[MotionColor.BLUE]!
        .startLocation as GridLocation,
      previousMatchingBeat.motions[MotionColor.BLUE]!
        .endLocation as GridLocation
    );
    const redHandRotDir = getHandRotationDirection(
      previousMatchingBeat.motions[MotionColor.RED]!
        .startLocation as GridLocation,
      previousMatchingBeat.motions[MotionColor.RED]!.endLocation as GridLocation
    );

    // Get the location maps for rotation
    const blueLocationMap = getLocationMapForHandRotation(blueHandRotDir);
    const redLocationMap = getLocationMapForHandRotation(redHandRotDir);

    // Rotate the locations from the previous beat
    const newBlueEndLoc =
      blueLocationMap[
        previousBeat.motions[MotionColor.BLUE]!.endLocation as GridLocation
      ];
    const newRedEndLoc =
      redLocationMap[
        previousBeat.motions[MotionColor.RED]!.endLocation as GridLocation
      ];

    // Derive position from both locations
    const newEndPosition =
      this.gridPositionDeriver.getGridPositionFromLocations(
        newBlueEndLoc,
        newRedEndLoc
      );

    return newEndPosition;
  }

  /**
   * Create rotated-inverted motion data for the new beat
   * Combines location rotation with motion type and prop rotation flipping
   */
  private _createRotatedInvertedMotion(
    color: MotionColor,
    previousBeat: BeatData,
    previousMatchingBeat: BeatData
  ): MotionData {
    const previousMotion = previousBeat.motions[color];
    const matchingMotion = previousMatchingBeat.motions[color]; // Same color (no swap)

    if (!previousMotion || !matchingMotion) {
      throw new Error(`Missing motion data for ${color}`);
    }

    // Get hand rotation direction from the matching motion
    const handRotDir = getHandRotationDirection(
      matchingMotion.startLocation as GridLocation,
      matchingMotion.endLocation as GridLocation
    );

    // Get location map for this rotation direction
    const locationMap = getLocationMapForHandRotation(handRotDir);

    // Rotate the end location (ROTATED effect)
    const rotatedEndLocation =
      locationMap[previousMotion.endLocation as GridLocation];

    // Flip the motion type (INVERTED effect)
    const invertedMotionType = this._getInvertedMotionType(
      matchingMotion.motionType
    );

    // Flip the prop rotation direction (INVERTED effect)
    const invertedPropRotDir = this._getInvertedPropRotDir(
      matchingMotion.rotationDirection
    );

    // Create rotated-inverted motion
    const rotatedInvertedMotion = {
      ...matchingMotion,
      color, // Preserve the color (no swap)
      motionType: invertedMotionType, // INVERTED: Flip motion type
      startLocation: previousMotion.endLocation,
      endLocation: rotatedEndLocation, // ROTATED: Rotate location
      rotationDirection: invertedPropRotDir, // INVERTED: Flip prop rotation
      // Start orientation will be set by OrientationCalculator
      // End orientation will be calculated by OrientationCalculator
    };

    return rotatedInvertedMotion;
  }

  /**
   * Get the inverted motion type (flip PRO ↔ ANTI)
   * STATIC and DASH stay the same
   */
  private _getInvertedMotionType(motionType: MotionType): MotionType {
    if (motionType === MotionType.PRO) {
      return MotionType.ANTI;
    } else if (motionType === MotionType.ANTI) {
      return MotionType.PRO;
    }

    // STATIC and DASH stay the same
    return motionType;
  }

  /**
   * Get the inverted prop rotation direction (flip CW ↔ CCW)
   * NO_ROTATION stays NO_ROTATION
   */
  private _getInvertedPropRotDir(
    propRotDir: RotationDirection
  ): RotationDirection {
    if (propRotDir === RotationDirection.CLOCKWISE) {
      return RotationDirection.COUNTER_CLOCKWISE;
    } else if (propRotDir === RotationDirection.COUNTER_CLOCKWISE) {
      return RotationDirection.CLOCKWISE;
    }

    // NO_ROTATION stays NO_ROTATION
    return propRotDir;
  }
}
