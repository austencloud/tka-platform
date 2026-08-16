/**
 * Snapshot of animation state for a single cell.
 * Components read this to determine visibility and animation classes.
 */
export interface StepCellAnimationState {
  /** Whether this cell has completed its entrance animation */
  hasAnimated: boolean;
  /** Whether fade transitions should be enabled for new data loading */
  enableTransitions: boolean;
}
