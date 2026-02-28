/**
 * ISidebarTabToggler
 *
 * Contract for toggling tab visibility from the sidebar context menu.
 * Uses the existing per-user disabledFeatures mechanism in featureFlagService.
 */

import type { ModuleId, Section } from "../../domain/types";

export interface TabVisibilityInfo {
  section: Section;
  isVisible: boolean;
  /** Tab requires a role the current user doesn't have (non-toggleable) */
  isRoleLocked: boolean;
}

export interface ISidebarTabToggler {
  /** Get all tabs for a module with their current visibility and lock status */
  getAllTabsForModule(moduleId: ModuleId): TabVisibilityInfo[];

  /** Hide a tab by adding it to the user's disabledFeatures */
  hideTab(moduleId: ModuleId, tabId: string): Promise<void>;

  /** Show a tab by removing it from the user's disabledFeatures */
  showTab(moduleId: ModuleId, tabId: string): Promise<void>;
}
