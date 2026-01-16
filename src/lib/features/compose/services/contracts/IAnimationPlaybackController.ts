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
   * Start or pause playback
   */
  togglePlayback(): void;

  /**
   * Stop playback and reset to start
   */
  stop(): void;

  /**
   * Jump to a specific beat (instant, no animation)
   * @param beat Beat number to jump to
   */
  jumpToBeat(beat: number): void;

  /**
   * Animate smoothly to a specific beat
   * @param beat Beat number to animate to
   * @param duration Animation duration in milliseconds (default 300ms)
   * @param linear Use linear interpolation instead of easing (default false)
   */
  animateToBeat(beat: number, duration?: number, linear?: boolean): void;

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
  nextBeat(): void;

  /**
   * @deprecated Use stepHalfBeatBackward() or stepFullBeatBackward() instead
   */
  previousBeat(): void;

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
   * Calculate and update prop states for a specific beat without affecting playback.
   * Used when an external beat source (like composition state) drives the animation.
   * @param beat Beat number to calculate state for
   */
  calculateStateForBeat(beat: number): void;

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
