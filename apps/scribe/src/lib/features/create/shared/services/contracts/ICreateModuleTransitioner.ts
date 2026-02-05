/**
 * Create module Transition Service Interface
 *
 * Interface for handling tab transitions and animations in the Create module.
 */

import type { ActiveCreateModule } from "$lib/shared/foundation/ui/UITypes";

export interface ICreateModuleTransitioner {
  /**
   * Handle main tab transitions with fade animations
   */
  handleMainTabTransition(
    targetTab: ActiveCreateModule,
    currentTab: ActiveCreateModule,
    setActiveToolPanel: (tab: ActiveCreateModule) => void
  ): Promise<void>;

  /**
   * Get transition functions for Svelte transitions
   */
  getSectionTransitions(): {
    in: (node: Element) => { duration: number; css: (t: number) => string };
    out: (node: Element) => { duration: number; css: (t: number) => string };
  };

  /**
   * Transition to a specific tab
   */
  transitionToTab(tabId: string): Promise<void>;

  /**
   * Get current transition state
   */
  getTransitionState(): string;

  /**
   * Check if currently transitioning
   */
  isTransitioning(): boolean;
}
