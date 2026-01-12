/**
 * Environment-based Feature Visibility
 *
 * Controls module visibility based on deployment environment.
 * In production, only released features are shown.
 * In development, all features are available.
 */

import { browser } from "$app/environment";
import type { ModuleId } from "$lib/shared/navigation/domain/types";

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  if (!browser) return false;
  return import.meta.env.PUBLIC_ENVIRONMENT === "production";
}

/**
 * Check if running in development environment
 */
export function isDevelopment(): boolean {
  if (!browser) return false;
  return (
    import.meta.env.PUBLIC_ENVIRONMENT === "development" ||
    import.meta.env.DEV === true
  );
}

/**
 * Check if a module is enabled in the current environment
 * This provides an additional layer of control beyond role-based access.
 *
 * In production: Only modules explicitly enabled are shown
 * In development: All modules are shown by default
 *
 * @param moduleId The module to check
 * @returns true if the module should be visible in this environment
 */
export function isModuleEnabledInEnvironment(moduleId: ModuleId): boolean {
  if (!browser) return true; // SSR - allow all

  // Development mode - all modules enabled unless explicitly disabled
  if (isDevelopment()) {
    return getEnvFlag(
      `PUBLIC_ENABLE_${moduleId.toUpperCase().replace(/-/g, "_")}_MODULE`,
      true
    );
  }

  // Production mode - only explicitly enabled modules
  if (isProduction()) {
    return getEnvFlag(
      `PUBLIC_ENABLE_${moduleId.toUpperCase().replace(/-/g, "_")}_MODULE`,
      false
    );
  }

  // Default to true for unknown environments
  return true;
}

/**
 * Check if debug tools are enabled
 */
export function isDebugToolsEnabled(): boolean {
  if (!browser) return false;
  return getEnvFlag("PUBLIC_ENABLE_DEBUG_TOOLS", isDevelopment());
}

/**
 * Check if role override is enabled
 */
export function isRoleOverrideEnabled(): boolean {
  if (!browser) return false;
  return getEnvFlag("PUBLIC_ENABLE_ROLE_OVERRIDE", isDevelopment());
}

/**
 * Check if analytics is enabled
 */
export function isAnalyticsEnabled(): boolean {
  if (!browser) return true;
  return getEnvFlag("PUBLIC_ENABLE_ANALYTICS", true);
}

/**
 * Get environment flag value
 */
function getEnvFlag(key: string, defaultValue: boolean): boolean {
  if (!browser) return defaultValue;

  const value = (import.meta.env as Record<string, string | undefined>)[key];

  if (value === undefined) return defaultValue;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;

  return defaultValue;
}

/**
 * Get current environment name
 */
export function getEnvironmentName(): string {
  if (!browser) return "server";
  return (import.meta.env.PUBLIC_ENVIRONMENT as string) || "development";
}

/**
 * Module visibility map for production (what's publicly released)
 */
export const PRODUCTION_MODULES: Record<ModuleId, boolean> = {
  dashboard: true,
  create: true,
  discover: true,
  feedback: true,
  premium: true, // Premium upsell shown to non-premium users
  // inbox module retired - messages/notifications accessible via Dashboard widget drawer
  // Unreleased modules
  learn: false,
  library: false,
  compose: false,
  train: false,
  "ml-training": false,
  admin: false,
  settings: true, // Settings always available
  realm: false, // 3D experiences - Stage + Museum (admin-only)
  word_card: false, // Word card generator (internal tool)
  write: false, // Write module (unreleased)
  mandala: false, // Mandala generator (internal tool)
  skewlab: false, // Skewlab internal tool
  "poi-lab": false, // Poi Lab internal tool (poi physics constraints)
  "background-builder": false, // Background builder internal tool
  "infinite-worlds": false, // Infinite worlds procedural generation (admin-only)
  museum: false, // Museum navigator - walkable 3D gallery (admin-only)
};
