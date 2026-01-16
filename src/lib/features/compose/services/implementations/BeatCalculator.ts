/**
 * Beat Calculation Service
 *
 * Focused service for beat indexing and progress calculations.
 * Single responsibility: Beat timing and progress calculations.
 */

import type { BeatData } from "../../../create/shared/domain/models/BeatData";
import type {
  BeatCalculationResult,
  IBeatCalculator,
} from "../contracts/IBeatCalculator";

export class BeatCalculator implements IBeatCalculator {
  /**
   * Calculate current beat index and progress from animation time
   * EXACT LOGIC FROM STANDALONE ANIMATOR
   */
  calculateBeatState(
    currentBeat: number,
    beats: readonly BeatData[],
    totalBeats: number
  ): BeatCalculationResult {
    // Validate inputs
    if (beats.length === 0 || totalBeats === 0) {
      return {
        currentBeatIndex: 0,
        beatProgress: 0,
        currentBeatData: beats[0]!,
        isValid: false,
      };
    }

    // ✅ PURE DOMAIN LOGIC - Direct beat access!
    const clampedBeat = Math.max(0, Math.min(currentBeat, totalBeats));
    const currentBeatIndex = Math.floor(
      clampedBeat === totalBeats ? totalBeats - 1 : clampedBeat
    );
    const beatProgress =
      clampedBeat === totalBeats ? 1.0 : clampedBeat - currentBeatIndex;

    const currentBeatData = beats[currentBeatIndex]!;

    return {
      currentBeatIndex,
      beatProgress,
      currentBeatData,
      isValid: true,
    };
  }

  /**
   * Validate beat data array
   */
  validateBeats(beats: readonly BeatData[]): boolean {
    if (!Array.isArray(beats)) {
      console.error("BeatCalculator: beats is not an array");
      return false;
    }

    if (beats.length === 0) {
      console.error("BeatCalculator: beats array is empty");
      return false;
    }

    const isValid = beats.every((beat, index) => {
      const valid =
        beat && typeof beat.beatNumber === "number" && beat.beatNumber >= 0;
      if (!valid) {
        console.error(`BeatCalculator: Invalid beat at index ${index}:`, {
          beat,
          hasBeat: !!beat,
          beatNumber: beat?.beatNumber,
          beatNumberType: typeof beat?.beatNumber,
        });
      }
      return valid;
    });

    return isValid;
  }

  /**
   * Get beat by index with bounds checking
   */
  getBeatSafely(beats: readonly BeatData[], index: number): BeatData | null {
    if (index < 0 || index >= beats.length) {
      return null;
    }
    return beats[index] ?? null;
  }

  /**
   * Calculate total duration of sequence
   */
  calculateTotalDuration(beats: readonly BeatData[]): number {
    if (beats.length === 0) {
      return 0;
    }
    // Default to 1 if duration is undefined (defensive)
    return beats.reduce((sum, beat) => sum + (beat.duration ?? 1), 0);
  }

  /**
   * Find beat by beat number
   */
  findBeatByNumber(
    beats: readonly BeatData[],
    beatNumber: number
  ): BeatData | null {
    return beats.find((beat) => beat.beatNumber === beatNumber) ?? null;
  }

  /**
   * Map a time position to beat index and progress within that beat.
   * Accounts for variable beat durations.
   *
   * Example: beats with durations [1.0, 0.5, 0.25, 0.25] (total = 2.0)
   * - timePosition 0.5 → beat 0, progress 0.5
   * - timePosition 1.0 → beat 1, progress 0.0
   * - timePosition 1.25 → beat 1, progress 0.5 (halfway through 0.5 duration)
   * - timePosition 1.5 → beat 2, progress 0.0
   * - timePosition 1.625 → beat 2, progress 0.5 (halfway through 0.25 duration)
   */
  mapTimePositionToBeat(
    timePosition: number,
    beats: readonly BeatData[]
  ): { beatIndex: number; beatProgress: number } {
    if (beats.length === 0) {
      return { beatIndex: 0, beatProgress: 0 };
    }

    // Clamp to valid range - note: don't recalculate total (use cached if possible)
    let totalDuration = 0;
    for (const beat of beats) {
      totalDuration += beat.duration ?? 1;
    }
    const clampedTime = Math.max(0, Math.min(timePosition, totalDuration));

    // Find which beat we're in by accumulating durations
    let accumulatedTime = 0;
    for (let i = 0; i < beats.length; i++) {
      const beatDuration = beats[i].duration ?? 1;
      const beatEndTime = accumulatedTime + beatDuration;

      if (clampedTime < beatEndTime || i === beats.length - 1) {
        // We're in this beat
        const timeInBeat = clampedTime - accumulatedTime;
        const beatProgress = beatDuration > 0 ? timeInBeat / beatDuration : 0;
        return {
          beatIndex: i,
          beatProgress: Math.min(beatProgress, 1.0),
        };
      }

      accumulatedTime = beatEndTime;
    }

    // Fallback (shouldn't reach here)
    return { beatIndex: beats.length - 1, beatProgress: 1.0 };
  }

  /**
   * Calculate the time position where a specific beat starts.
   * @param beatIndex - The 0-based beat index
   * @param beats - Array of beat data
   * @returns The cumulative time position where this beat begins
   */
  getBeatStartTime(beatIndex: number, beats: readonly BeatData[]): number {
    if (beatIndex <= 0 || beats.length === 0) {
      return 0;
    }

    let accumulatedTime = 0;
    const clampedIndex = Math.min(beatIndex, beats.length);

    for (let i = 0; i < clampedIndex; i++) {
      accumulatedTime += beats[i].duration ?? 1;
    }

    return accumulatedTime;
  }

  /**
   * Calculate beat state using duration-aware timing.
   * Uses actual beat durations to determine current beat and progress.
   */
  calculateBeatStateDurationAware(
    timePosition: number,
    beats: readonly BeatData[]
  ): BeatCalculationResult {
    if (beats.length === 0) {
      return {
        currentBeatIndex: 0,
        beatProgress: 0,
        currentBeatData: beats[0]!,
        isValid: false,
      };
    }

    const { beatIndex, beatProgress } = this.mapTimePositionToBeat(
      timePosition,
      beats
    );
    const currentBeatData = beats[beatIndex]!;

    return {
      currentBeatIndex: beatIndex,
      beatProgress,
      currentBeatData,
      isValid: true,
    };
  }
}
