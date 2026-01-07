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
}

/**
 * Role overrides for specific modules and tabs
 * If not specified here, defaults to "user" for modules, inherits parent module role for tabs
 *
 * IMPORTANT: For testers, only these modules should be visible:
 * - Dashboard, Create, Discover, Feedback
 * All other modules are admin-only until they're ready for public use.
 */
const FEATURE_ROLE_OVERRIDES: Partial<Record<FeatureId, UserRole>> = {
  // Modules - Admin-only (hidden from testers)
  "module:learn": "admin", // Not ready for testers yet
  "module:compose": "admin", // Not ready for testers yet
  "module:train": "admin", // Not ready for testers yet
  "module:library": "admin", // Not ready for testers yet
  "module:ml-training": "admin", // Admin-only feature
  "module:admin": "admin",
  "module:realm": "admin", // 3D experiences (Stage + Museum) - admin-only for now
  "module:premium": "admin", // Premium module is admin-only for now
  "module:word_card": "admin", // Word Card is admin-only for now
  "module:write": "admin", // Write module is admin-only for now
  "module:mandala": "admin", // Mandala generator is admin-only for now
  "module:skewlab": "admin", // Skew Lab is admin-only (temporary dev module)

  // Modules - Tester access
  "module:feedback": "tester", // Feedback requires sign-in (tester access)

  // Create tabs
  "tab:create:assembler": "admin", // Advanced feature - admin only
  "tab:create:spell": "admin", // Spell tab is admin-only for now

  // Learn tabs (inherit from parent module, which is now admin)
  "tab:learn:concepts": "admin",
  "tab:learn:play": "admin",
  "tab:learn:codex": "admin",

  // Feedback tabs
  "tab:feedback:manage": "admin", // Manage tab is admin-only (testers can only submit/view their own)

  // Admin tabs - all inherit admin role from parent module
};

/**
 * Get the default role for a feature
 * Used by FeatureFlagService to determine minimum role requirements
 */
export function getDefaultFeatureRole(
  featureId: FeatureId,
  parentModuleRole?: UserRole
): UserRole {
  // Check for explicit override
  if (FEATURE_ROLE_OVERRIDES[featureId]) {
    return FEATURE_ROLE_OVERRIDES[featureId]!;
  }

  // Tabs inherit parent module role if available
  if (featureId.startsWith("tab:") && parentModuleRole) {
    return parentModuleRole;
  }

  // Default to user
  return "user";
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
