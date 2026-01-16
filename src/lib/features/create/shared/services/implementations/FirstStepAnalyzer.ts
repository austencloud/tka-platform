import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  IFirstBeatAnalyzer,
  FirstBeatAnalysisResult,
  FirstBeatResult,
} from "../contracts/IFirstBeatAnalyzer";

/**
 * FirstBeatAnalyzer
 *
 * Pure logic for analyzing "First Beat" operations.
 * When user clicks a beat to become the new first beat,
 * this determines if confirmation is needed and calculates results.
 */
export class FirstBeatAnalyzer implements IFirstBeatAnalyzer {
  analyzeSelection(
    sequence: SequenceData,
    beatNumber: number
  ): FirstBeatAnalysisResult {
    // No-op if selecting beat 1
    if (beatNumber === 1) {
      return { action: "no-op", reason: "That's already Beat 1" };
    }

    // Invalid beat number
    if (beatNumber < 1) {
      return { action: "no-op", reason: "Invalid beat number" };
    }

    // For circular sequences, reorder immediately (no beats removed)
    if (sequence.isCircular) {
      return { action: "immediate", beatNumber };
    }

    // For non-circular, beats before the selected one will be removed
    const beatsToRemove = beatNumber - 1;
    return { action: "confirm-needed", beatNumber, beatsToRemove };
  }

  getResultMessage(
    sequence: SequenceData,
    beatNumber: number
  ): FirstBeatResult {
    const beatsRemoved = sequence.isCircular ? 0 : beatNumber - 1;

    if (beatsRemoved > 0) {
      return {
        success: true,
        beatsRemoved,
        message: `Beat ${beatNumber} is now first. Removed ${beatsRemoved} beat${beatsRemoved > 1 ? "s" : ""}.`,
      };
    }

    return {
      success: true,
      beatsRemoved: 0,
      message: `Beat ${beatNumber} is now beat 1`,
    };
  }
}
