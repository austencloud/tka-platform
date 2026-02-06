/**
 * INavigationValidator
 *
 * Contract for navigation validation operations.
 * Provides methods to validate module IDs, tab IDs, and lookup module definitions.
 */

import type { ModuleDefinition, ModuleId, Section } from "../../domain/types";

export interface INavigationValidator {
  /**
   * Check if a module ID is valid
   */
  isValidModule(moduleId: string): moduleId is ModuleId;

  /**
   * Check if a tab ID is valid for a given module
   */
  isValidTabForModule(moduleId: ModuleId, tabId: string): boolean;

  /**
   * Check if a tab ID exists in a specific tab array
   */
  isValidTab(tabs: Section[], tabId: string): boolean;

  /**
   * Get module definition by ID
   */
  getModuleDefinition(moduleId: ModuleId): ModuleDefinition | undefined;

  /**
   * Get all module definitions
   */
  getAllModuleDefinitions(): ModuleDefinition[];

  /**
   * Get tabs for a specific module
   */
  getTabsForModule(moduleId: ModuleId): Section[];

  /**
   * Get the default tab for a module (first tab in sections)
   */
  getDefaultTabForModule(moduleId: ModuleId): string | null;

  /**
   * Find a tab by ID within a module
   */
  findTab(moduleId: ModuleId, tabId: string): Section | undefined;
}
