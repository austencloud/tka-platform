/**
 * Beat Calculation Service Interface
 *
 * Interface for beat calculation and timing services.
 * Handles beat state calculations and validation.
 */

import type { BeatData } from "../../../create/shared/domain/models/BeatData";

export interface IBeatCalculator {
  calculateBeatState(
    currentBeat: number,
    beats: readonly BeatData[],
    totalBeats: number
  ): BeatCalculationResult;
  validateBeats(beats: readonly BeatData[]): boolean;
  getBeatSafely(beats: readonly BeatData[], index: number): BeatData | null;
  calculateTotalDuration(beats: readonly BeatData[]): number;
  findBeatByNumber(
    beats: readonly BeatData[],
    beatNumber: number
  ): BeatData | null;

  /**
   * Map a time position to beat index and progress within that beat.
   * Accounts for variable beat durations.
   *
   * @param timePosition - Position in "duration units" (0 to totalDuration)
   * @param beats - Array of beat data with durations
   * @returns Beat index and progress (0-1) within that beat
   */
  mapTimePositionToBeat(
    timePosition: number,
    beats: readonly BeatData[]
  ): { beatIndex: number; beatProgress: number };

  /**
   * Calculate the time position where a specific beat starts.
   * @param beatIndex - The 0-based beat index
   * @param beats - Array of beat data
   * @returns The cumulative time position where this beat begins
   */
  getBeatStartTime(beatIndex: number, beats: readonly BeatData[]): number;

  /**
   * Calculate beat state using duration-aware timing.
   * Uses actual beat durations to determine current beat and progress.
   *
   * @param timePosition - Current position in sequence time (0 to totalDuration)
   * @param beats - Array of beat data
   * @returns Calculation result with beat index and progress
   */
  calculateBeatStateDurationAware(
    timePosition: number,
    beats: readonly BeatData[]
  ): BeatCalculationResult;
}

export interface BeatCalculationResult {
  currentBeatIndex: number;
  beatProgress: number;
  currentBeatData: BeatData;
  isValid: boolean;
}
