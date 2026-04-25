/**
 * Animation Playback Controller Interface
 *
 * High-level orchestration service that manages animation playback.
 * Coordinates the animation engine, loop service, and state updates.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PropState } from "../../shared/domain/types/PropState";
import type { AnimationPanelState } from "../../state/animation-panel-state.svelte";

export interface IAnimationPlaybackController {
  /**
   * Initialize with sequence data and bind to state
   * @param sequenceData The sequence to animate
   * @param state The animation panel state to manage
   */
  initialize(sequenceData: SequenceData, state: AnimationPanelState): boolean;

  /**
   * Update sequence data without interrupting playback.
   * Re-initializes the animation engine with new data while preserving playback state.
   * @param sequenceData The updated sequence to use
   */
  updateSequenceData(sequenceData: SequenceData): void;

  /**
   * Start or pause playback
   */
  togglePlayback(): void;

  /**
   * Stop playback and reset to start
   */
  stop(): void;

  /**
   * Jump to a specific step (instant, no animation)
   * Pauses playback.
   * @param step Step number to jump to
   */
  jumpToStep(step: number): void;

  /**
   * Seek to a specific step without affecting playback state.
   * If playing, continues playing from the new position.
   * If paused, stays paused at the new position.
   * @param step Step number to seek to
   */
  seekToStep(step: number): void;

  /**
   * Animate smoothly to a specific step
   * @param step Step number to animate to
   * @param duration Animation duration in milliseconds (default 300ms)
   * @param linear Use linear interpolation instead of easing (default false)
   */
  animateToStep(step: number, duration?: number, linear?: boolean): void;

  /**
   * Step forward by half a beat (0.5) with BPM-timed animation
   */
  stepHalfBeatForward(): void;

  /**
   * Step backward by half a beat (0.5) with BPM-timed animation
   */
  stepHalfBeatBackward(): void;

  /**
   * Step forward by a full beat (1.0) with BPM-timed animation
   */
  stepFullBeatForward(): void;

  /**
   * Step backward by a full beat (1.0) with BPM-timed animation
   */
  stepFullBeatBackward(): void;

  /**
   * @deprecated Use stepHalfBeatForward() or stepFullBeatForward() instead
   */
  nextStep(): void;

  /**
   * @deprecated Use stepHalfBeatBackward() or stepFullBeatBackward() instead
   */
  previousStep(): void;

  /**
   * Update playback speed
   * @param speed New speed multiplier
   */
  setSpeed(speed: number): void;

  /**
   * Get current prop states from engine
   */
  getCurrentPropStates(): { blue: PropState; red: PropState };

  /**
   * Calculate and update prop states for a specific step without affecting playback.
   * Used when an external step source (like composition state) drives the animation.
   * @param step Step number to calculate state for
   */
  calculateStateForStep(step: number): void;

  /**
   * Register a callback that fires each time a full loop of the sequence completes.
   * Used by tempo practice training to track rounds.
   * @param callback Function to call on each loop completion
   */
  onLoopComplete(callback: () => void): void;

  /**
   * Remove the loop completion callback.
   */
  offLoopComplete(): void;

  /**
   * Clean up resources
   */
  dispose(): void;

  /**
   * Whether the loaded sequence returns to its starting position
   * (seamless loop vs non-seamless that jumps back)
   */
  readonly isSeamlesslyLoopable: boolean;
}
