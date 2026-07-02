import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";

export class FrameBuilder {
  calculateBeatNumber(
    sequenceData: SequenceData | null,
    stepData: StartPositionData | StepData | null
  ): number {
    if (!sequenceData || !stepData) return 0;
    const stepIndex = sequenceData.steps?.findIndex((b) => b === stepData);
    if (stepIndex !== undefined && stepIndex >= 0) {
      return stepIndex + 1;
    }
    return 0;
  }

  calculateTurnsTuple(
    stepData: StartPositionData | StepData | null,
    turnsTupleGenerator: { generateTurnsTuple(step: PictographData): string } | null
  ): string {
    if (
      !stepData ||
      !("motions" in stepData) ||
      !isVisibleMotion(stepData.motions?.blue) ||
      !isVisibleMotion(stepData.motions?.red)
    ) {
      return "(s, 0, 0)";
    }
    return turnsTupleGenerator?.generateTurnsTuple(stepData as StepData) ?? "(s, 0, 0)";
  }

  calculateMusicalPosition(
    sequenceData: SequenceData | null,
    stepData: StartPositionData | StepData | null,
    orchestrator: { isInitialized(): boolean; getContinuousMusicalPosition(): number } | null
  ): string | null {
    if (orchestrator?.isInitialized()) {
      const continuousPosition = orchestrator.getContinuousMusicalPosition();
      if (continuousPosition <= 0) return null;
      return continuousPosition.toFixed(1);
    }

    if (stepData && sequenceData) {
      const stepIndex = sequenceData.steps?.findIndex((b) => b === stepData);
      if (stepIndex !== undefined && stepIndex >= 0) {
        return `${stepIndex + 1}.0`;
      }
    }

    return null;
  }
}
