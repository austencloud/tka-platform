/**
 * Deep Link Service Contract
 *
 * Handles URL-based deep linking to modules with pre-loaded sequences.
 * Integrates with the navigation system and module state management.
 *
 * Supported URL format:
 * ?open=construct:encoded_sequence
 * ?open=animate:encoded_sequence
 * ?open=browse:encoded_sequence
 *
 * Domain: Navigation - Deep Linking
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * Module mapping configuration
 */
export interface ModuleMapping {
  moduleId: string;
  tabId?: string;
  navigateToModule?: string;
}

/**
 * Result of processing a deep link
 */
export interface DeepLinkResult {
  moduleId: string;
  tabId: string | undefined;
  sequence: SequenceData;
}

/**
 * Data stored for deep link consumption by modules
 */
export interface DeepLinkData {
  sequence: SequenceData;
  tabId: string | undefined;
  returnPath?: string;
}

/**
 * Service for handling deep links
 */
export interface IDeepLinker {
  /**
   * Initialize deep link handling on app load
   * Parses deep link from URL, stores data, and navigates to target module.
   * Call this once in MainInterface.svelte's onMount.
   */
  initialize(): void;

  /**
   * Process a deep link from the current URL
   * @returns DeepLinkResult if valid deep link found, null otherwise
   */
  processDeepLink(): DeepLinkResult | null;

  /**
   * Check if current URL contains a deep link
   */
  hasDeepLink(): boolean;

  /**
   * Clear the deep link from URL without navigation
   * Useful after processing to clean up the URL
   */
  clearDeepLinkFromURL(): void;

  /**
   * Get the module mapping for a given module name
   */
  getModuleMapping(moduleName: string): ModuleMapping | undefined;

  // ===== Deep Link Data Store Methods =====
  // These methods manage temporary storage for deep link data
  // that modules consume on mount.

  /**
   * Store deep link data to be consumed by a module
   * @param moduleId The target module ID
   * @param sequence The sequence data to store
   * @param tabId Optional tab ID to navigate to
   */
  setData(moduleId: string, sequence: SequenceData, tabId?: string): void;

  /**
   * Consume deep link data for a specific module
   * Returns null if no data or data is for a different module.
   * Data is cleared after consumption (one-time read).
   * @param moduleId The module requesting the data
   */
  consumeData(moduleId: string): DeepLinkData | null;

  /**
   * Check if there's pending deep link data for a module
   * @param moduleId The module to check for
   */
  hasDataForModule(moduleId: string): boolean;

  /**
   * Clear all stored deep link data
   */
  clearData(): void;
}
