import type { EffortPhrase } from "../../domain/effort-timeline-types";

export interface PhraseInterpolationResult {
  /** 0-based step index in the sequence */
  stepIndex: number;
  /** Progress within that step (0.0 to 1.0) */
  localProgress: number;
}

export interface IPhraseInterpolator {
  interpolate(
    phrase: EffortPhrase,
    currentStep: number,
    totalSteps: number,
  ): PhraseInterpolationResult;
}
