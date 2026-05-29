/**
 * Letter Deriver Service Implementation
 *
 * Derives letters from motion data for deep link sequences.
 * Uses motion query handler and grid mode deriver to match
 * motion configurations to their corresponding letters.
 *
 * Domain: Navigation - Letter Derivation
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";
import { deriveGridMode } from "../../pictograph/grid/services/grid-mode-deriver";

export class LetterDeriver {
  constructor(
    private motionQueryHandler: IMotionQueryHandler | null
  ) {}

  async deriveLettersForSequence(
    sequence: SequenceData
  ): Promise<SequenceData> {
    if (!this.motionQueryHandler) {
      console.warn(
        "MotionQueryHandler not available - letters will not be derived"
      );
      return sequence;
    }

    // Derive letters for all steps in the sequence
    const stepsWithLetters = (await Promise.all(
      sequence.steps.map((step) => this.deriveLetterForBeat(step))
    )) as StepData[];

    // Derive letter for start position if it exists
    let updatedStartPosition: StartPositionData | null | undefined =
      sequence.startPosition;
    let updatedStartingPositionStep: StartPositionData | undefined =
      sequence.startingPosition;

    if (sequence.startPosition) {
      // Cast is safe - we pass StartPositionData so we get StartPositionData back
      updatedStartPosition = (await this.deriveLetterForBeat(
        sequence.startPosition
      )) as StartPositionData;
    }

    if (sequence.startingPosition) {
      // Cast is safe - we pass StartPositionData so we get StartPositionData back
      updatedStartingPositionStep = (await this.deriveLetterForBeat(
        sequence.startingPosition
      )) as StartPositionData;
    }

    // Build the word from the letters
    const word = stepsWithLetters
      .map((step) => step.letter ?? "")
      .join("")
      .toUpperCase();

    return {
      ...sequence,
      steps: stepsWithLetters,
      word,
      ...(updatedStartPosition !== undefined &&
        updatedStartPosition !== null && {
          startPosition: updatedStartPosition,
        }),
      ...(updatedStartingPositionStep !== undefined && {
        startingPosition: updatedStartingPositionStep,
      }),
    };
  }

  private async deriveLetterForBeat(
    beat: StepData | StartPositionData
  ): Promise<StepData | StartPositionData> {
    // Skip if letter is already set or if motions are missing
    if (beat.letter !== null || !beat.motions.blue || !beat.motions.red) {
      return beat;
    }

    if (!this.motionQueryHandler) {
      return beat;
    }

    try {
      // Derive the correct grid mode from the motions
      const gridMode = deriveGridMode(
        beat.motions.blue,
        beat.motions.red
      );

      const letter =
        (await this.motionQueryHandler.findLetterByMotionConfiguration(
          beat.motions.blue,
          beat.motions.red,
          gridMode
        )) as StepData["letter"];

      if (letter) {
        return { ...beat, letter };
      } else {
        // Use appropriate identifier in warning
        const identifier =
          "stepNumber" in beat ? `beat ${beat.stepNumber}` : "start position";
        console.warn(
          `Could not derive letter for ${identifier} (gridMode: ${gridMode}) - no matching pictograph found`
        );
        return beat;
      }
    } catch (error) {
      // Use appropriate identifier in warning
      const identifier =
        "stepNumber" in beat ? `beat ${beat.stepNumber}` : "start position";
      console.warn(`Failed to derive letter for ${identifier}:`, error);
      return beat;
    }
  }
}
