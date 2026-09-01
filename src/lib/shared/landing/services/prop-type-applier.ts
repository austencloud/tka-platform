/**
 * Prop Type Applier
 *
 * Applies a specific prop type to all motions in a sequence.
 * Creates new objects to avoid mutating the original sequence.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

export function applyToSequence(sequence: SequenceData, propType: PropType): SequenceData {
  return {
    ...sequence,
    startPosition: sequence.startPosition
      ? applyToStartPosition(sequence.startPosition, propType)
      : undefined,
    steps: sequence.steps?.map((step) => applyToBeat(step, propType)) ?? [],
  };
}

function applyToBeat(beat: StepData, propType: PropType): StepData {
  if (!beat.motions) return beat;

  return {
    ...beat,
    motions: {
      left: { ...beat.motions.left, propType },
      right: { ...beat.motions.right, propType },
    },
  };
}

function applyToStartPosition(
  startPos: StartPositionData,
  propType: PropType
): StartPositionData {
  if (!startPos.motions) return startPos;

  return {
    ...startPos,
    motions: {
      left: startPos.motions.left ? { ...startPos.motions.left, propType } : undefined,
      right: startPos.motions.right ? { ...startPos.motions.right, propType } : undefined,
    },
  };
}
