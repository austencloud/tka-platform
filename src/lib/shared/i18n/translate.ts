/**
 * Translation Helper Utilities
 *
 * Provides helper functions for translating dynamic content like
 * module names and settings tabs based on their IDs.
 *
 * Uses tDynamic for computed keys (bypasses type safety by design)
 */

import { tDynamic } from "./i18n.svelte.js";
import { MODULE_DEFINITIONS } from "../navigation/config/module-definitions.js";

// Cache of admin-only module IDs for fast lookup
const ADMIN_ONLY_MODULES = new Set(
  MODULE_DEFINITIONS.filter((m) => m.adminOnly).map((m) => m.id)
);

/**
 * Get translated module label by module ID
 * Falls back to the ID if no translation exists
 *
 * Admin-only modules suppress missing translation warnings since they're not user-facing.
 */
export function translateModule(moduleId: string): string {
  const normalizedId = moduleId.toLowerCase().replace(/-/g, "_");
  const key = `module_${normalizedId}`;
  const silent = ADMIN_ONLY_MODULES.has(moduleId);
  const result = tDynamic(key, { silent });
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
 * Get translated tab label by module ID and tab ID
 * Uses pattern: tab_{moduleId}_{tabId}
 * Falls back to the tab label if no translation exists
 *
 * Admin-only modules suppress missing translation warnings since they're not user-facing.
 */
export function translateTab(
  moduleId: string,
  tabId: string,
  fallbackLabel?: string
): string {
  const normalizedModuleId = moduleId.toLowerCase().replace(/-/g, "_");
  const normalizedTabId = tabId.toLowerCase().replace(/-/g, "_");
  const key = `tab_${normalizedModuleId}_${normalizedTabId}`;
  const silent = ADMIN_ONLY_MODULES.has(moduleId);
  const result = tDynamic(key, { silent });
  return result !== key ? result : fallbackLabel || tabId;
}

/**
 * Get translated tab description by module ID and tab ID
 * Uses pattern: tab_desc_{moduleId}_{tabId}
 * Falls back to the provided default if no translation exists
 *
 * Admin-only modules suppress missing translation warnings since they're not user-facing.
 */
export function translateTabDescription(
  moduleId: string,
  tabId: string,
  fallback?: string
): string {
  const normalizedModuleId = moduleId.toLowerCase().replace(/-/g, "_");
  const normalizedTabId = tabId.toLowerCase().replace(/-/g, "_");
  const key = `tab_desc_${normalizedModuleId}_${normalizedTabId}`;
  const silent = ADMIN_ONLY_MODULES.has(moduleId);
  const result = tDynamic(key, { silent });
  return result !== key ? result : fallback || tabId;
}

/**
 * Get translated module description by module ID
 * Falls back to the provided default if no translation exists
 *
 * Admin-only modules suppress missing translation warnings since they're not user-facing.
 */
export function translateModuleDescription(
  moduleId: string,
  fallback?: string
): string {
  const normalizedId = moduleId.toLowerCase().replace(/-/g, "_");
  const key = `module_desc_${normalizedId}`;
  const silent = ADMIN_ONLY_MODULES.has(moduleId);
  const result = tDynamic(key, { silent });
  return result !== key ? result : fallback || moduleId;
}
