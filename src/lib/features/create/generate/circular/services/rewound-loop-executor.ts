/**
 * Rewound LOOP Executor
 *
 * Executes the Rewound LOOP (Linked Orbital Offset Pattern) by:
 * 1. Taking an existing sequence
 * 2. Reversing the steps and swapping their start/end positions
 * 3. Appending the reversed steps to double the sequence length
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

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionColor,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { Period } from "../domain/models/circular-models";
import type { ILOOPExecutor } from "./ILOOPExecutor";
import { LoopViabilityError } from "../../shared/domain/errors/loop-viability-error";

export class RewoundLOOPExecutor implements ILOOPExecutor {
  /**
   * Execute the Rewound LOOP
   *
   * @param sequence - The partial sequence to extend (must include start position at index 0)
   * @param _period - Ignored (Rewound always doubles the sequence)
   * @returns The complete sequence with reversed steps appended
   */
  executeLOOP(sequence: StepData[], period: Period): StepData[] {
    if (period === Period.QUARTERED) {
      throw new LoopViabilityError(
        "Quartered rewound is not a valid LOOP.",
        "Rewound is order 2 (reverse-of-reverse = identity). Use halved or pick a rotation-containing type."
      );
    }

    if (sequence.length < 2) {
      throw new Error(
        "Sequence must have at least 2 steps (start position + 1 beat)"
      );
    }

    // Remove start position (index 0) for processing
    const startPosition = sequence.shift();
    if (!startPosition) {
      throw new Error("Sequence must have a start position");
    }

    // Get the actual steps (without start position)
    const originalSteps = [...sequence];
    const originalLength = originalSteps.length;

    // Create reversed steps
    const reversedSteps: StepData[] = [];
    const beatsToReverse = [...originalSteps].reverse();

    for (let i = 0; i < beatsToReverse.length; i++) {
      const sourceStep = beatsToReverse[i]!;
      const newStepNumber = originalLength + i + 1;

      // Get the previous beat's end position for continuity
      const previousStep =
        i === 0
          ? originalSteps[originalSteps.length - 1]!
          : reversedSteps[i - 1]!;

      const rewoundBeat = this.createRewoundBeat(
        sourceStep,
        previousStep,
        newStepNumber
      );

      reversedSteps.push(rewoundBeat);
    }

    // Combine: original steps + reversed steps
    const allSteps = [...originalSteps, ...reversedSteps];

    // Re-insert start position at the beginning
    allSteps.unshift(startPosition);

    return allSteps;
  }

  /**
   * Create a rewound beat from a source beat
   * Swaps start/end positions and reverses motion directions
   */
  private createRewoundBeat(
    sourceStep: StepData,
    previousStep: StepData,
    newStepNumber: number
  ): StepData {
    return {
      ...sourceStep,
      id: `step-${newStepNumber}`,
      stepNumber: newStepNumber,
      // Swap positions: new start = previous end, new end = source's start
      startPosition: previousStep.endPosition ?? null,
      endPosition: sourceStep.startPosition ?? null,
      // Reverse motions
      motions: {
        [MotionColor.BLUE]: this.createRewoundMotion(
          sourceStep.motions[MotionColor.BLUE],
          previousStep.motions[MotionColor.BLUE]
        ),
        [MotionColor.RED]: this.createRewoundMotion(
          sourceStep.motions[MotionColor.RED],
          previousStep.motions[MotionColor.RED]
        ),
      },
      // Swap reversals
      blueReversal: sourceStep.redReversal ?? false,
      redReversal: sourceStep.blueReversal ?? false,
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

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const rewoundLOOPExecutor = new RewoundLOOPExecutor();
