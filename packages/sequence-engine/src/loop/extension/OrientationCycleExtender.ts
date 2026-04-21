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

  // Separate beat steps from the start-position step
  const startStep = steps.find((s) => (s.stepNumber ?? s.stepNumber) === 0);
  const beatSteps = steps.filter((s) => (s.stepNumber ?? s.stepNumber) > 0);

  const extendedBeats: SequenceStep[] = [...beatSteps];

  // Get the last beat of the original sequence to seed orientation propagation
  let previousBeat: SequenceStep = beatSteps[beatSteps.length - 1]!;

  // Clone and re-orient beats for each additional pass
  for (let pass = 1; pass < result.cycleCount; pass++) {
    for (let i = 0; i < beatSteps.length; i++) {
      const sourceBeat = beatSteps[i]!;

      // Clone the beat with an updated step number
      const cloned: SequenceStep = {
        ...sourceBeat,
        stepNumber: extendedBeats.length + 1,
        motions: {
          blue: { ...sourceBeat.motions.blue },
          red: { ...sourceBeat.motions.red },
        },
      };

      // Propagate orientations from previous beat and recalculate
      const reOriented = updateStepOrientations(cloned, previousBeat);

      extendedBeats.push(reOriented);
      previousBeat = reOriented;
    }
  }

  // Rebuild full steps array with start step + extended beats
  const fullSteps: SequenceStep[] = startStep
    ? [startStep, ...extendedBeats]
    : extendedBeats;

  return {
    steps: fullSteps,
    cycleCount: result.cycleCount,
    word: word.repeat(result.cycleCount),
  };
}
