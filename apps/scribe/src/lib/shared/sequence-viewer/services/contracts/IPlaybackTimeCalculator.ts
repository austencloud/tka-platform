/**
 * Utility for converting between playback steps and time.
 */
export interface IPlaybackTimeCalculator {
  /**
   * Calculate playback time in milliseconds from step and BPM.
   * @param step Current step (can be fractional)
   * @param bpm Beats per minute
   */
  stepToTimeMs(step: number, bpm: number): number;

  /**
   * Calculate step from playback time in milliseconds.
   * @param timeMs Time in milliseconds
   * @param bpm Beats per minute
   */
  timeMsToStep(timeMs: number, bpm: number): number;

  /**
   * Convert BPM to speed multiplier (60 BPM = 1.0).
   */
  bpmToSpeed(bpm: number): number;

  /**
   * Convert speed multiplier to BPM.
   */
  speedToBpm(speed: number): number;
}
