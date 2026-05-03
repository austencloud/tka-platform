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
import type { PictographWithReversals, ReversalInfo } from "../contracts/types";

export class ReversalDetector {
  /**
   * Process reversals for an entire sequence.
   *
   * For loop sequences (rotated, mirrored, etc.) the last beats wrap into the
   * first beats, so beat 1's "previous" context includes the tail of the
   * sequence. We build a virtual prefix from the end of the sequence so that
   * early beats can detect reversals across the loop boundary.
   */
  processReversals(sequence: SequenceData): SequenceData {
    const isLoop = !!sequence.loopType;
    const steps = sequence.steps;
    const processedBeats: StepData[] = [];

    for (let i = 0; i < steps.length; i++) {
      const currentStep = steps[i]!;

      // For loop sequences, early beats that have no prior context (or only
      // noRotation predecessors) can look back through the tail of the sequence.
      // We concatenate the full sequence before the current slice so that
      // _getLastValidPropRotDir can walk backwards across the loop boundary.
      let previousSteps: StepData[];
      if (isLoop && i < steps.length) {
        // Wrap: [...allBeats, ...beatsBeforeCurrent]
        previousSteps = [...steps, ...steps.slice(0, i)];
      } else {
        previousSteps = steps.slice(0, i);
      }

      const reversalInfo = this.detectReversal(previousSteps, currentStep);
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

    // PRIMARY: Use rotationDirection if present
    if (motionData.rotationDirection) {
      return motionData.rotationDirection;
    }

    // Static and dash motions legitimately have no rotation - the prop doesn't
    // spin during these motions, so rotationDirection is intentionally absent.
    // Treat the missing value as "noRotation" rather than warning.
    if (motionData.motionType === "static" || motionData.motionType === "dash") {
      return "noRotation";
    }

    // Pro/anti/float motions should always have a rotationDirection. If one
    // really is missing here it's bad data - warn and fall through to cw so
    // downstream reversal detection doesn't crash.
    console.warn(
      `Missing rotationDirection for ${color} at step ${beat.stepNumber}. ` +
        `Motion type: ${motionData.motionType}. Defaulting to 'cw'.`
    );

    return "cw";
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

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const reversalDetector = new ReversalDetector();
