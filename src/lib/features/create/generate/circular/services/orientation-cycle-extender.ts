/**
 * Automatically invoked whenever a freshly generated LOOP has orientationCycleCount > 1.
 * Atomic closure ensures the user never sees an open-orientation sequence.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import { detectOrientationCycle } from "$lib/shared/create/services/OrientationCycleDetector";
import {
  updateStartOrientations,
  updateEndOrientations,
} from "$lib/shared/pictograph/prop/services/orientation-calculator";
import {
  updateSequenceData,
} from "$lib/shared/foundation/domain/models/SequenceData";

export class OrientationCycleExtender {
  extendIfNeeded(sequence: SequenceData): SequenceData {
    const result = detectOrientationCycle(sequence);

    if (result.cycleCount === 1) {
      return updateSequenceData(sequence, { orientationCycleCount: 1 });
    }

    const originalSteps = sequence.steps;
    const extendedSteps: StepData[] = [...originalSteps];

    let previousBeat: StepData = originalSteps[originalSteps.length - 1]!;

    for (let pass = 1; pass < result.cycleCount; pass++) {
      for (let i = 0; i < originalSteps.length; i++) {
        const sourceStep = originalSteps[i]!;

        let cloned: StepData = {
          ...sourceStep,
          stepNumber: extendedSteps.length + 1,
        };

        cloned = updateStartOrientations(
          cloned,
          previousBeat
        );

        cloned = updateEndOrientations(cloned);

        extendedSteps.push(cloned);
        previousBeat = cloned;
      }
    }

    const extendedWord = sequence.word.repeat(result.cycleCount);

    return updateSequenceData(sequence, {
      steps: extendedSteps,
      word: extendedWord,
      orientationCycleCount: result.cycleCount,
    });
  }
}

export const orientationCycleExtender = new OrientationCycleExtender();
