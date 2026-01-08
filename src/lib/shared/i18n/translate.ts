/**
 * Translation Helper Utilities
 *
 * Provides helper functions for translating dynamic content like
 * module names and settings tabs based on their IDs.
 *
 * Uses tDynamic for computed keys (bypasses type safety by design)
 */

import { tDynamic } from "./i18n.svelte.js";

/**
 * Get translated module label by module ID
 * Falls back to the ID if no translation exists
 */
export function translateModule(moduleId: string): string {
  const normalizedId = moduleId.toLowerCase().replace(/-/g, "_");
  const key = `module_${normalizedId}`;
  const result = tDynamic(key);
  return result !== key ? result : moduleId;
}

/**
 * Get translated settings tab label by tab ID
 * Falls back to the ID if no translation exists
 */
export function translateSettingsTab(tabId: string): string {
  const normalizedId = tabId.toLowerCase().replace(/-/g, "_");
  const key = `settings_tab_${normalizedId}`;
  const result = tDynamic(key);
  return result !== key ? result : tabId;
}

/**
 * Get translated module description by module ID
 * Falls back to the provided default if no translation exists
 */
export function translateModuleDescription(
  moduleId: string,
  fallback?: string
): string {
  const normalizedId = moduleId.toLowerCase().replace(/-/g, "_");
  const key = `module_desc_${normalizedId}`;
  const result = tDynamic(key);
  return result !== key ? result : fallback || moduleId;
}
