/**
 * SequenceData adapter for the sequence engine's orientation-cycle analysis.
 *
 * Orientation math belongs to @tka/sequence-engine. This module only reads the
 * app's separately stored start position and converts the result to app enums.
 */

import { analyzeOrientationCycle } from "@tka/sequence-engine/loop";
import type {
  Orientation as EngineOrientation,
  SequenceStep,
} from "@tka/sequence-engine";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { Step } from "@tka/tka-types";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";

export interface OrientationCycleResult {
  cycleCount: 1 | 2 | 4 | 8;
  blueOrientations: Orientation[];
  redOrientations: Orientation[];
}

export function detectOrientationCycle(
  sequence: SequenceData
): OrientationCycleResult {
  const start = getStartingOrientations(sequence);
  // SequenceData's StepData adds app-only reversal fields to the engine shape.
  const result = analyzeOrientationCycle(
    sequence.steps as unknown as readonly SequenceStep[],
    {
    startOrientations: {
      blue: start.blue as EngineOrientation,
      red: start.red as EngineOrientation,
    },
    }
  );

  return {
    cycleCount: result.cycleCount,
    blueOrientations: result.blueOrientations as Orientation[],
    redOrientations: result.redOrientations as Orientation[],
  };
}

function getStartingOrientations(sequence: SequenceData): {
  blue: Orientation;
  red: Orientation;
} {
  const startPosition = sequence.startPosition || sequence.startingPosition;

  if (startPosition && isStartPositionData(startPosition)) {
    return {
      blue:
        startPosition.motions?.blue?.startOrientation ?? Orientation.IN,
      red:
        startPosition.motions?.red?.startOrientation ?? Orientation.IN,
    };
  }

  const firstStep = sequence.steps[0];
  return {
    blue: firstStep?.motions.blue?.startOrientation ?? Orientation.IN,
    red: firstStep?.motions.red?.startOrientation ?? Orientation.IN,
  };
}

function isStartPositionData(
  data: StartPositionData | Step
): data is StartPositionData {
  return "isStartPosition" in data && data.isStartPosition === true;
}
