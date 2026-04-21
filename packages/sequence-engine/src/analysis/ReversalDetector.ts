/**
 * Reversal Detector
 *
 * Detects where prop rotation direction changes between consecutive steps
 * in a sequence. A "reversal" happens when a hand switches from clockwise
 * to counter-clockwise (or vice versa) between two beats.
 *
 * Works with the engine's own SequenceStep type. Does not depend on
 * app-specific models (StepData, PictographData from the Svelte app).
 */

import type { SequenceStep } from "../core/types/sequence-engine-types.js";

/**
 * Reversal information for a single step.
 */
export interface ReversalInfo {
  blueReversal: boolean;
  redReversal: boolean;
}

/**
 * A step annotated with reversal flags.
 */
export interface AnnotatedStep extends SequenceStep {
  blueReversal: boolean;
  redReversal: boolean;
}

/**
 * Detects rotation direction reversals between consecutive sequence steps.
 *
 * A reversal occurs when a hand's prop rotation direction flips from cw to ccw
 * or vice versa. Steps where either hand has no rotation (static, noRotation)
 * are not counted as reversals — the detector looks back to the last step
 * that had active rotation for that hand.
 */
export class ReversalDetector {
  /**
   * Detect reversals for an entire sequence and return annotated steps.
   */
  annotateSequence(steps: SequenceStep[]): AnnotatedStep[] {
    const result: AnnotatedStep[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      const previousSteps = steps.slice(0, i);
      const reversalInfo = this.detectReversal(previousSteps, step);

      result.push({
        ...step,
        blueReversal: reversalInfo.blueReversal,
        redReversal: reversalInfo.redReversal,
      });
    }

    return result;
  }

  /**
   * Detect reversals for a single step by looking at previous steps.
   */
  detectReversal(
    previousSteps: SequenceStep[],
    currentStep: SequenceStep,
  ): ReversalInfo {
    const info: ReversalInfo = {
      blueReversal: false,
      redReversal: false,
    };

    if (previousSteps.length === 0) return info;

    const lastBlueDir = this.getLastActiveRotation(previousSteps, "blue");
    const currentBlueDir = this.getRotationDirection(currentStep, "blue");
    if (this.isReversal(lastBlueDir, currentBlueDir)) {
      info.blueReversal = true;
    }

    const lastRedDir = this.getLastActiveRotation(previousSteps, "red");
    const currentRedDir = this.getRotationDirection(currentStep, "red");
    if (this.isReversal(lastRedDir, currentRedDir)) {
      info.redReversal = true;
    }

    return info;
  }

  /**
   * Count total reversals in a sequence (both hands combined).
   */
  countReversals(steps: SequenceStep[]): number {
    let count = 0;

    for (let i = 1; i < steps.length; i++) {
      const prev = steps.slice(0, i);
      const curr = steps[i]!;
      const info = this.detectReversal(prev, curr);
      if (info.blueReversal) count++;
      if (info.redReversal) count++;
    }

    return count;
  }

  /**
   * Count reversals per hand separately.
   */
  countReversalsPerHand(steps: SequenceStep[]): { blue: number; red: number } {
    let blue = 0;
    let red = 0;

    for (let i = 1; i < steps.length; i++) {
      const prev = steps.slice(0, i);
      const curr = steps[i]!;
      const info = this.detectReversal(prev, curr);
      if (info.blueReversal) blue++;
      if (info.redReversal) red++;
    }

    return { blue, red };
  }

  /**
   * Walk backwards through steps to find the last active (non-static)
   * rotation direction for a given hand.
   */
  private getLastActiveRotation(
    steps: SequenceStep[],
    hand: "blue" | "red",
  ): string | null {
    for (let i = steps.length - 1; i >= 0; i--) {
      const dir = this.getRotationDirection(steps[i]!, hand);
      if (dir && dir !== "noRotation" && dir !== "no_rot") {
        return dir;
      }
    }
    return null;
  }

  /**
   * Get the rotation direction for one hand from a step.
   */
  private getRotationDirection(
    step: SequenceStep,
    hand: "blue" | "red",
  ): string | null {
    const motion = hand === "blue" ? step.motions.blue : step.motions.red;
    if (!motion) return null;

    if (motion.rotationDirection) {
      return motion.rotationDirection;
    }

    // Static motions have no rotation
    if (motion.motionType === "static") {
      return "noRotation";
    }

    return null;
  }

  /**
   * Check whether two rotation directions constitute a reversal.
   */
  private isReversal(prev: string | null, curr: string | null): boolean {
    if (!prev || !curr) return false;
    if (prev === "noRotation" || prev === "no_rot") return false;
    if (curr === "noRotation" || curr === "no_rot") return false;

    return (
      (prev === "cw" && curr === "ccw") ||
      (prev === "ccw" && curr === "cw")
    );
  }
}
