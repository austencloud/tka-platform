/**
 * Prop Type Applier Implementation
 *
 * Applies a specific prop type to all motions in a sequence.
 * Creates new objects to avoid mutating the original sequence.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
export class PropTypeApplier {
  applyToSequence(sequence: SequenceData, propType: PropType): SequenceData {
    return {
      ...sequence,
      startPosition: sequence.startPosition
        ? this.applyToStartPosition(sequence.startPosition, propType)
        : undefined,
      steps: sequence.steps?.map((step) => this.applyToBeat(step, propType)) ?? [],
    };
  }

  private applyToBeat(beat: StepData, propType: PropType): StepData {
    if (!beat.motions) return beat;

    return {
      ...beat,
      motions: {
        blue: beat.motions.blue ? { ...beat.motions.blue, propType } : undefined,
        red: beat.motions.red ? { ...beat.motions.red, propType } : undefined,
      },
    };
  }

  private applyToStartPosition(
    startPos: StartPositionData,
    propType: PropType
  ): StartPositionData {
    if (!startPos.motions) return startPos;

    return {
      ...startPos,
      motions: {
        blue: startPos.motions.blue ? { ...startPos.motions.blue, propType } : undefined,
        red: startPos.motions.red ? { ...startPos.motions.red, propType } : undefined,
      },
    };
  }
}
