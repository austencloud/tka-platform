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
