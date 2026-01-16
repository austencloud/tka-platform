/**
 * IFirstBeatAnalyzer
 *
 * Pure logic for analyzing "First Beat" operations.
 * When user selects a beat to become the new first beat,
 * this determines if confirmation is needed and calculates results.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export type FirstBeatAnalysisResult =
  | { action: "no-op"; reason: string }
  | { action: "immediate"; beatNumber: number }
  | { action: "confirm-needed"; beatNumber: number; beatsToRemove: number };

export interface FirstBeatResult {
  success: boolean;
  beatsRemoved: number;
  message: string;
}

export interface IFirstBeatAnalyzer {
  /**
   * Analyze what should happen when a beat is selected to become first.
   *
   * @returns
   * - 'no-op': Beat 1 selected, nothing to do
   * - 'immediate': Circular sequence, reorder immediately
   * - 'confirm-needed': Non-circular, beats will be removed
   */
  analyzeSelection(
    sequence: SequenceData,
    beatNumber: number
  ): FirstBeatAnalysisResult;

  /**
   * Get the result message after successfully setting a new first beat.
   */
  getResultMessage(sequence: SequenceData, beatNumber: number): FirstBeatResult;
}
