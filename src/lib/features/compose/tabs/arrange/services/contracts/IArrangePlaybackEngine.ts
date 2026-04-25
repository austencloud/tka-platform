/**
 * IArrangePlaybackEngine - Contract for arrange grid playback
 *
 * Manages the requestAnimationFrame loop for smooth continuous playback
 * and step-based animation (forward/back by whole or half beats).
 * Tracks BPM, current beat position, and playing state.
 */

export interface IArrangePlaybackEngine {
  readonly isPlaying: boolean;
  readonly isStepAnimating: boolean;
  readonly currentStep: number;
  readonly bpm: number;

  /**
   * Start continuous playback at the given BPM.
   * @param totalStepsGetter - Function returning the current total beat count
   *   (must be a function since beat count changes as cells are modified)
   */
  play(totalStepsGetter: () => number, bpm?: number): void;

  /** Pause playback, keeping the current beat position. */
  pause(): void;

  /** Stop playback and reset beat to 0. */
  stop(): void;

  /** Set BPM (clamped 5-300). */
  setBpm(bpm: number): void;

  /**
   * Animate smoothly to the next beat position by the given amount.
   * Used by step buttons so props visibly rotate/move.
   * No-op if continuous playback is active.
   */
  animateStep(amount: number, totalSteps: number): void;

  /** Force-set the current beat (e.g. when resetting on mode change). */
  setCurrentBeat(beat: number): void;

  /** Clean up any running animation frame. */
  dispose(): void;
}
