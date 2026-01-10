/**
 * Swapped Inverted LOOP Executor
 *
 * Executes the swapped-inverted LOOP (Linked Orbital Offset Pattern) by combining:
 * 1. SWAPPED: Blue does what Red did, Red does what Blue did
 * 2. INVERTED: Flip letters, flip motion types (PRO↔ANTI), flip prop rotation (CW↔CCW)
 *
 * This creates a sequence where:
 * - Colors are swapped (Blue performs Red's actions and vice versa)
 * - Letters are inverted (A↔B, D↔E, etc.)
 * - Motion types are flipped (PRO↔ANTI)
 * - Prop rotation directions are flipped (CW↔CCW)
 * - Locations stay the same (returns to starting position)
 *
 * IMPORTANT: Slice size is ALWAYS halved (no quartering)
 * IMPORTANT: End position must equal start position (returns to start)
 */

import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import {
  MotionType,
  MotionColor,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import {
  INVERTED_LOOP_VALIDATION_SET,
  getInvertedLetter,
} from "../../domain/constants/strict-loop-position-maps";
import type { SliceSize } from "../../domain/models/circular-models";

export class SwappedInvertedLOOPExecutor {
  constructor(private OrientationCalculator: IOrientationCalculator) {}

  /**
   * Execute the swapped-inverted LOOP
   *
   * @param sequence - The partial sequence to complete (must include start position at index 0)
   * @param sliceSize - Ignored (swapped-inverted LOOP always uses halved)
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

    // Calculate how many beats to generate (always doubles for halved)
    const sequenceLength = sequence.length;
    const entriesToAdd = sequenceLength;

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
   * Validate that the sequence can perform a swapped-inverted LOOP
   * Requirement: end_position === start_position (returns to start)
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

    // Check if the (start, end) pair is valid for swapped-inverted (must return to start)
    const key = `${startPos},${endPos}`;

    if (!INVERTED_LOOP_VALIDATION_SET.has(key)) {
      throw new Error(
        `Invalid position pair for swapped-inverted LOOP: ${startPos} → ${endPos}. ` +
          `For a swapped-inverted LOOP, the sequence must end at the same position it started (${startPos}).`
      );
    }
  }

  /**
   * Create a new LOOP entry by transforming a previous beat with SWAP + INVERTED
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

    // Get inverted letter
    const invertedLetter = this._getInvertedLetter(previousMatchingBeat);

    // Create the new beat with swapped and inverted attributes
    // KEY: Blue gets attributes from Red's matching beat (SWAP)
    //      Red gets attributes from Blue's matching beat (SWAP)
    //      Then motion types and rotations are flipped (INVERTED)
    const newBeat: BeatData = {
      ...previousMatchingBeat,
      id: `beat-${beatNumber}`,
      beatNumber,
      letter: invertedLetter, // INVERTED
      startPosition: previousBeat.endPosition ?? null,
      endPosition: previousMatchingBeat.endPosition ?? null, // Same as matching beat (returns to start), handle undefined
      motions: {
        // SWAP: Blue does what Red did, with inverted transformation
        [MotionColor.BLUE]: this._createSwappedInvertedMotion(
          MotionColor.BLUE,
          previousBeat,
          previousMatchingBeat,
          true // isSwapped = true (use opposite color's data)
        ),
        // SWAP: Red does what Blue did, with inverted transformation
        [MotionColor.RED]: this._createSwappedInvertedMotion(
          MotionColor.RED,
          previousBeat,
          previousMatchingBeat,
          true // isSwapped = true (use opposite color's data)
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
   * Get inverted letter
   */
  private _getInvertedLetter(previousMatchingBeat: BeatData): Letter {
    const letter = previousMatchingBeat.letter;

    if (!letter) {
      throw new Error("Previous matching beat must have a letter");
    }

    const invertedLetter = getInvertedLetter(letter as string) as Letter;

    return invertedLetter;
  }

  /**
   * Create swapped-inverted motion data for the new beat
   * Combines color swapping with inverted transformations
   */
  private _createSwappedInvertedMotion(
    color: MotionColor,
    previousBeat: BeatData,
    previousMatchingBeat: BeatData,
    isSwapped: boolean
  ): MotionData {
    // SWAP: Get the opposite color's motion data
    const oppositeColor =
      color === MotionColor.BLUE ? MotionColor.RED : MotionColor.BLUE;

    // When swapped, this color follows the opposite color's path
    // So its start location must continue from where the opposite color ended
    const previousMotion = isSwapped
      ? previousBeat.motions[oppositeColor]
      : previousBeat.motions[color];

    const matchingMotion = isSwapped
      ? previousMatchingBeat.motions[oppositeColor]
      : previousMatchingBeat.motions[color];

    if (!previousMotion || !matchingMotion) {
      throw new Error(`Missing motion data for ${color}`);
    }

    // Get start location from previous motion's end (for continuity)
    const startLocation = previousMotion.endLocation;

    // INVERTED: Flip the motion type (PRO ↔ ANTI)
    const invertedMotionType = this._getInvertedMotionType(
      matchingMotion.motionType
    );

    // For STATIC motions, end = start (no movement)
    // For other motions, keep the matching motion's end location
    const endLocation =
      invertedMotionType === MotionType.STATIC
        ? startLocation
        : matchingMotion.endLocation;

    // INVERTED: Flip the prop rotation direction
    const invertedPropRotDir = this._getInvertedPropRotDir(
      matchingMotion.rotationDirection
    );

    // Create swapped-inverted motion
    const swappedInvertedMotion = {
      ...matchingMotion,
      color, // IMPORTANT: Preserve the color (Blue stays Blue, Red stays Red)
      motionType: invertedMotionType, // Flipped
      startLocation,
      endLocation,
      rotationDirection: invertedPropRotDir, // Flipped
      // Start orientation will be set by OrientationCalculator
      // End orientation will be calculated by OrientationCalculator
    };

    return swappedInvertedMotion;
  }

  /**
   * Get inverted motion type (flip PRO ↔ ANTI)
   * Other motion types (FLOAT, DASH, STATIC) remain unchanged
   */
  private _getInvertedMotionType(motionType: MotionType): MotionType {
    if (motionType === MotionType.PRO) {
      return MotionType.ANTI;
    } else if (motionType === MotionType.ANTI) {
      return MotionType.PRO;
    }

    // FLOAT, DASH, STATIC stay the same
    return motionType;
  }

  /**
   * Get inverted prop rotation direction (flip CLOCKWISE ↔ COUNTER_CLOCKWISE)
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
