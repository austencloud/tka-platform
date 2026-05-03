/**
 * NavigationValidator
 *
 * Implementation of INavigationValidator.
 * Provides validation and lookup methods for navigation elements.
 */

import type { ModuleDefinition, ModuleId, Section } from "../../domain/types";
import { MODULE_DEFINITIONS } from "../../config/module-definitions";

export class NavigationValidator {
  /**
   * Check if a module ID is valid
   */
  isValidModule(moduleId: string): moduleId is ModuleId {
    return MODULE_DEFINITIONS.some((m) => m.id === moduleId);
  }

  /**
   * Check if a tab ID is valid for a given module
   */
  isValidTabForModule(moduleId: ModuleId, tabId: string): boolean {
    const moduleDef = this.getModuleDefinition(moduleId);
    if (!moduleDef) return false;
    return moduleDef.sections.some((tab) => tab.id === tabId);
  }

  /**
   * Check if a tab ID exists in a specific tab array
   */
  isValidTab(tabs: Section[], tabId: string): boolean {
    return tabs.some((t) => t.id === tabId);
  }

  /**
   * Get module definition by ID
   */
  getModuleDefinition(moduleId: ModuleId): ModuleDefinition | undefined {
    return MODULE_DEFINITIONS.find((m) => m.id === moduleId);
  }

  /**
   * Get all module definitions
   */
  getAllModuleDefinitions(): ModuleDefinition[] {
    return MODULE_DEFINITIONS;
  }

  /**
   * Get tabs for a specific module
   */
  getTabsForModule(moduleId: ModuleId): Section[] {
    const moduleDef = this.getModuleDefinition(moduleId);
    return moduleDef?.sections ?? [];
  }

  /**
   * Get the default tab for a module (first tab in sections)
   */
  getDefaultTabForModule(moduleId: ModuleId): string | null {
    const tabs = this.getTabsForModule(moduleId);
    return tabs.length > 0 ? (tabs[0]?.id ?? null) : null;
  }

  /**
   * Find a tab by ID within a module
   */
  findTab(moduleId: ModuleId, tabId: string): Section | undefined {
    const moduleDef = this.getModuleDefinition(moduleId);
    return moduleDef?.sections.find((tab) => tab.id === tabId);
  }
}
