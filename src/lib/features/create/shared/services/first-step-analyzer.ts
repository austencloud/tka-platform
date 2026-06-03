import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

export type FirstBeatAnalysisResult =
  | { action: "no-op"; reason: string }
  | { action: "immediate"; stepNumber: number }
  | { action: "confirm-needed"; stepNumber: number; stepsToRemove: number };

export interface FirstBeatResult {
  success: boolean;
  stepsRemoved: number;
  message: string;
}

/**
 * first-step-analyzer.ts
 *
 * Pure logic for analyzing "First Beat" operations.
 * When user clicks a beat to become the new first beat,
 * this determines if confirmation is needed and calculates results.
 */

export function analyzeSelection(
  sequence: SequenceData,
  stepNumber: number
): FirstBeatAnalysisResult {
  // No-op if selecting beat 1
  if (stepNumber === 1) {
    return { action: "no-op", reason: "That's already Beat 1" };
  }

  // Invalid beat number
  if (stepNumber < 1) {
    return { action: "no-op", reason: "Invalid beat number" };
  }

  // For circular sequences, reorder immediately (no steps removed)
  if (sequence.isCircular) {
    return { action: "immediate", stepNumber };
  }

  // For non-circular, steps before the selected one will be removed
  const stepsToRemove = stepNumber - 1;
  return { action: "confirm-needed", stepNumber, stepsToRemove };
}

export function getResultMessage(
  sequence: SequenceData,
  stepNumber: number
): FirstBeatResult {
  const stepsRemoved = sequence.isCircular ? 0 : stepNumber - 1;

  if (stepsRemoved > 0) {
    return {
      success: true,
      stepsRemoved,
      message: `Beat ${stepNumber} is now first. Removed ${stepsRemoved} beat${stepsRemoved > 1 ? "s" : ""}.`,
    };
  }

  return {
    success: true,
    stepsRemoved: 0,
    message: `Beat ${stepNumber} is now beat 1`,
  };
}
