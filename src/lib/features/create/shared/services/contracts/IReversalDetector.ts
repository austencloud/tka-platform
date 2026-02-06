/**
 * Reversal Detection Service Contract
 *
 * Detects reversals between steps in sequences based on prop rotation direction changes.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../domain/models/StepData";

export interface ReversalInfo {
  blueReversal: boolean;
  redReversal: boolean;
}

export interface PictographWithReversals extends PictographData {
  blueReversal: boolean;
  redReversal: boolean;
}

export interface IReversalDetector {
  /**
   * Process a sequence and apply reversal detection to all steps
   * @param sequence The sequence to process
   * @returns The sequence with reversal flags applied to steps
   */
  processReversals(sequence: SequenceData): SequenceData;

  /**
   * Detect reversal for an option preview based on current sequence
   * This is used to show reversal indicators on options before they're selected
   * @param currentSequence The current sequence of steps
   * @param optionPictographData The option's pictograph data to check for reversals
   * @returns Reversal information for the option
   */
  detectReversalForOption(
    currentSequence: StepData[],
    optionPictographData: PictographData
  ): ReversalInfo;

  /**
   * Detect reversals for multiple option pictographs at once
   * This is optimized for option picker display where we need to show reversals for all options
   * @param currentSequence The current sequence of pictographs
   * @param options The option pictographs to check for reversals
   * @returns Array of pictographs with reversal information attached
   */
  detectReversalsForOptions(
    currentSequence: PictographData[],
    options: PictographData[]
  ): PictographWithReversals[];
}
