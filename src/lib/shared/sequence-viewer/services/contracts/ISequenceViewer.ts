import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

export interface ISequenceViewer {
  loadSequence(sequenceId: string): Promise<SequenceData | null>;

  decodeSequence(encodedSequence: string): SequenceData | null;

  updateStepOrientation(
    sequence: SequenceData,
    stepIndex: number,
    color: string,
    orientation: string
  ): SequenceData;

  updateStepTurns(
    sequence: SequenceData,
    stepIndex: number,
    color: string,
    turnAmount: number | "fl"
  ): SequenceData;

  removeStep(sequence: SequenceData, stepIndex: number): SequenceData;

  saveSequence(sequence: SequenceData): Promise<void>;

  getThumbnailUrl(sequence: SequenceData, variationIndex?: number): string;

  encodeForUrl(sequence: SequenceData): string;

  generateShareUrl(sequence: SequenceData): string;

  /**
   * 0 = start position, 1+ = steps
   */
  getStepData(sequence: SequenceData, stepIndex: number): StepData | null;
}
