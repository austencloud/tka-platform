/**
 * Orientation Cycle Detection
 *
 * Determines how many repetitions of a sequence are needed to return
 * to the starting prop orientation.
 *
 * For LOOP sequences, the sequence may return to the starting grid position
 * after one repetition, but the prop orientation might be rotated 90 or 180 degrees.
 * This detector figures out whether the sequence needs 1, 2, or 4 repetitions
 * to return to both the starting position AND orientation.
 *
 * Algorithm:
 * 1. Extract starting orientation from the start-position step or first beat
 * 2. Track orientation changes through each beat
 * 3. After one pass through the sequence, check if orientation matches start
 * 4. If not, simulate additional passes (up to 4 total)
 * 5. Return the minimum number of cycles needed
 *
 * Ported from app's OrientationCycleDetector.ts, adapted for engine types.
 */

import type { SequenceStep, Orientation } from "../../core/types/sequence-engine-types.js";
import { calculateEndOrientation } from "../../core/orientation/OrientationCalculator.js";

/**
 * Result of orientation cycle detection.
 */
export interface OrientationCycleResult {
  /** Number of repetitions needed (1, 2, or 4) */
  cycleCount: 1 | 2 | 4;
  /** Blue prop orientation after each repetition */
  blueOrientations: Orientation[];
  /** Red prop orientation after each repetition */
  redOrientations: Orientation[];
}

/**
 * Detect how many repetitions of the beat steps are needed to return
 * to the starting prop orientations.
 *
 * @param steps - Full step array where step 0 is the start position.
 *                Beats to cycle over are steps with stepNumber/beatIndex > 0.
 * @returns OrientationCycleResult with the cycle count and orientation history
 */
export function detectOrientationCycle(steps: SequenceStep[]): OrientationCycleResult {
  // Separate start-position step from beat steps
  const startStep = steps.find((s) => (s.stepNumber ?? s.stepNumber) === 0);
  const beatSteps = steps.filter((s) => (s.stepNumber ?? s.stepNumber) > 0);

  if (beatSteps.length === 0) {
    return {
      cycleCount: 1,
      blueOrientations: ["in"],
      redOrientations: ["in"],
    };
  }

  // Get starting orientations from start-position step or first beat
  const startOrientations = getStartingOrientations(startStep, beatSteps[0]!);

  const blueOrientations: Orientation[] = [startOrientations.blue];
  const redOrientations: Orientation[] = [startOrientations.red];

  let currentBlue: Orientation = startOrientations.blue;
  let currentRed: Orientation = startOrientations.red;

  // Simulate up to 4 repetitions
  for (let rep = 1; rep <= 4; rep++) {
    for (const beat of beatSteps) {
      const blue = beat.motions.blue;
      const red = beat.motions.red;

      if (blue) {
        currentBlue = calculateEndOrientation({
          motionType: blue.motionType,
          turns: blue.turns,
          rotationDirection: blue.rotationDirection,
          startLocation: blue.startLocation,
          endLocation: blue.endLocation,
          startOrientation: currentBlue,
        });
      }

      if (red) {
        currentRed = calculateEndOrientation({
          motionType: red.motionType,
          turns: red.turns,
          rotationDirection: red.rotationDirection,
          startLocation: red.startLocation,
          endLocation: red.endLocation,
          startOrientation: currentRed,
        });
      }
    }

    blueOrientations.push(currentBlue);
    redOrientations.push(currentRed);

    // Check if we're back to starting orientation
    if (currentBlue === startOrientations.blue && currentRed === startOrientations.red) {
      return {
        cycleCount: rep as 1 | 2 | 4,
        blueOrientations,
        redOrientations,
      };
    }
  }

  // If we haven't returned after 4 reps, default to 4 (maximum cycle count)
  return {
    cycleCount: 4,
    blueOrientations,
    redOrientations,
  };
}

/**
 * Extract starting orientations from the start-position step or first beat.
 */
function getStartingOrientations(
  startStep: SequenceStep | undefined,
  firstBeat: SequenceStep
): { blue: Orientation; red: Orientation } {
  // Try start-position step first
  if (startStep) {
    const blue = startStep.motions.blue;
    const red = startStep.motions.red;
    return {
      blue: (blue?.startOrientation as Orientation) ?? "in",
      red: (red?.startOrientation as Orientation) ?? "in",
    };
  }

  // Fall back to first beat
  const blue = firstBeat.motions.blue;
  const red = firstBeat.motions.red;
  return {
    blue: (blue?.startOrientation as Orientation) ?? "in",
    red: (red?.startOrientation as Orientation) ?? "in",
  };
}
