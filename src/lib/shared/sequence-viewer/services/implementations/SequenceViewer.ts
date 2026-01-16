/**
 * Sequence Viewer Service Implementation
 *
 * Provides operations for loading, viewing, and editing sequences
 * in the standalone Sequence Viewer context.
 */

import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { ISequenceViewer } from "../contracts/ISequenceViewer";
import type { IPersistenceService } from "../../../persistence/services/contracts/IPersistenceService";
import type { ISequenceEncoder } from "../../../navigation/services/contracts/ISequenceEncoder";
import {
  updateSequenceData,
  removeStepFromSequence,
} from "../../../foundation/domain/models/SequenceData";

export class SequenceViewer implements ISequenceViewer {
  constructor(
    private persistenceService: IPersistenceService,
    private SequenceEncoder: ISequenceEncoder
  ) {}

  // ============================================
  // SEQUENCE LOADING
  // ============================================

  async loadSequence(sequenceId: string): Promise<SequenceData | null> {
    try {
      return await this.persistenceService.loadSequence(sequenceId);
    } catch (error) {
      console.error(
        `[SequenceViewer] Failed to load sequence ${sequenceId}:`,
        error
      );
      return null;
    }
  }

  decodeSequence(encodedSequence: string): SequenceData | null {
    try {
      return this.SequenceEncoder.decodeWithCompression(encodedSequence);
    } catch (error) {
      console.error("[SequenceViewer] Failed to decode sequence:", error);
      return null;
    }
  }

  // ============================================
  // SEQUENCE MUTATIONS
  // ============================================

  updateStepOrientation(
    sequence: SequenceData,
    stepIndex: number,
    color: string,
    orientation: string
  ): SequenceData {
    if (stepIndex === 0) {
      // Update start position
      const startPosition = this.getStartPosition(sequence);
      if (!startPosition) return sequence;

      const updatedStartPosition = this.updateMotionOrientation(
        startPosition,
        color,
        orientation
      );
      return updateSequenceData(sequence, {
        startPosition: updatedStartPosition as StartPositionData,
        startingPosition: updatedStartPosition as StartPositionData,
      });
    }

    // Update regular beat (1-indexed in UI, 0-indexed in array)
    const arrayIndex = stepIndex - 1;
    if (arrayIndex < 0 || arrayIndex >= sequence.steps.length) {
      return sequence;
    }

    const beat = sequence.steps[arrayIndex];
    if (!beat) return sequence;

    const updatedStep = this.updateMotionOrientation(beat, color, orientation);
    const newSteps = [...sequence.steps];
    newSteps[arrayIndex] = updatedStep;

    return updateSequenceData(sequence, { steps: newSteps });
  }

  updateStepTurns(
    sequence: SequenceData,
    stepIndex: number,
    color: string,
    turnAmount: number | "fl"
  ): SequenceData {
    if (stepIndex === 0) {
      // Start position doesn't typically have turns, but handle anyway
      const startPosition = this.getStartPosition(sequence);
      if (!startPosition) return sequence;

      const updatedStartPosition = this.updateMotionTurns(
        startPosition,
        color,
        turnAmount
      );
      return updateSequenceData(sequence, {
        startPosition: updatedStartPosition as StartPositionData,
        startingPosition: updatedStartPosition as StartPositionData,
      });
    }

    // Update regular beat
    const arrayIndex = stepIndex - 1;
    if (arrayIndex < 0 || arrayIndex >= sequence.steps.length) {
      return sequence;
    }

    const beat = sequence.steps[arrayIndex];
    if (!beat) return sequence;

    const updatedStep = this.updateMotionTurns(beat, color, turnAmount);
    const newSteps = [...sequence.steps];
    newSteps[arrayIndex] = updatedStep;

    return updateSequenceData(sequence, { steps: newSteps });
  }

  removeStep(sequence: SequenceData, stepIndex: number): SequenceData {
    // stepIndex is 0-indexed here (matches array index)
    return removeStepFromSequence(sequence, stepIndex);
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  async saveSequence(sequence: SequenceData): Promise<void> {
    try {
      await this.persistenceService.saveSequence(sequence);
    } catch (error) {
      console.error("[SequenceViewer] Failed to save sequence:", error);
      throw error;
    }
  }

  // ============================================
  // THUMBNAILS & URLS
  // ============================================

  getThumbnailUrl(sequence: SequenceData, variationIndex = 0): string {
    if (!sequence.thumbnails || sequence.thumbnails.length === 0) {
      return "";
    }

    const index = Math.min(variationIndex, sequence.thumbnails.length - 1);
    return sequence.thumbnails[index] ?? "";
  }

  encodeForUrl(sequence: SequenceData): string {
    const result = this.SequenceEncoder.encodeWithCompression(sequence);
    return result.encoded;
  }

  generateShareUrl(sequence: SequenceData): string {
    const result = this.SequenceEncoder.generateViewerURL(sequence, {
      compress: true,
    });
    return result.url;
  }

  // ============================================
  // STEP DATA HELPERS
  // ============================================

  getStepData(sequence: SequenceData, stepIndex: number): StepData | null {
    if (stepIndex === 0) {
      // Return start position as StepData
      const startPos = this.getStartPosition(sequence);
      if (!startPos) return null;

      return {
        ...startPos,
        stepNumber: 0,
        duration: 1,
        blueReversal: false,
        redReversal: false,
        isBlank: false,
      } as StepData;
    }

    // Regular beat (1-indexed in UI, 0-indexed in array)
    const arrayIndex = stepIndex - 1;
    if (arrayIndex < 0 || arrayIndex >= sequence.steps.length) {
      return null;
    }

    return sequence.steps[arrayIndex] as StepData;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private getStartPosition(
    sequence: SequenceData
  ): StartPositionData | StepData | null {
    return (
      (sequence.startPosition as StartPositionData | StepData) ||
      (sequence.startingPosition as StartPositionData | StepData) ||
      null
    );
  }

  private updateMotionOrientation<
    T extends { motions?: Record<string, unknown> },
  >(data: T, color: string, orientation: string): T {
    if (!data.motions) return data;

    const motionKey = color === "blue" ? "blueMotion" : "redMotion";
    const motion = data.motions[motionKey];

    if (!motion) return data;

    return {
      ...data,
      motions: {
        ...data.motions,
        [motionKey]: {
          ...motion,
          startOrientation: orientation,
        },
      },
    };
  }

  private updateMotionTurns<T extends { motions?: Record<string, unknown> }>(
    data: T,
    color: string,
    turnAmount: number | "fl"
  ): T {
    if (!data.motions) return data;

    const motionKey = color === "blue" ? "blueMotion" : "redMotion";
    const motion = data.motions[motionKey];

    if (!motion) return data;

    return {
      ...data,
      motions: {
        ...data.motions,
        [motionKey]: {
          ...motion,
          turns: turnAmount,
        },
      },
    };
  }
}
