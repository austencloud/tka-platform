/**
 * Mirrored Swapped LOOP Executor
 *
 * Executes the mirrored-swapped LOOP (Linked Orbital Offset Pattern) by combining:
 * 1. SWAPPED: Blue does what Red did, Red does what Blue did
 * 2. MIRRORED: Mirror locations vertically (E↔W), flip prop rotation (CW↔CCW)
 *
 * This creates a sequence where:
 * - Colors are swapped (Blue performs Red's actions and vice versa)
 * - Locations are mirrored vertically across the north-south axis
 * - Prop rotation directions are flipped
 * - Motion types stay the same
 * - Letters stay the same
 *
 * IMPORTANT: Slice size is ALWAYS halved (no quartering)
 * IMPORTANT: End position must be vertical mirror of start position
 */

import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  RotationDirection,
  MotionColor,
  MotionType,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type {
  GridPosition,
  GridLocation,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import {
  VERTICAL_MIRROR_POSITION_MAP,
  VERTICAL_MIRROR_LOCATION_MAP,
  SWAPPED_POSITION_MAP,
  MIRRORED_SWAPPED_VALIDATION_SET,
} from "../../domain/constants/strict-loop-position-maps";
import type { SliceSize } from "../../domain/models/circular-models";
import type { BeatData } from "../../../../shared/domain/models/BeatData";

export class MirroredSwappedLOOPExecutor {
  constructor(private OrientationCalculator: IOrientationCalculator) {}

  /**
   * Execute the mirrored-swapped LOOP
   *
   * @param sequence - The partial sequence to complete (must include start position at index 0)
   * @param sliceSize - Ignored (mirrored-swapped LOOP always uses halved)
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
   * Validate that the sequence can perform a mirrored-swapped LOOP
   * Requirement: end_position must be vertical mirror of start_position
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

    // Check if the (start, end) pair is valid for mirrored-swapped
    const key = `${startPos},${endPos}`;

    if (!MIRRORED_SWAPPED_VALIDATION_SET.has(key)) {
      throw new Error(
        `Invalid position pair for mirrored-swapped LOOP: ${startPos} → ${endPos}. ` +
          `For a mirrored-swapped LOOP, the end position must be the vertical mirror of start position.`
      );
    }
  }

  /**
   * Create a new LOOP entry by transforming a previous beat with SWAP + MIRROR
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

    // Get the mirrored AND swapped end position
    // For mirrored+swapped LOOP, we need to apply both transformations to the grid position
    const mirroredSwappedEndPosition =
      this._getMirroredSwappedPosition(previousMatchingBeat);

    // Create the new beat with swapped and mirrored attributes
    // KEY: Continuity is NORMAL (same color continues from where it was)
    //      But motion PATTERNS are swapped (blue does red's pattern, red does blue's)
    //      Then patterns are mirrored (cw↔ccw, e↔w)
    const newBeat: BeatData = {
      ...previousMatchingBeat,
      id: `beat-${beatNumber}`,
      beatNumber,
      letter: previousMatchingBeat.letter ?? null, // Same letter
      startPosition: previousBeat.endPosition ?? null, // NORMAL continuity (not swapped)
      endPosition: mirroredSwappedEndPosition,
      motions: {
        // SWAP: Blue does what Red did, but with mirrored transformation
        [MotionColor.BLUE]: this._createMirroredSwappedMotion(
          MotionColor.BLUE,
          previousBeat,
          previousMatchingBeat,
          true // isSwapped = true (use opposite color's data)
        ),
        // SWAP: Red does what Blue did, but with mirrored transformation
        [MotionColor.RED]: this._createMirroredSwappedMotion(
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
   * Get the mirrored AND swapped position
   * For mirrored+swapped LOOP, the end position must reflect both transformations:
   * 1. First mirror the position (east↔west)
   * 2. Then swap the colors (blue↔red positions)
   */
  private _getMirroredSwappedPosition(
    previousMatchingBeat: BeatData
  ): GridPosition | null {
    const endPos = previousMatchingBeat.endPosition;

    if (!endPos) {
      throw new Error("Previous matching beat must have an end position");
    }

    // First mirror, then swap (same order as LOOPEndPositionSelector)
    const mirroredPosition =
      VERTICAL_MIRROR_POSITION_MAP[endPos as GridPosition];
    const mirroredSwappedPosition = SWAPPED_POSITION_MAP[mirroredPosition];

    return mirroredSwappedPosition;
  }

  /**
   * Create mirrored-swapped motion data for the new beat
   * Combines color swapping with location mirroring and rotation flipping
   *
   * KEY INSIGHT:
   * - CONTINUITY is NORMAL: Same color continues from where it ended
   * - PATTERN is SWAPPED: Blue does what Red did, Red does what Blue did
   * - PATTERN is MIRRORED: Locations flip e↔w, rotations flip cw↔ccw
   */
  private _createMirroredSwappedMotion(
    color: MotionColor,
    previousBeat: BeatData,
    previousMatchingBeat: BeatData,
    _isSwapped: boolean // Kept for interface compatibility, always true for this executor
  ): MotionData {
    // Get the opposite color for pattern swapping
    const oppositeColor =
      color === MotionColor.BLUE ? MotionColor.RED : MotionColor.BLUE;

    // NORMAL CONTINUITY: Same color continues from where it was
    // (Blue continues from Blue's previous end, Red continues from Red's previous end)
    const previousMotion = previousBeat.motions[color];

    // SWAPPED PATTERN: Get the pattern from the opposite color's matching beat
    // (Blue follows Red's pattern from beat 1, Red follows Blue's pattern from beat 1)
    const matchingMotion = previousMatchingBeat.motions[oppositeColor];

    if (!previousMotion || !matchingMotion) {
      throw new Error(`Missing motion data for ${color}`);
    }

    // Get start location from THIS color's previous end (NORMAL continuity)
    const startLocation = previousMotion.endLocation;

    // For STATIC motions, end = start (no movement)
    // For other motions, mirror the end location vertically
    const endLocation =
      matchingMotion.motionType === MotionType.STATIC
        ? startLocation
        : this._getMirroredLocation(matchingMotion.endLocation as GridLocation);

    // Flip the prop rotation direction (mirroring effect)
    const mirroredPropRotDir = this._getMirroredPropRotDir(
      matchingMotion.rotationDirection
    );

    // Create mirrored-swapped motion
    const mirroredSwappedMotion = {
      ...matchingMotion,
      color, // IMPORTANT: Preserve the color (Blue stays Blue, Red stays Red)
      motionType: matchingMotion.motionType, // Same motion type (no inverted flip)
      startLocation,
      endLocation,
      rotationDirection: mirroredPropRotDir,
      // Start orientation will be set by OrientationCalculator
      // End orientation will be calculated by OrientationCalculator
    };

    return mirroredSwappedMotion;
  }

  /**
   * Mirror a location vertically (flip east/west)
   */
  private _getMirroredLocation(location: GridLocation): GridLocation {
    const mirrored = VERTICAL_MIRROR_LOCATION_MAP[location];

    return mirrored;
  }

  /**
   * Mirror prop rotation direction (flip CLOCKWISE ↔ COUNTER_CLOCKWISE)
   * NO_ROTATION stays NO_ROTATION
   */
  private _getMirroredPropRotDir(
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
