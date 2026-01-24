/**
 * Feature Flag Types and Configuration
 *
 * Defines the available feature flags and their access control.
 * Features can be gated by:
 * - Role (minimum role required)
 * - Explicit user override (per-user enable/disable)
 * - Global enable/disable
 */

import type { UserRole } from "./UserRole";
import type { ModuleId } from "../../../navigation/domain/types";

/**
 * Feature identifiers for modules
 * Dynamically generated from MODULE_DEFINITIONS at runtime
 */
export type ModuleFeatureId = `module:${ModuleId}`;

/**
 * Feature identifiers for tabs within modules
 * Dynamically generated from MODULE_DEFINITIONS sections at runtime
 */
export type TabFeatureId = `tab:${string}:${string}`;

/**
 * Feature identifiers for specific capabilities
 * Currently no capabilities are defined - add them here when needed
 * Format: "capability:{category}:{name}"
 */
export type CapabilityFeatureId = `capability:${string}:${string}`;

/**
 * All feature flag identifiers
 */
export type FeatureId = ModuleFeatureId | TabFeatureId | CapabilityFeatureId;

/**
 * Feature flag configuration
 */
export interface FeatureFlagConfig {
  /** Unique feature identifier */
  id: FeatureId;
  /** Human-readable name */
  name: string;
  /** Description for admin UI */
  description: string;
  /** Minimum role required to access this feature */
  minimumRole: UserRole;
  /** Whether the feature is globally enabled */
  enabled: boolean;
  /** Category for grouping in admin UI */
  category: "module" | "tab" | "capability";
}

/**
 * User-specific feature overrides stored in Firestore
 */
export interface UserFeatureOverrides {
  /** Features explicitly enabled for this user (bypasses role check) */
  enabledFeatures: FeatureId[];
  /** Features explicitly disabled for this user (overrides role) */
  disabledFeatures: FeatureId[];
  /** Custom module order for sidebar (module IDs in desired order) */
  moduleOrder?: string[];
}

/**
 * Core modules that are always accessible to all users.
 * These work even before auth/database loads to prevent layout shifts.
 *
 * ARCHITECTURE: Default is "admin" (secure by default).
 * - Core modules listed here = always "user" accessible
 * - Everything else = "admin" by default
 * - Use Admin UI (Feature Flags tab) to open modules to testers/users
 *
 * This keeps hardcoded config minimal - the database is the source of truth
 * for everything beyond these essentials.
 */
const CORE_USER_MODULES: ModuleId[] = ["dashboard", "create", "explore", "settings"];

/**
 * Get the default role for a feature
 * Used by FeatureFlagService to determine minimum role requirements
 *
 * Logic:
 * 1. Core modules (dashboard, create, discover, settings) → "user"
 * 2. Tabs → inherit from parent module
 * 3. Everything else → "admin" (secure by default)
 *
 * To open a module/tab to testers or users, configure it in Admin > Feature Flags.
 */
export function getDefaultFeatureRole(
  featureId: FeatureId,
  parentModuleRole?: UserRole
): UserRole {
  // Check if this is a core user module
  if (featureId.startsWith("module:")) {
    const moduleId = featureId.replace("module:", "") as ModuleId;
    if (CORE_USER_MODULES.includes(moduleId)) {
      return "user";
    }
  }

  // Tabs inherit parent module role if available
  if (featureId.startsWith("tab:") && parentModuleRole) {
    return parentModuleRole;
  }

  // Default to admin (secure by default)
  return "admin";
}

/**
 * Default feature flags - populated dynamically at runtime from MODULE_DEFINITIONS
 * This is a placeholder that will be replaced by the service.
 * @deprecated Access feature flags via featureFlagService.featureConfigs instead
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlagConfig[] = [];

/**
 * Helper to convert module ID to feature ID
 */
export function moduleIdToFeatureId(moduleId: ModuleId): ModuleFeatureId {
  return `module:${moduleId}` as ModuleFeatureId;
}

/**
 * Helper to convert tab ID to feature ID
 */
export function tabIdToFeatureId(
  moduleId: ModuleId,
  tabId: string
): TabFeatureId {
  return `tab:${moduleId}:${tabId}` as TabFeatureId;
}

/**
 * Get feature config by ID from defaults
 */
export function getDefaultFeatureConfig(
  featureId: FeatureId
): FeatureFlagConfig | undefined {
  return DEFAULT_FEATURE_FLAGS.find((f) => f.id === featureId);
}
