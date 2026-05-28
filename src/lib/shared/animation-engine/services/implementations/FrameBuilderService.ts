import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

export class FrameBuilderService {
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
      !stepData.motions?.blue ||
      !stepData.motions?.red
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
