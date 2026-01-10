/**
 * Strict Rotated LOOP Executor
 *
 * Executes the strict rotated LOOP (Linked Orbital Offset Pattern) by:
 * 1. Taking a partial sequence (first half or quarter)
 * 2. Applying rotational transformations to each beat
 * 3. Generating the remaining beats to complete the circular pattern
 *
 * The rotation works by:
 * - Taking each pictograph from the first section
 * - Rotating its hand locations based on the hand's rotation direction
 * - Maintaining the same motion types, turns, and letter patterns
 * - Creating new beats that fit the rotated positions
 */

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import {
  HALVED_LOOPS,
  QUARTERED_LOOPS,
  getHandRotationDirection,
  getLocationMapForHandRotation,
} from "../../domain/constants/circular-position-maps";
import { SliceSize } from "../../domain/models/circular-models";
import type { BeatData } from "../../../../shared/domain/models/BeatData";

export class StrictRotatedLOOPExecutor {
  constructor(
    private OrientationCalculator: IOrientationCalculator,
    private gridPositionDeriver: IGridPositionDeriver
  ) {}

  /**
   * Execute the strict rotated LOOP
   *
   * @param sequence - The partial sequence to complete (must include start position at index 0)
   * @param sliceSize - Whether to use halved (180°) or quartered (90°) rotation
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

    // Calculate how many beats to generate
    const sequenceLength = sequence.length;
    const entriesToAdd = this._calculateEntriesToAdd(sequenceLength, sliceSize);

    // Generate the new beats
    const generatedBeats: BeatData[] = [];
    let lastBeat = sequence[sequence.length - 1]!;
    let nextBeatNumber = lastBeat.beatNumber + 1;

    for (let i = 0; i < entriesToAdd; i++) {
      const finalIntendedLength = sequenceLength + entriesToAdd;
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
   * Validate that the sequence can perform the requested LOOP
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

    // Check if the (start, end) pair is valid for the slice size
    const key = `${startPos},${endPos}`;
    const validationSet =
      sliceSize === SliceSize.HALVED ? HALVED_LOOPS : QUARTERED_LOOPS;

    if (!validationSet.has(key)) {
      throw new Error(
        `Invalid position pair for ${sliceSize} LOOP: ${startPos} → ${endPos}. ` +
          `This pair cannot complete a ${sliceSize} rotation.`
      );
    }
  }

  /**
   * Calculate how many beats need to be added based on slice size
   */
  private _calculateEntriesToAdd(
    sequenceLength: number,
    sliceSize: SliceSize
  ): number {
    if (sliceSize === SliceSize.HALVED) {
      return sequenceLength; // Double the sequence
    }
    // SliceSize.QUARTERED
    return sequenceLength * 3; // Quadruple the sequence
  }

  /**
   * Create a new LOOP entry by transforming a previous beat
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

    // Calculate new end position
    const newEndPosition = this._calculateNewEndPosition(
      previousMatchingBeat,
      previousBeat
    );

    // Create the new beat with transformed attributes
    const newBeat: BeatData = {
      ...previousMatchingBeat,
      id: `beat-${beatNumber}`,
      beatNumber,
      startPosition: previousBeat.endPosition ?? null,
      endPosition: newEndPosition,
      motions: {
        [MotionColor.BLUE]: this._createTransformedMotion(
          MotionColor.BLUE,
          previousBeat,
          previousMatchingBeat
        ),
        [MotionColor.RED]: this._createTransformedMotion(
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
    const indexMap = this._getIndexMap(sliceSize, finalLength);
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
   */
  private _getIndexMap(
    sliceSize: SliceSize,
    length: number
  ): Record<number, number> {
    // Handle edge cases for very short sequences
    if (length < 4 && sliceSize === SliceSize.QUARTERED) {
      const map: Record<number, number> = {};
      for (let i = 1; i <= length; i++) {
        map[i] = Math.max(i - 1, 1);
      }
      return map;
    }

    if (length < 2 && sliceSize === SliceSize.HALVED) {
      const map: Record<number, number> = {};
      for (let i = 1; i <= length; i++) {
        map[i] = Math.max(i - 1, 1);
      }
      return map;
    }

    // Normal index mapping
    const map: Record<number, number> = {};

    if (sliceSize === SliceSize.QUARTERED) {
      const quarterLength = Math.floor(length / 4);
      for (let i = quarterLength + 1; i <= length; i++) {
        map[i] = i - quarterLength;
      }
    } else {
      // SliceSize.HALVED
      const halfLength = Math.floor(length / 2);
      for (let i = halfLength + 1; i <= length; i++) {
        map[i] = i - halfLength;
      }
    }

    return map;
  }

  /**
   * Calculate the new end position by rotating locations
   */
  private _calculateNewEndPosition(
    previousMatchingBeat: BeatData,
    previousBeat: BeatData
  ): GridPosition | null {
    const blueMotion = previousMatchingBeat.motions[MotionColor.BLUE];
    const redMotion = previousMatchingBeat.motions[MotionColor.RED];

    if (!blueMotion || !redMotion) {
      throw new Error(
        "Previous matching beat must have both blue and red motions"
      );
    }

    // Get hand rotation directions
    const blueHandRotDir = getHandRotationDirection(
      blueMotion.startLocation as GridLocation,
      blueMotion.endLocation as GridLocation
    );
    const redHandRotDir = getHandRotationDirection(
      redMotion.startLocation as GridLocation,
      redMotion.endLocation as GridLocation
    );

    // Get location maps
    const blueLocationMap = getLocationMapForHandRotation(blueHandRotDir);
    const redLocationMap = getLocationMapForHandRotation(redHandRotDir);

    // Calculate new end locations
    const previousBlueEndLoc =
      previousBeat.motions[MotionColor.BLUE]!.endLocation;
    const previousRedEndLoc =
      previousBeat.motions[MotionColor.RED]!.endLocation;

    const newBlueEndLoc = blueLocationMap[previousBlueEndLoc as GridLocation];
    const newRedEndLoc = redLocationMap[previousRedEndLoc as GridLocation];

    // Derive GridPosition from (blue, red) location tuple using GridPositionDeriver
    const newPosition = this.gridPositionDeriver.getGridPositionFromLocations(
      newBlueEndLoc,
      newRedEndLoc
    );

    return newPosition;
  }

  /**
   * Create transformed motion data for the new beat
   */
  private _createTransformedMotion(
    color: MotionColor,
    previousBeat: BeatData,
    previousMatchingBeat: BeatData
  ): MotionData {
    const previousMotion = previousBeat.motions[color];
    const matchingMotion = previousMatchingBeat.motions[color];

    if (!previousMotion || !matchingMotion) {
      throw new Error(`Missing motion data for ${color}`);
    }

    // Get hand rotation direction
    const handRotDir = getHandRotationDirection(
      matchingMotion.startLocation as GridLocation,
      matchingMotion.endLocation as GridLocation
    );

    // Get the appropriate location map
    const locationMap = getLocationMapForHandRotation(handRotDir);

    // Calculate rotated end location
    const newEndLocation =
      locationMap[previousMotion.endLocation as GridLocation];

    // Create transformed motion
    return {
      ...matchingMotion,
      startLocation: previousMotion.endLocation,
      endLocation: newEndLocation,
      // Start orientation will be set by OrientationCalculator
      // End orientation will be calculated by OrientationCalculator
    };
  }
}
