/**
 * Orientation Cycle Detection Service
 *
 * Determines how many repetitions of a sequence are needed to return
 * to the starting prop orientation.
 *
 * For LOOP sequences, the sequence may return to the starting grid position
 * after one repetition, but the prop orientation might be rotated 90° or 180°.
 * This service detects whether the sequence needs 1, 2, or 4 repetitions
 * to return to both the starting position AND orientation.
 *
 * Algorithm:
 * 1. Extract starting orientation from start position or first beat
 * 2. Track orientation changes through each beat
 * 3. After sequence completes, check if orientation matches start
 * 4. If not, simulate additional repetitions (up to 4 total)
 * 5. Return the minimum number of cycles needed
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../../../shared/domain/models/StepData";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { StartPositionData } from "../../../../shared/domain/models/StartPositionData";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface OrientationCycleResult {
  /** Number of repetitions needed (1, 2, or 4) */
  cycleCount: 1 | 2 | 4;
  /** Blue prop orientation after each repetition */
  blueOrientations: Orientation[];
  /** Red prop orientation after each repetition */
  redOrientations: Orientation[];
}

export class OrientationCycleDetector {
  constructor(private readonly orientationCalculator: IOrientationCalculator) {}

  /**
   * Detect how many repetitions are needed to return to starting orientation
   */
  detectOrientationCycle(sequence: SequenceData): OrientationCycleResult {
    const steps = sequence.steps;

    if (!steps || steps.length === 0) {
      // Empty sequence - trivially returns in 1 cycle
      return {
        cycleCount: 1,
        blueOrientations: [Orientation.IN],
        redOrientations: [Orientation.IN],
      };
    }

    // Get starting orientations
    const startOrientations = this.getStartingOrientations(sequence);

    // Track orientations through repetitions
    const blueOrientations: Orientation[] = [startOrientations.blue];
    const redOrientations: Orientation[] = [startOrientations.red];

    let currentBlue = startOrientations.blue;
    let currentRed = startOrientations.red;

    // Simulate up to 4 repetitions
    for (let rep = 1; rep <= 4; rep++) {
      // Step through each beat, recalculating orientations from the accumulated
      // current orientation. We can't just re-read stored endOrientation because
      // those values are fixed from the original pass — on subsequent passes the
      // start orientations differ, producing different end orientations.
      for (const step of steps) {
        const blueMotion = step.motions.blue;
        const redMotion = step.motions.red;

        if (blueMotion) {
          const adjusted = { ...blueMotion, startOrientation: currentBlue };
          currentBlue = this.orientationCalculator.calculateEndOrientation(
            adjusted,
            MotionColor.BLUE
          );
        }
        if (redMotion) {
          const adjusted = { ...redMotion, startOrientation: currentRed };
          currentRed = this.orientationCalculator.calculateEndOrientation(
            adjusted,
            MotionColor.RED
          );
        }
      }

      blueOrientations.push(currentBlue);
      redOrientations.push(currentRed);

      // Check if we're back to starting orientation
      if (
        currentBlue === startOrientations.blue &&
        currentRed === startOrientations.red
      ) {
        return {
          cycleCount: rep as 1 | 2 | 4,
          blueOrientations,
          redOrientations,
        };
      }
    }

    // If we haven't returned after 4 reps, something is wrong
    // Default to 4 (maximum cycle count)
    console.warn(
      `Sequence ${sequence.id} did not return to starting orientation after 4 repetitions`
    );
    return {
      cycleCount: 4,
      blueOrientations,
      redOrientations,
    };
  }

  /**
   * Extract starting orientations from start position or first beat
   */
  private getStartingOrientations(sequence: SequenceData): {
    blue: Orientation;
    red: Orientation;
  } {
    // Try start position first
    const startPos = sequence.startPosition || sequence.startingPosition;

    if (startPos && this.isStartPositionData(startPos)) {
      const blueMotion = startPos.motions?.blue;
      const redMotion = startPos.motions?.red;

      return {
        blue: blueMotion?.startOrientation ?? Orientation.IN,
        red: redMotion?.startOrientation ?? Orientation.IN,
      };
    }

    // Fall back to first beat if no start position
    const firstStep = sequence.steps[0];
    if (firstStep) {
      const blueMotion = firstStep.motions?.blue;
      const redMotion = firstStep.motions?.red;

      return {
        blue: blueMotion?.startOrientation ?? Orientation.IN,
        red: redMotion?.startOrientation ?? Orientation.IN,
      };
    }

    // Default to IN orientation
    return {
      blue: Orientation.IN,
      red: Orientation.IN,
    };
  }

  /**
   * Type guard for StartPositionData
   */
  private isStartPositionData(
    data: StartPositionData | StepData
  ): data is StartPositionData {
    return "isStartPosition" in data && data.isStartPosition === true;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";

export const orientationCycleDetector = new OrientationCycleDetector(
  orientationCalculator
);
