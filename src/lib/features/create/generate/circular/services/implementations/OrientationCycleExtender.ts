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
 * ## Usage
 *
 * Since the Complete Cycle button was removed, this extender is invoked
 * automatically inside `generate-actions.svelte.ts` whenever a freshly
 * generated LOOP has `orientationCycleCount > 1`. The user never sees an
 * open-orientation sequence: closure is atomic with generation.
 *
 * Kept available for lab tooling (Collision Lab, orientation lab) that
 * needs to extend sequences manually.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../../../shared/domain/models/StepData";
import type { IOrientationCycleDetector } from "../contracts/IOrientationCycleDetector";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import type { IOrientationCycleExtender } from "../contracts/IOrientationCycleExtender";
import {
  updateSequenceData,
} from "$lib/shared/foundation/domain/models/SequenceData";

export class OrientationCycleExtender implements IOrientationCycleExtender {
  constructor(
    private readonly cycleDetector: IOrientationCycleDetector,
    private readonly orientationCalculator: IOrientationCalculator
  ) {}

  extendIfNeeded(sequence: SequenceData): SequenceData {
    const result = this.cycleDetector.detectOrientationCycle(sequence);

    if (result.cycleCount === 1) {
      return updateSequenceData(sequence, { orientationCycleCount: 1 });
    }

    const originalSteps = sequence.steps;
    const extendedSteps: StepData[] = [...originalSteps];

    // Get the last beat of the original sequence to seed orientation propagation
    let previousBeat: StepData = originalSteps[originalSteps.length - 1]!;

    // Clone and re-orient beats for each additional pass
    for (let pass = 1; pass < result.cycleCount; pass++) {
      for (let i = 0; i < originalSteps.length; i++) {
        const sourceStep = originalSteps[i]!;

        // Clone the beat with updated step number
        let cloned: StepData = {
          ...sourceStep,
          stepNumber: extendedSteps.length + 1,
        };

        // Propagate end orientations from previous beat → start of this beat
        cloned = this.orientationCalculator.updateStartOrientations(
          cloned,
          previousBeat
        );

        // Recalculate end orientations based on the new start orientations
        cloned = this.orientationCalculator.updateEndOrientations(cloned);

        extendedSteps.push(cloned);
        previousBeat = cloned;
      }
    }

    // Build extended word by repeating the original
    const extendedWord = sequence.word.repeat(result.cycleCount);

    return updateSequenceData(sequence, {
      steps: extendedSteps,
      word: extendedWord,
      orientationCycleCount: result.cycleCount,
    });
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { orientationCycleDetector } from "./OrientationCycleDetector";
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";

export const orientationCycleExtender = new OrientationCycleExtender(
  orientationCycleDetector,
  orientationCalculator
);
