/**
 * Simplified Workbench Service
 *
 * Focused service combining all essential workbench functionality.
 * Follows the same simplification pattern as OptionPickerService.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { createPictographData } from "$lib/shared/pictograph/shared/domain/factories/createPictographData";
import { updateSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { createStepData } from "$lib/shared/create/factories/createStepData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import {
  saveSequence as persistSaveSequence,
} from "$lib/shared/persistence/services/dexie-persistence-service";
import type { SequenceRepository } from "$lib/shared/create/services/SequenceRepository";
export class Workbench {
  constructor(
    private sequenceService: SequenceRepository,
  ) {}

  // ============================================================================
  // CORE WORKBENCH OPERATIONS
  // ============================================================================

  /**
   * Handle beat click interaction
   */
  handleStepClick(stepIndex: number, sequence: SequenceData | null): boolean {
    // Simple logic: always allow selection if sequence exists and index is valid
    if (!sequence || stepIndex < 0 || stepIndex >= sequence.steps.length) {
      return false;
    }
    return true;
  }

  /**
   * Edit a beat with default pictograph data
   */
  editBeat(stepIndex: number, sequence: SequenceData): StepData {
    if (stepIndex < 0 || stepIndex >= sequence.steps.length) {
      throw new Error(`Invalid beat index: ${stepIndex}`);
    }

    const originalStep = sequence.steps[stepIndex];
    const defaultPictographData = createPictographData({ letter: Letter.A });

    return createStepData({
      ...originalStep,
      ...defaultPictographData, // Spread PictographData properties since StepData extends PictographData
      isBlank: false,
    });
  }

  /**
   * Clear a beat (make it blank)
   */
  clearBeat(stepIndex: number, sequence: SequenceData): StepData {
    if (stepIndex < 0 || stepIndex >= sequence.steps.length) {
      throw new Error(`Invalid beat index: ${stepIndex}`);
    }

    const originalStep = sequence.steps[stepIndex];

    return createStepData({
      ...originalStep,
      isBlank: true,
      // Reset pictograph properties to blank state
      letter: null,
      startPosition: null,
      endPosition: null,
      motions: {},
    });
  }

  /**
   * Add a beat to a sequence
   */
  async addStep(
    sequenceId: string,
    stepData?: Partial<StepData>
  ): Promise<SequenceData> {
    try {
      const sequence = await this.sequenceService.getSequence(sequenceId);
      if (!sequence) {
        throw new Error(`Sequence ${sequenceId} not found`);
      }

      const newStep = createStepData({
        isBlank: true,
        ...stepData, // Spread any provided step data (which may include PictographData properties)
      });

      const updatedSequence = updateSequenceData(sequence, {
        steps: [...sequence.steps, newStep],
      });

      await persistSaveSequence(updatedSequence);
      return updatedSequence;
    } catch (error) {
      console.error("Failed to add beat:", error);
      throw new Error(
        `Failed to add beat: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Set construction start position
   */
  async setConstructionStartPosition(
    sequenceId: string,
    startPosition: StartPositionData
  ): Promise<SequenceData> {
    try {
      const sequence = await this.sequenceService.getSequence(sequenceId);
      if (!sequence) {
        throw new Error(`Sequence ${sequenceId} not found`);
      }

      const updatedSequence = updateSequenceData(sequence, {
        startPosition: startPosition,
        startingPosition: startPosition, // CRITICAL: Set both fields for compatibility
      });

      await persistSaveSequence(updatedSequence);
      return updatedSequence;
    } catch (error) {
      console.error("Failed to set construction start position:", error);
      throw new Error(
        `Failed to set start position: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // ============================================================================
  // SEQUENCE OPERATIONS
  // ============================================================================

  /**
   * Validate beat operations
   */
  canEditBeat(stepIndex: number, sequence: SequenceData | null): boolean {
    if (!sequence || stepIndex < 0 || stepIndex >= sequence.steps.length) {
      return false;
    }
    return true;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { sequenceRepository } from "$lib/shared/create/services/SequenceRepository";

export const workbench = new Workbench(sequenceRepository);
