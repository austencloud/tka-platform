/**
 * Component Management Service Contract
 *
 * Handles loading state tracking and coordination for all sub-components
 * within complex UI components like Pictograph.
 */

import type { PictographData } from "../../../pictograph/shared/domain/models/PictographData";

export interface ComponentLoadingState {
  /** Map of component names to their loading status */
  loadingStates: Record<string, boolean>;
  /** Overall loading status */
  isLoading: boolean;
  /** List of components that are currently loading */
  loadingComponents: string[];
  /** List of components that have finished loading */
  loadedComponents: string[];
}

export interface IComponentManager {
  /**
   * Calculate required components based on pictograph data
   */
  getRequiredComponents(data: PictographData | null): string[];

  /**
   * Create initial loading state for a set of components
   */
  createLoadingState(components: string[]): ComponentLoadingState;

  /**
   * Update loading state for a specific component
   */
  updateComponentLoadingState(
    state: ComponentLoadingState,
    componentName: string,
    isLoading: boolean
  ): ComponentLoadingState;

  /**
   * Check if all components have finished loading
   */
  areAllComponentsLoaded(state: ComponentLoadingState): boolean;

  /**
   * Get the overall loading progress as a percentage
   */
  getLoadingProgress(state: ComponentLoadingState): number;

  /**
   * Clear all loading states
   */
  clearLoadingState(state: ComponentLoadingState): ComponentLoadingState;
}
