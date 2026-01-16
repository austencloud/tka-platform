import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../domain/models/StepData";

/**
 * Coordination service for the Construct tab within the Create module
 * Restored minimal contract based on usages in CreateModuleEventHandler.
 */
export interface IConstructCoordinator {
  setupComponentCoordination(components: Record<string, unknown>): void;
  handleSequenceModified(sequence: SequenceData): Promise<void>;
  handleStartPositionSet(startPosition: StepData): void;
  handleBeatAdded(stepData: StepData): Promise<void>;
  handleGenerationRequest(config: Record<string, unknown>): void;
  handleUITransitionRequest(targetPanel: string): void;
}

// Legacy type alias for backward compatibility
/** @deprecated Use IConstructCoordinator instead */
export type IBuildConstructSectionCoordinator = IConstructCoordinator;
