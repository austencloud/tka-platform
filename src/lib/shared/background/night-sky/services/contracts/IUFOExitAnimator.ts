/**
 * IUFOExitAnimator - Handles UFO exit animation logic
 *
 * Pure animation calculator for UFO departure effects.
 * Supports fade, warp, zoom, and shootUp exit types.
 */

import type { UFOExitType } from "../domain/ufo-types";

/**
 * Input state for exit animation calculation
 */
export interface ExitAnimationInput {
  stateTimer: number;
  exitDuration: number;
  exitType: UFOExitType;
  currentY: number;
  size: number;
  speedMult: number;
}

/**
 * Result of exit animation calculation
 */
export interface ExitAnimationResult {
  opacity: number;
  scale: number;
  flashIntensity: number;
  yDelta: number;
  isComplete: boolean;
}

export interface IUFOExitAnimator {
  /**
   * Calculate exit animation state based on progress
   * Pure function - no side effects
   */
  calculate(input: ExitAnimationInput): ExitAnimationResult;
}
