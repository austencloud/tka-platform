/**
 * Strict Swapped LOOP Executor
 *
 * Executes the strict swapped LOOP (Linked Orbital Offset Pattern) by:
 * 1. Taking a partial sequence (always first half - no quartering)
 * 2. Swapping blue and red attributes between beats
 * 3. Generating the remaining beats to complete the circular pattern
 *
 * The swapping works by:
 * - Swapping blue ↔ red motion attributes entirely
 * - Transforming positions according to the swap map
 * - Maintaining the same letters, motion types, and prop rotation directions
 * - Only the color assignment changes
 *
 * IMPORTANT: Slice size is ALWAYS halved (no user choice like STRICT_ROTATED)
 */

import {
  MotionColor,
  MotionType,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import {
  SWAPPED_POSITION_MAP,
  SWAPPED_LOOP_VALIDATION_SET,
} from "../../domain/constants/strict-loop-position-maps";
import type { SliceSize } from "../../domain/models/circular-models";
import type { BeatData } from "../../../../shared/domain/models/BeatData";

export class StrictSwappedLOOPExecutor {
  constructor(
    private OrientationCalculator: IOrientationCalculator,
    private gridPositionDeriver: IGridPositionDeriver
  ) {}

  /**
   * Execute the strict swapped LOOP
   *
   * @param sequence - The partial sequence to complete (must include start position at index 0)
   * @param sliceSize - Ignored (swapped LOOP always uses halved)
   * @returns The complete circular sequence with all beats
   */
  executeLOOP(sequence: BeatData[], _sliceSize: SliceSize): BeatData[] {
    // Validate the sequence
    this._validateSequence(sequence);

    // Remove start position (index 0) for processing
    const startPosition = sequence.shift();
    if (!startPosition) {
      throw new Error("Sequence must have a start position");
    }

    // Calculate how many beats to generate (always doubles for swapped)
    const sequenceLength = sequence.length;
    const entriesToAdd = sequenceLength; // Always halved = doubles the sequence

    // Generate the new beats
    const generatedBeats: BeatData[] = [];
    let lastBeat = sequence[sequence.length - 1]!;
    const nextBeatNumber = lastBeat.beatNumber + 1;

    // Skip first two beats in the loop (start from beat 2)
    for (let i = 2; i < sequenceLength + 2; i++) {
      const finalIntendedLength = sequenceLength + entriesToAdd;
      const nextBeat = this._createNewLOOPEntry(
        sequence,
        lastBeat,
        nextBeatNumber + i - 2,
        finalIntendedLength
      );

      generatedBeats.push(nextBeat);
      sequence.push(nextBeat);
      lastBeat = nextBeat;
    }

    // Re-insert start position at the beginning
    sequence.unshift(startPosition);

    return sequence;
  }

  /**
   * Validate that the sequence can perform a swapped LOOP
   * Requirement: swapped_position(start_position) === end_position
   */
  private _validateSequence(sequence: BeatData[]): void {
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

    // Check if the (start, end) pair is valid for swapping
    const key = `${startPos},${endPos}`;

    if (!SWAPPED_LOOP_VALIDATION_SET.has(key)) {
      const expectedEnd = SWAPPED_POSITION_MAP[startPos as GridPosition];
      throw new Error(
        `Invalid position pair for swapped LOOP: ${startPos} → ${endPos}. ` +
          `For a swapped LOOP from ${startPos}, the sequence must end at ${expectedEnd}.`
      );
    }
  }

  /**
   * Create a new LOOP entry by transforming a previous beat
   */
  private _createNewLOOPEntry(
    sequence: BeatData[],
    previousBeat: BeatData,
    beatNumber: number,
    finalIntendedLength: number
  ): BeatData {
    // Get the corresponding beat from the first section using index mapping
    const previousMatchingBeat = this._getPreviousMatchingBeat(
      sequence,
      beatNumber,
      finalIntendedLength
    );

    // Create the swapped motions first
    const matchingBlueMotion = previousMatchingBeat.motions[MotionColor.RED];
    const matchingRedMotion = previousMatchingBeat.motions[MotionColor.BLUE];

    if (!matchingBlueMotion || !matchingRedMotion) {
      throw new Error("Matching beat is missing required motion data");
    }

    const blueMotion = this._createSwappedMotion(
      MotionColor.BLUE,
      previousBeat,
      matchingBlueMotion // Use RED from matching beat
    );
    const redMotion = this._createSwappedMotion(
      MotionColor.RED,
      previousBeat,
      matchingRedMotion // Use BLUE from matching beat
    );

    // CRITICAL: Recalculate the actual grid positions from the hand locations
    // The swapped map is just a validation - we need to derive positions from actual hand locations
    const actualStartPosition =
      this.gridPositionDeriver.getGridPositionFromLocations(
        blueMotion.startLocation,
        redMotion.startLocation
      );
    const actualEndPosition =
      this.gridPositionDeriver.getGridPositionFromLocations(
        blueMotion.endLocation,
        redMotion.endLocation
      );

    // Create the new beat with swapped attributes (BLUE ↔ RED)
    // Note: We swap the color assignments - blue gets red's data and vice versa
    const newBeat: BeatData = {
      ...previousMatchingBeat,
      id: `beat-${beatNumber}`,
      beatNumber,
      startPosition: actualStartPosition,
      endPosition: actualEndPosition,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
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
   * Get the previous matching beat using index mapping (halved pattern)
   */
  private _getPreviousMatchingBeat(
    sequence: BeatData[],
    beatNumber: number,
    finalLength: number
  ): BeatData {
    const indexMap = this._getIndexMap(finalLength);
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
   * Generate index mapping for retrieving corresponding beats (halved pattern only)
   * Maps second half beats to first half beats
   */
  private _getIndexMap(length: number): Record<number, number> {
    const map: Record<number, number> = {};
    const halfLength = Math.floor(length / 2);

    // Map beats in second half to their corresponding beats in first half
    for (let i = halfLength + 1; i <= length; i++) {
      map[i] = i - halfLength;
    }

    return map;
  }

  /**
   * Create swapped motion data for the new beat
   * Uses the opposite color's matching motion attributes
   */
  private _createSwappedMotion(
    color: MotionColor,
    previousBeat: BeatData,
    matchingMotion: MotionData // This is from the OPPOSITE color in the matching beat
  ): MotionData {
    // When swapped, this color follows the opposite color's path
    // So its start location must continue from where the opposite color ended
    const oppositeColor =
      color === MotionColor.BLUE ? MotionColor.RED : MotionColor.BLUE;
    const previousMotion = previousBeat.motions[oppositeColor];

    if (!previousMotion) {
      throw new Error(`Missing motion data for ${oppositeColor}`);
    }

    // Get start location from previous motion's end (for continuity)
    const startLocation = previousMotion.endLocation;

    // For STATIC motions, end = start (no movement)
    // For other motions, keep the matching motion's end location
    const endLocation =
      matchingMotion.motionType === MotionType.STATIC
        ? startLocation
        : matchingMotion.endLocation;

    // CRITICAL: We must explicitly set the color to match THIS motion,
    // not copy it from the opposite color's matching motion!
    // We want Blue to DO what Red did, but still BE Blue.
    const swappedMotion = {
      ...matchingMotion,
      color, // FIXED: Set to THIS motion's color, not matchingMotion's color
      startLocation,
      endLocation,
      // motionType, rotationDirection, turns all come from matchingMotion (opposite color)
      // Start orientation will be set by OrientationCalculator
      // End orientation will be calculated by OrientationCalculator
    };

    return swappedMotion;
  }
}
