/**
 * Translation Helper Utilities
 *
 * Provides helper functions for translating dynamic content like
 * module names and settings tabs based on their IDs.
 *
 * Uses dynamic imports to avoid initialization timing issues.
 */

import * as m from "$lib/paraglide/messages.js";

/**
 * Get translated module label by module ID
 * Falls back to the ID if no translation exists
 */
export function translateModule(moduleId: string): string {
  // Convert hyphens and other chars to underscores for the message key
  const normalizedId = moduleId.toLowerCase().replace(/-/g, "_");
  const key = `module_${normalizedId}` as keyof typeof m;
  const messageFn = m[key];
  if (typeof messageFn === "function") {
    return (messageFn as () => string)();
  }
  return moduleId;
}

/**
 * Get translated settings tab label by tab ID
 * Falls back to the ID if no translation exists
 */
export function translateSettingsTab(tabId: string): string {
  // Convert kebab-case to snake_case for the key
  const normalizedId = tabId.toLowerCase().replace(/-/g, "_");
  const key = `settings_tab_${normalizedId}` as keyof typeof m;
  const messageFn = m[key];
  if (typeof messageFn === "function") {
    return (messageFn as () => string)();
  }
  return tabId;
}

/**
 * Get translated module description by module ID
 * Falls back to the provided default if no translation exists
 */
export function translateModuleDescription(
  moduleId: string,
  fallback?: string
): string {
  // Convert hyphens to underscores for the message key
  const normalizedId = moduleId.toLowerCase().replace(/-/g, "_");
  const key = `module_desc_${normalizedId}` as keyof typeof m;
  const messageFn = m[key];
  if (typeof messageFn === "function") {
    return (messageFn as () => string)();
  }
  return fallback || moduleId;
}
