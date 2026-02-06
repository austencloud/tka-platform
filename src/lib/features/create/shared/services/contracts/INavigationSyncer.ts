/**
 * Create Module Navigation Sync Service Contract
 *
 * Handles bidirectional synchronization between global navigation state and Create Module state.
 * Manages tab switching within Create Module's tool panel (Construct and Generate).
 * Includes tab accessibility validation and navigation guard logic for construction workflow.
 *
 * Note: "animate" and "share" are now separate panels (not tabs within the tool panel).
 * "record" has not been reintegrated yet.
 *
 * Domain: Create Module - Navigation within Sequence Construction Interface
 * Extracted from CreateModule.svelte monolith to follow DI architecture.
 */

export type CreateTab = "construct" | "generate";

// Legacy type alias for backward compatibility
/** @deprecated Use CreateTab instead */
export type BuildSection = CreateTab;

/**
 * Minimal interface for CreateModule state needed for navigation sync
 */
export interface CreateModuleStateForSync {
  activeSection: string;
  isPersistenceInitialized: boolean;
  isNavigatingBack: boolean;
  isUpdatingFromToggle: boolean;
  canAccessEditTab: boolean;
  setActiveToolPanel: (panel: string) => void;
}

/**
 * Minimal interface for navigation state needed for navigation sync
 */
export interface NavigationStateForSync {
  currentSection: string;
  setCurrentSection: (section: string) => void;
}

export interface INavigationSyncer {
  /**
   * Sync navigation state changes to create module state
   * @param createModuleState Create module state object
   * @param navigationState Navigation state object
   */
  syncNavigationToCreateModule(
    createModuleState: CreateModuleStateForSync,
    navigationState: NavigationStateForSync
  ): void;

  /**
   * Sync create module state changes back to navigation state
   * @param createModuleState Create module state object
   * @param navigationState Navigation state object
   */
  syncCreateModuleToNavigation(
    createModuleState: CreateModuleStateForSync,
    navigationState: NavigationStateForSync
  ): void;

  /**
   * Validate if a tab is accessible based on sequence state
   * @param mode Target tab within the Create module
   * @param canAccessEditTab Whether edit/export panels are accessible
   * @returns Whether navigation to the tab should be allowed
   */
  validateTabAccess(mode: CreateTab, canAccessEditTab: boolean): boolean;

  /**
   * Get the fallback tab when access is denied
   */
  getFallbackTab(): CreateTab;
}
