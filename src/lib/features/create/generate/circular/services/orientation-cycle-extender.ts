/**
 * SequenceData adapter for the sequence engine's orientation-cycle closure.
 */

import { closeOrientationCycle } from "@tka/sequence-engine/loop";
import type {
  Orientation as EngineOrientation,
  SequenceStep,
} from "@tka/sequence-engine";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { updateSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

export class OrientationCycleExtender {
  extendIfNeeded(sequence: SequenceData): SequenceData {
    const startPosition =
      sequence.startPosition ?? sequence.startingPosition;
    const blueStart =
      startPosition?.motions?.blue?.startOrientation ??
      sequence.steps[0]?.motions.blue?.startOrientation ??
      "in";
    const redStart =
      startPosition?.motions?.red?.startOrientation ??
      sequence.steps[0]?.motions.red?.startOrientation ??
      "in";

    // SequenceData's StepData adds app-only reversal fields to the engine
    // shape. The engine clones each source step, so those fields survive.
    const result = closeOrientationCycle(
      sequence.steps as unknown as readonly SequenceStep[],
      {
        startOrientations: {
          blue: blueStart as EngineOrientation,
          red: redStart as EngineOrientation,
        },
      }
    );

    if (result.orientationCycleCount === 1) {
      return updateSequenceData(sequence, { orientationCycleCount: 1 });
    }

    return updateSequenceData(sequence, {
      steps: result.steps as unknown as StepData[],
      word: sequence.word.repeat(result.orientationCycleCount),
      orientationCycleCount: result.orientationCycleCount,
    });
  }
}

export const orientationCycleExtender = new OrientationCycleExtender();
