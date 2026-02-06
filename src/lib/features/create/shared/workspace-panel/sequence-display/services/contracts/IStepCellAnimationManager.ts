/**
 * IStepCellAnimationManager
 *
 * Manages animation state for StepCell components. Tracks which steps have animated,
 * detects when step data changes (requiring re-animation), and controls transition
 * enablement for smooth pictograph loading.
 *
 * This service encapsulates the complex animation coordination logic that was
 * previously spread across multiple $effect blocks in StepCell.svelte.
 */

import type { StepData } from "../../../../domain/models/StepData";

/**
 * Snapshot of animation state for a single cell.
 * Components read this to determine visibility and animation classes.
 */
export interface StepCellAnimationState {
  /** Whether this cell has completed its entrance animation */
  hasAnimated: boolean;
  /** Current animation style name (e.g., "gentleBloom", "springPop") */
  animationName: string;
  /** Whether fade transitions should be enabled for new data loading */
  enableTransitions: boolean;
}

/**
 * Configuration for creating a new animation manager instance.
 */
export interface StepCellAnimationConfig {
  /** Initial animation name */
  initialAnimationName?: string;
}

export interface IStepCellAnimationManager {
  /**
   * Get current animation state for rendering decisions.
   */
  getState(): StepCellAnimationState;

  /**
   * Check if a step should animate in.
   * Returns true when: shouldAnimate is true AND hasAnimated is false AND step is not blank.
   */
  shouldAnimateIn(shouldAnimate: boolean, isBlank: boolean): boolean;

  /**
   * Check if a cell should be visible.
   * Cells waiting to animate are hidden; cells that have animated or don't need to animate are visible.
   */
  isVisible(
    shouldAnimate: boolean,
    index: number,
    isBlank: boolean
  ): boolean;

  /**
   * Called when a new step is loaded into this cell.
   * Resets hasAnimated if the step ID changed.
   */
  onStepChanged(stepId: string): void;

  /**
   * Called when the animation epoch changes (new sequence animation started).
   * Resets hasAnimated even if step ID is the same.
   */
  onEpochChanged(epoch: number): void;

  /**
   * Called when step data changes to determine if transitions should be enabled.
   * Enables fade transitions only when loading genuinely different content.
   */
  onDataChanged(step: StepData): void;

  /**
   * Called when the CSS animation completes.
   * Only marks as animated if we're currently supposed to be animating.
   */
  onAnimationEnd(shouldAnimateIn: boolean): void;

  /**
   * Update the current animation name (e.g., from AnimationSelector).
   */
  setAnimationName(name: string): void;

  /**
   * Reset all state (useful for component unmount/remount scenarios).
   */
  reset(): void;
}
