/**
 * Reversal Detection Service Implementation
 *
 * Detects reversals between steps in sequences based on prop rotation direction changes.
 * Ported from desktop app's ReversalDetector logic.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../domain/models/StepData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createStepData } from "../../domain/factories/createStepData";
import type {
  IReversalDetector,
  PictographWithReversals,
  ReversalInfo,
} from "../contracts/IReversalDetector";

export class ReversalDetector implements IReversalDetector {
  /**
   * Process reversals for an entire sequence
   */
  processReversals(sequence: SequenceData): SequenceData {
    const processedBeats: StepData[] = [];

    for (let i = 0; i < sequence.steps.length; i++) {
      const currentStep = sequence.steps[i]!;
      const previousSteps = sequence.steps.slice(0, i);

      // Detect reversals for this beat
      const reversalInfo = this.detectReversal(previousSteps, currentStep);

      // Apply reversal symbols to the beat
      const processedBeat = this.applyReversalSymbols(
        currentStep,
        reversalInfo
      );

      processedBeats.push(processedBeat);
    }

    return {
      ...sequence,
      steps: processedBeats,
    };
  }

  /**
   * Detect reversal for a single beat based on previous steps
   */
  detectReversal(
    previousSteps: StepData[],
    currentStep: StepData
  ): ReversalInfo {
    const reversalInfo: ReversalInfo = {
      blueReversal: false,
      redReversal: false,
    };

    if (currentStep.isBlank) {
      return reversalInfo;
    }

    // Check blue motion reversal
    const lastBluePropRotDir = this._getLastValidPropRotDir(
      previousSteps,
      "blue"
    );
    const currentBluePropRotDir = this._getPropRotDir(currentStep, "blue");

    if (this._isReversal(lastBluePropRotDir, currentBluePropRotDir)) {
      reversalInfo.blueReversal = true;
    }

    // Check red motion reversal
    const lastRedPropRotDir = this._getLastValidPropRotDir(
      previousSteps,
      "red"
    );
    const currentRedPropRotDir = this._getPropRotDir(currentStep, "red");

    if (this._isReversal(lastRedPropRotDir, currentRedPropRotDir)) {
      reversalInfo.redReversal = true;
    }

    return reversalInfo;
  }

  /**
   * Apply reversal symbols to a beat
   */
  applyReversalSymbols(
    stepData: StepData,
    reversalInfo: ReversalInfo
  ): StepData {
    return createStepData({
      ...stepData,
      blueReversal: reversalInfo.blueReversal,
      redReversal: reversalInfo.redReversal,
    });
  }

  /**
   * Detect reversal for an option preview based on current sequence
   * This is used to show reversal indicators on options before they're selected
   */
  detectReversalForOption(
    currentSequence: StepData[],
    optionPictographData: PictographData
  ): ReversalInfo {
    const reversalInfo: ReversalInfo = {
      blueReversal: false,
      redReversal: false,
    };

    if (!optionPictographData.motions) {
      return reversalInfo;
    }

    // If sequence is empty, no reversals possible
    if (currentSequence.length === 0) {
      return reversalInfo;
    }

    // Get the last valid prop rotation directions from the current sequence
    const lastBluePropRotDir = this._getLastValidPropRotDirFromSequence(
      currentSequence,
      "blue"
    );
    const lastRedPropRotDir = this._getLastValidPropRotDirFromSequence(
      currentSequence,
      "red"
    );

    // Get the prop rotation directions from the option's motion data
    const optionBluePropRotDir = this._getPropRotDirFromPictographData(
      optionPictographData,
      "blue"
    );
    const optionRedPropRotDir = this._getPropRotDirFromPictographData(
      optionPictographData,
      "red"
    );

    // Check for reversals
    if (this._isReversal(lastBluePropRotDir, optionBluePropRotDir)) {
      reversalInfo.blueReversal = true;
    }

    if (this._isReversal(lastRedPropRotDir, optionRedPropRotDir)) {
      reversalInfo.redReversal = true;
    }

    return reversalInfo;
  }

  /**
   * Get the last valid prop rotation direction for a color from previous steps
   */
  private _getLastValidPropRotDir(
    steps: StepData[],
    color: "blue" | "red"
  ): string | null {
    for (let i = steps.length - 1; i >= 0; i--) {
      const beat = steps[i]!;
      const propRotDir = this._getPropRotDir(beat, color);

      if (propRotDir && propRotDir !== "noRotation") {
        return propRotDir;
      }
    }
    return null;
  }

  /**
   * Get prop rotation direction for a specific color from a beat
   */
  private _getPropRotDir(beat: StepData, color: "blue" | "red"): string | null {
    if (!beat || beat.isBlank) {
      return null;
    }

    // Use current data structure: motions[MotionColor]
    const motionColor = color === "blue" ? MotionColor.BLUE : MotionColor.RED;
    const motionData = beat.motions[motionColor];

    if (!motionData) {
      return null;
    }

    // Use rotationDirection property (current structure) instead of propRotDir (legacy)
    const rotationDirection = motionData.rotationDirection;

    return rotationDirection || null;
  }

  /**
   * Check if there's a reversal between two prop rotation directions
   */
  private _isReversal(
    lastPropRotDir: string | null,
    currentPropRotDir: string | null
  ): boolean {
    // If either is null or noRotation, no reversal
    if (
      !lastPropRotDir ||
      !currentPropRotDir ||
      lastPropRotDir === "noRotation" ||
      currentPropRotDir === "noRotation"
    ) {
      return false;
    }

    // If directions are different, it's a reversal
    return lastPropRotDir !== currentPropRotDir;
  }

  /**
   * Get the last valid prop rotation direction from a sequence of steps
   */
  private _getLastValidPropRotDirFromSequence(
    steps: StepData[],
    color: "blue" | "red"
  ): string | null {
    // Iterate backwards through the steps to find the last valid rotation direction
    for (let i = steps.length - 1; i >= 0; i--) {
      const beat = steps[i];
      if (beat && !beat.isBlank) {
        const propRotDir = this._getPropRotDir(beat, color);
        if (propRotDir && propRotDir !== "noRotation") {
          return propRotDir;
        }
      }
    }
    return null;
  }

  /**
   * Get prop rotation direction from PictographData (for option previews)
   */
  private _getPropRotDirFromPictographData(
    pictographData: PictographData,
    color: "blue" | "red"
  ): string | null {
    // Use same MotionColor enum conversion as _getPropRotDir for consistency
    const motionColor = color === "blue" ? MotionColor.BLUE : MotionColor.RED;
    const motionData = pictographData.motions[motionColor];

    if (!motionData) {
      return null;
    }

    // Use rotationDirection property from the motion data
    const rotationDirection = motionData.rotationDirection;
    return rotationDirection || null;
  }

  /**
   * Detect reversals for multiple option pictographs at once
   * This is optimized for option picker display where we need to show reversals for all options
   */
  detectReversalsForOptions(
    currentSequence: PictographData[],
    options: PictographData[]
  ): PictographWithReversals[] {
    // If sequence is empty, no reversals possible
    if (currentSequence.length === 0) {
      return options.map((option) => ({
        ...option,
        blueReversal: false,
        redReversal: false,
      }));
    }

    // Get the last valid prop rotation directions from the current sequence
    const lastBluePropRotDir = this._getLastValidPropRotDirFromPictographs(
      currentSequence,
      "blue"
    );
    const lastRedPropRotDir = this._getLastValidPropRotDirFromPictographs(
      currentSequence,
      "red"
    );

    // Process each option and add reversal information
    return options.map((option) => {
      const reversalInfo: ReversalInfo = {
        blueReversal: false,
        redReversal: false,
      };

      if (!option.motions) {
        return { ...option, ...reversalInfo };
      }

      // Get the prop rotation directions from the option's motion data
      const optionBluePropRotDir = this._getPropRotDirFromPictographData(
        option,
        "blue"
      );
      const optionRedPropRotDir = this._getPropRotDirFromPictographData(
        option,
        "red"
      );

      // Check for reversals
      if (this._isReversal(lastBluePropRotDir, optionBluePropRotDir)) {
        reversalInfo.blueReversal = true;
      }

      if (this._isReversal(lastRedPropRotDir, optionRedPropRotDir)) {
        reversalInfo.redReversal = true;
      }

      return {
        ...option,
        ...reversalInfo,
      };
    });
  }

  /**
   * Get the last valid prop rotation direction from a sequence of pictographs
   * Similar to _getLastValidPropRotDirFromSequence but works with PictographData
   */
  private _getLastValidPropRotDirFromPictographs(
    pictographs: PictographData[],
    color: "blue" | "red"
  ): string | null {
    // Iterate backwards through the pictographs to find the last valid rotation direction
    for (let i = pictographs.length - 1; i >= 0; i--) {
      const pictograph = pictographs[i]!;
      if (pictograph.motions) {
        const propRotDir = this._getPropRotDirFromPictographData(
          pictograph,
          color
        );
        if (propRotDir && propRotDir !== "noRotation") {
          return propRotDir;
        }
      }
    }
    return null;
  }
}
