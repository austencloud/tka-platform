/**
 * Orientation Cycle Extender
 *
 * Detects whether a circular sequence needs multiple passes to return to
 * its starting orientation, then physically extends the sequence with
 * re-oriented beats for each additional pass.
 *
 * For example, a swapped LOOP starting at alpha6 in box mode might need
 * 2 passes: the first pass ends with non-radial orientations, and the
 * second pass (same motions, different start orientations) returns to radial.
 * Since the pictographs differ between passes, a repeat sign wouldn't work —
 * the performer needs to see the actual beat pictographs.
 *
 * Ported from app's OrientationCycleExtender.ts.
 */

import type { SequenceStep, Orientation } from "../../core/types/sequence-engine-types.js";
import { updateStepOrientations } from "../execution/orientation-helpers.js";
import { detectOrientationCycle } from "../detection/OrientationCycleDetector.js";

/**
 * Result of orientation cycle extension.
 */
export interface OrientationCycleExtensionResult {
  /** The extended steps (includes original + cloned passes) */
  steps: SequenceStep[];
  /** How many repetitions were needed */
  cycleCount: 1 | 2 | 4;
  /** The word repeated cycleCount times */
  word: string;
}

/**
 * Check if a sequence needs orientation cycle extension, and if so,
 * extend it by cloning beats with recalculated orientations.
 *
 * @param steps - Full step array (step 0 = start position, rest = beats)
 * @param word - The sequence word (will be repeated if extension is needed)
 * @returns Extended result with steps, cycle count, and updated word
 */
export function extendForOrientationCycle(
  steps: SequenceStep[],
  word: string
): OrientationCycleExtensionResult {
  const result = detectOrientationCycle(steps);

  if (result.cycleCount === 1) {
    return { steps, cycleCount: 1, word };
  }

  // Separate letter steps from the start-position step
  const startStep = steps.find((s) => (s.stepNumber ?? s.stepNumber) === 0);
  const letterSteps = steps.filter((s) => (s.stepNumber ?? s.stepNumber) > 0);

  const extendedSteps: SequenceStep[] = [...letterSteps];

  // Get the last step of the original sequence to seed orientation propagation
  let previousStep: SequenceStep = letterSteps[letterSteps.length - 1]!;

  // Clone and re-orient steps for each additional pass
  for (let pass = 1; pass < result.cycleCount; pass++) {
    for (let i = 0; i < letterSteps.length; i++) {
      const sourceStep = letterSteps[i]!;

      // Clone the step with an updated step number
      const cloned: SequenceStep = {
        ...sourceStep,
        stepNumber: extendedSteps.length + 1,
        motions: {
          blue: { ...sourceStep.motions.blue },
          red: { ...sourceStep.motions.red },
        },
      };

      // Propagate orientations from previous step and recalculate
      const reOriented = updateStepOrientations(cloned, previousStep);

      extendedSteps.push(reOriented);
      previousStep = reOriented;
    }
  }

  // Rebuild full steps array with start step + extended steps
  const fullSteps: SequenceStep[] = startStep
    ? [startStep, ...extendedSteps]
    : extendedSteps;

  return {
    steps: fullSteps,
    cycleCount: result.cycleCount,
    word: word.repeat(result.cycleCount),
  };
}
