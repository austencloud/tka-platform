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
 * Detect if running in an automated browser environment (Playwright, Puppeteer, etc.)
 *
 * Used to disable features that don't work in automated contexts, like FedCM.
 * FedCM explicitly blocks automated environments for security reasons.
 *
 * Detection methods:
 * 1. navigator.webdriver - Standard WebDriver flag (Playwright, Selenium, Puppeteer)
 * 2. window.__playwright - Playwright-specific marker
 * 3. window.__puppeteer - Puppeteer-specific marker
 */
export function isAutomatedBrowser(): boolean {
  if (!browser) return false;

  // Standard WebDriver flag - set by Playwright, Selenium, Puppeteer in automation mode
  if (navigator.webdriver === true) {
    return true;
  }

  // Playwright-specific markers
  if ("__playwright" in window || "__pw_manual" in window) {
    return true;
  }

  // Puppeteer-specific marker
  if ("__puppeteer" in window) {
    return true;
  }

  return false;
}

/**
 * Module visibility map for production (what's publicly released)
 */
export const PRODUCTION_MODULES: Record<ModuleId, boolean> = {
  create: true,
  browse: true,
  feedback: true,
  premium: true, // Premium upsell shown to non-premium users
  // Unreleased modules
  learn: false,
  tika: false, // Tika AI tutor (admin-only for now)
  compose: false,
  train: false,
  admin: false,
  settings: true, // Settings always available
  choreo_card: false, // Choreo card generator (internal tool)
  word_card: false, // Legacy alias for choreo_card
  write: false, // Write module (unreleased)
  watch: false, // Watch videos/performances (unreleased)
  moderation: false, // Content moderation (admin-only)
  arena: false, // Arena pairwise ranking (unreleased)
  lab: false, // Experimental features lab (admin-only) - consolidates realm, mandala, skewlab, poi-lab, background-builder, landing-preview, terrain-research, ml-training, community, connect
};
