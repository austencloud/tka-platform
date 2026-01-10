/**
 * Rewound LOOP Executor
 *
 * Executes the Rewound LOOP (Linked Offset Operation Pattern) by:
 * 1. Taking an existing sequence
 * 2. Reversing the beats and swapping their start/end positions
 * 3. Appending the reversed beats to double the sequence length
 *
 * Unlike traditional LOOPs which use geometric transformations (rotate, mirror, swap),
 * Rewound is a temporal transformation that plays the sequence backwards.
 *
 * Example: [1, 2, 3, 4] → [1, 2, 3, 4, 4', 3', 2', 1']
 * where each reversed beat has swapped start/end positions and reversed motion directions.
 *
 * IMPORTANT: Rewound works on ANY sequence regardless of position relationships.
 * No position validation is needed (unlike rotation-based LOOPs).
 */

import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  MotionColor,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { SliceSize } from "../../domain/models/circular-models";
import type { ILOOPExecutor } from "../contracts/ILOOPExecutor";

export class RewoundLOOPExecutor implements ILOOPExecutor {
  /**
   * Execute the Rewound LOOP
   *
   * @param sequence - The partial sequence to extend (must include start position at index 0)
   * @param _sliceSize - Ignored (Rewound always doubles the sequence)
   * @returns The complete sequence with reversed beats appended
   */
  executeLOOP(sequence: BeatData[], _sliceSize: SliceSize): BeatData[] {
    if (sequence.length < 2) {
      throw new Error(
        "Sequence must have at least 2 beats (start position + 1 beat)"
      );
    }

    // Remove start position (index 0) for processing
    const startPosition = sequence.shift();
    if (!startPosition) {
      throw new Error("Sequence must have a start position");
    }

    // Get the actual beats (without start position)
    const originalBeats = [...sequence];
    const originalLength = originalBeats.length;

    // Create reversed beats
    const reversedBeats: BeatData[] = [];
    const beatsToReverse = [...originalBeats].reverse();

    for (let i = 0; i < beatsToReverse.length; i++) {
      const sourceBeat = beatsToReverse[i]!;
      const newBeatNumber = originalLength + i + 1;

      // Get the previous beat's end position for continuity
      const previousBeat =
        i === 0
          ? originalBeats[originalBeats.length - 1]!
          : reversedBeats[i - 1]!;

      const rewoundBeat = this.createRewoundBeat(
        sourceBeat,
        previousBeat,
        newBeatNumber
      );

      reversedBeats.push(rewoundBeat);
    }

    // Combine: original beats + reversed beats
    const allBeats = [...originalBeats, ...reversedBeats];

    // Re-insert start position at the beginning
    allBeats.unshift(startPosition);

    return allBeats;
  }

  /**
   * Create a rewound beat from a source beat
   * Swaps start/end positions and reverses motion directions
   */
  private createRewoundBeat(
    sourceBeat: BeatData,
    previousBeat: BeatData,
    newBeatNumber: number
  ): BeatData {
    return {
      ...sourceBeat,
      id: `beat-${newBeatNumber}`,
      beatNumber: newBeatNumber,
      // Swap positions: new start = previous end, new end = source's start
      startPosition: previousBeat.endPosition ?? null,
      endPosition: sourceBeat.startPosition ?? null,
      // Reverse motions
      motions: {
        [MotionColor.BLUE]: this.createRewoundMotion(
          sourceBeat.motions[MotionColor.BLUE],
          previousBeat.motions[MotionColor.BLUE]
        ),
        [MotionColor.RED]: this.createRewoundMotion(
          sourceBeat.motions[MotionColor.RED],
          previousBeat.motions[MotionColor.RED]
        ),
      },
      // Swap reversals
      blueReversal: sourceBeat.redReversal ?? false,
      redReversal: sourceBeat.blueReversal ?? false,
    };
  }

  /**
   * Create a rewound motion from source motion
   * Swaps start/end locations and reverses rotation direction
   */
  private createRewoundMotion(
    sourceMotion: MotionData | undefined,
    previousMotion: MotionData | undefined
  ): MotionData {
    if (!sourceMotion) {
      return {} as MotionData;
    }

    // Reverse rotation direction
    const reversedRotation = this.reverseRotationDirection(
      sourceMotion.rotationDirection as RotationDirection
    );

    return {
      ...sourceMotion,
      // Swap locations: new start = previous end, new end = source's start
      startLocation: previousMotion?.endLocation ?? sourceMotion.endLocation,
      endLocation: sourceMotion.startLocation,
      // Reverse rotation direction
      rotationDirection: reversedRotation,
      // Swap orientations
      startOrientation: sourceMotion.endOrientation,
      endOrientation: sourceMotion.startOrientation,
    };
  }

  /**
   * Reverse rotation direction (CLOCKWISE ↔ COUNTER_CLOCKWISE)
   */
  private reverseRotationDirection(
    direction: RotationDirection
  ): RotationDirection {
    if (direction === RotationDirection.CLOCKWISE) {
      return RotationDirection.COUNTER_CLOCKWISE;
    } else if (direction === RotationDirection.COUNTER_CLOCKWISE) {
      return RotationDirection.CLOCKWISE;
    }
    return direction; // NO_ROTATION stays NO_ROTATION
  }
}
