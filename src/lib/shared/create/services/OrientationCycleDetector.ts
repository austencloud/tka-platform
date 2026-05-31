/**
 * Algorithm:
 * 1. Extract starting orientation from start position or first beat
 * 2. Track orientation changes through each beat
 * 3. After sequence completes, check if orientation matches start
 * 4. If not, simulate additional repetitions (up to 4 total)
 * 5. Return the minimum number of cycles needed
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import { calculateEndOrientation } from "$lib/shared/pictograph/prop/services/orientation-calculator";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface OrientationCycleResult {
  /** Number of repetitions needed (1, 2, or 4) */
  cycleCount: 1 | 2 | 4;
  blueOrientations: Orientation[];
  redOrientations: Orientation[];
}

export function detectOrientationCycle(
  sequence: SequenceData
): OrientationCycleResult {
  const steps = sequence.steps;

  if (!steps || steps.length === 0) {
    return {
      cycleCount: 1,
      blueOrientations: [Orientation.IN],
      redOrientations: [Orientation.IN],
    };
  }

  const startOrientations = getStartingOrientations(sequence);

  const blueOrientations: Orientation[] = [startOrientations.blue];
  const redOrientations: Orientation[] = [startOrientations.red];

  let currentBlue = startOrientations.blue;
  let currentRed = startOrientations.red;

  for (let rep = 1; rep <= 4; rep++) {
    // Step through each beat, recalculating orientations from the accumulated
    // current orientation. We can't just re-read stored endOrientation because
    // those values are fixed from the original pass - on subsequent passes the
    // start orientations differ, producing different end orientations.
    for (const step of steps) {
      const blueMotion = step.motions.blue;
      const redMotion = step.motions.red;

      if (blueMotion) {
        const adjusted = { ...blueMotion, startOrientation: currentBlue };
        currentBlue = calculateEndOrientation(adjusted, MotionColor.BLUE);
      }
      if (redMotion) {
        const adjusted = { ...redMotion, startOrientation: currentRed };
        currentRed = calculateEndOrientation(adjusted, MotionColor.RED);
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

function getStartingOrientations(sequence: SequenceData): {
  blue: Orientation;
  red: Orientation;
} {
  // Try start position first
  const startPos = sequence.startPosition || sequence.startingPosition;

  if (startPos && isStartPositionData(startPos)) {
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

  // Default to IN
  return {
    blue: Orientation.IN,
    red: Orientation.IN,
  };
}

function isStartPositionData(
  data: StartPositionData | StepData
): data is StartPositionData {
  return "isStartPosition" in data && data.isStartPosition === true;
}
