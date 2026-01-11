/**
 * IUFOEntranceAnimator - Handles UFO entrance animation logic
 *
 * Pure animation calculator for UFO appearance effects.
 * Supports fade, warp, zoom, and descend entrance types.
 */

import type { UFOEntranceType } from "../domain/ufo-types";

/**
 * Input state for entrance animation calculation
 */
export interface EntranceAnimationInput {
  stateTimer: number;
  enterDuration: number;
  entranceType: UFOEntranceType;
  startY: number;
  targetY: number;
}

/**
 * Result of entrance animation calculation
 */
export interface EntranceAnimationResult {
  opacity: number;
  scale: number;
  flashIntensity: number;
  y: number;
  isComplete: boolean;
}

export interface IUFOEntranceAnimator {
  /**
   * Calculate entrance animation state based on progress
   * Pure function - no side effects
   */
  calculate(input: EntranceAnimationInput): EntranceAnimationResult;
}
