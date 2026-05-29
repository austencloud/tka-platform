import type { SequenceData } from "../../foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import {
  loadSequence as persistLoadSequence,
  saveSequence as persistSaveSequence,
} from "../../persistence/services/dexie-persistence-service";
import {
  decodeSequenceWithCompression,
  encodeSequenceWithCompression,
  generateViewerURL,
} from "../../navigation/services/sequence-encoder";
import {
  updateSequenceData,
  removeStepFromSequence,
} from "../../foundation/domain/models/SequenceData";

export class SequenceViewer {

  async loadSequence(sequenceId: string): Promise<SequenceData | null> {
    try {
      return await persistLoadSequence(sequenceId);
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
      return decodeSequenceWithCompression(encodedSequence);
    } catch (error) {
      console.error("[SequenceViewer] Failed to decode sequence:", error);
      return null;
    }
  }

  updateStepOrientation(
    sequence: SequenceData,
    stepIndex: number,
    color: string,
    orientation: string
  ): SequenceData {
    if (stepIndex === 0) {
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
    return removeStepFromSequence(sequence, stepIndex);
  }

  async saveSequence(sequence: SequenceData): Promise<void> {
    try {
      await persistSaveSequence(sequence);
    } catch (error) {
      console.error("[SequenceViewer] Failed to save sequence:", error);
      throw error;
    }
  }

  getThumbnailUrl(sequence: SequenceData, variationIndex = 0): string {
    if (!sequence.thumbnails || sequence.thumbnails.length === 0) {
      return "";
    }

    const index = Math.min(variationIndex, sequence.thumbnails.length - 1);
    return sequence.thumbnails[index] ?? "";
  }

  encodeForUrl(sequence: SequenceData): string {
    const result = encodeSequenceWithCompression(sequence);
    return result.encoded;
  }

  generateShareUrl(sequence: SequenceData): string {
    const result = generateViewerURL(sequence, {
      compress: true,
    });
    return result.url;
  }

  getStepData(sequence: SequenceData, stepIndex: number): StepData | null {
    if (stepIndex === 0) {
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

    const arrayIndex = stepIndex - 1;
    if (arrayIndex < 0 || arrayIndex >= sequence.steps.length) {
      return null;
    }

    return sequence.steps[arrayIndex] as StepData;
  }

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
