/**
 * PostHog Feature Flag Service
 *
 * PostHog-backed feature flag service that replaces the Firebase-based implementation.
 * Maintains the same interface for compatibility with existing consumers.
 *
 * Migration notes:
 * - User roles are sent as PostHog person properties via identifyUser()
 * - Module flags use naming convention: `module-{moduleId}` (e.g., `module-create`)
 * - Tab flags use naming convention: `tab-{moduleId}-{tabId}` (e.g., `tab-create-assemble`)
 * - Falls back to role-based defaults when PostHog flag doesn't exist
 *
 * PostHog flag structure:
 * - Boolean flags: true = enabled, false = disabled
 * - Multivariate flags: check specific variants if needed
 *
 * Role hierarchy (highest to lowest): admin > tester > premium > user
 */

import { browser } from "$app/environment";
import { type UserRole, hasRolePrivilege } from "../domain/models/UserRole";
import {
  type FeatureId,
  type FeatureFlagConfig,
  type UserFeatureOverrides,
  moduleIdToFeatureId,
  tabIdToFeatureId,
  getDefaultFeatureRole,
  isValidFeatureId,
  isValidUserRole,
} from "../domain/models/FeatureFlag";
import type { ModuleId } from "../../navigation/domain/types";
import { MODULE_DEFINITIONS } from "../../navigation/config/module-definitions";
import { isModuleEnabledInEnvironment } from "../../environment/environment-features";
import {
  isFeatureEnabled,
  getFeatureFlag,
  reloadFeatureFlags,
  getAllFeatureFlags,
  setUserProperties,
} from "../../analytics/services/posthog";
import { auth } from "../firebase";

// ============================================================================
// POSTHOG FLAG NAMING CONVENTIONS
// ============================================================================

/**
 * Convert FeatureId to PostHog flag key
 * - module:create -> module-create
 * - tab:create:assemble -> tab-create-assemble
 * - capability:export:video -> capability-export-video
 */
function featureIdToPostHogKey(featureId: FeatureId): string {
  return featureId.replace(/:/g, "-");
}

/**
 * Convert PostHog flag key back to FeatureId
 * Returns undefined if the key doesn't match a valid FeatureId pattern
 * - module-create -> module:create
 * - tab-create-assemble -> tab:create:assemble
 * - capability-export-video -> capability:export:video
 */
function postHogKeyToFeatureId(key: string): FeatureId | undefined {
  let candidate: string | undefined;

  // Handle module flags
  if (key.startsWith("module-")) {
    const moduleId = key.slice(7);
    if (moduleId) {
      candidate = `module:${moduleId}`;
    }
  }
  // Handle tab flags (tab-{module}-{tab})
  else if (key.startsWith("tab-")) {
    const parts = key.slice(4).split("-");
    if (parts.length >= 2 && parts[0] && parts[1]) {
      const moduleId = parts[0];
      const tabId = parts.slice(1).join("-");
      candidate = `tab:${moduleId}:${tabId}`;
    }
  }
  // Handle capability flags
  else if (key.startsWith("capability-")) {
    const parts = key.slice(11).split("-");
    if (parts.length >= 2 && parts[0] && parts[1]) {
      candidate = `capability:${parts[0]}:${parts.slice(1).join("-")}`;
    }
  }

  // Validate using the runtime validation helper
  if (candidate && isValidFeatureId(candidate)) {
    return candidate;
  }

  // Invalid key - return undefined instead of casting blindly
  return undefined;
}

// ============================================================================
// GLOBAL OVERRIDE PERSISTENCE
// ============================================================================

const GLOBAL_FLAG_OVERRIDES_KEY = "tka-global-flag-overrides";
const GLOBAL_ROLE_OVERRIDES_KEY = "tka-global-role-overrides";

/**
 * Load global flag overrides from localStorage
 * These are admin-set overrides that persist across sessions
 */
function loadGlobalFlagOverrides(): Record<string, boolean> {
  if (!browser) return {};

  try {
    const stored = localStorage.getItem(GLOBAL_FLAG_OVERRIDES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate the structure: should be Record<string, boolean>
      if (typeof parsed === "object" && parsed !== null) {
        const validated: Record<string, boolean> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof key === "string" && typeof value === "boolean") {
            validated[key] = value;
          }
        }
        return validated;
      }
    }
  } catch (error) {
    console.warn("[PostHogFeatureFlagService] Failed to load global flag overrides:", error);
  }

  return {};
}

/**
 * Save global flag overrides to localStorage
 */
function saveGlobalFlagOverrides(overrides: Record<string, boolean>): void {
  if (!browser) return;

  try {
    localStorage.setItem(GLOBAL_FLAG_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (error) {
    console.warn("[PostHogFeatureFlagService] Failed to save global flag overrides:", error);
  }
}

/**
 * Load global role overrides from localStorage
 * These are admin-set minimum role requirements that persist across sessions
 */
function loadGlobalRoleOverrides(): Record<string, UserRole> {
  if (!browser) return {};

  try {
    const stored = localStorage.getItem(GLOBAL_ROLE_OVERRIDES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate the structure: should be Record<string, UserRole>
      if (typeof parsed === "object" && parsed !== null) {
        const validated: Record<string, UserRole> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof key === "string" && isValidUserRole(value)) {
            validated[key] = value as UserRole;
          }
        }
        return validated;
      }
    }
  } catch (error) {
    console.warn("[PostHogFeatureFlagService] Failed to load global role overrides:", error);
  }

  return {};
}

/**
 * Save global role overrides to localStorage
 */
function saveGlobalRoleOverrides(overrides: Record<string, UserRole>): void {
  if (!browser) return;

  try {
    localStorage.setItem(GLOBAL_ROLE_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (error) {
    console.warn("[PostHogFeatureFlagService] Failed to save global role overrides:", error);
  }
}

// ============================================================================
// REACTIVE STATE (Svelte 5 Runes)
// ============================================================================

interface FeatureFlagState {
  /** Current user's ID */
  userId: string | null;
  /** Current user's role */
  userRole: UserRole;
  /** Debug role override (for admin testing different permission levels) */
  debugRoleOverride: UserRole | null;
  /** User-specific feature overrides (loaded from PostHog person properties or local storage) */
  userOverrides: UserFeatureOverrides;
  /** Whether the service has been initialized */
  initialized: boolean;
  /** Whether currently loading */
  loading: boolean;
  /** Version counter to trigger reactive updates when flags change */
  flagsVersion: number;
  /** Local cache of global flag enabled states updated via admin UI */
  globalFlagOverrides: Record<string, boolean>;
  /** Local cache of global flag minimumRole overrides updated via admin UI */
  globalRoleOverrides: Record<string, UserRole>;
}

const _state = $state<FeatureFlagState>({
  userId: null,
  userRole: "user",
  debugRoleOverride: null,
  userOverrides: {
    enabledFeatures: [],
    disabledFeatures: [],
    moduleOrder: undefined,
  },
  initialized: false,
  loading: false,
  flagsVersion: 0,
  // Initialize from localStorage if in browser, empty otherwise
  globalFlagOverrides: browser ? loadGlobalFlagOverrides() : {},
  globalRoleOverrides: browser ? loadGlobalRoleOverrides() : {},
});

// ============================================================================
// FEATURE FLAG GENERATION (same as original)
// ============================================================================

/**
 * Generate feature flags dynamically from MODULE_DEFINITIONS
 * This ensures feature flags always match the actual navigation modules
 */
function generateFeatureFlagsFromModules(): FeatureFlagConfig[] {
  const flags: FeatureFlagConfig[] = [];

  // Generate module and tab flags from MODULE_DEFINITIONS
  for (const module of MODULE_DEFINITIONS) {
    const moduleFeatureId = moduleIdToFeatureId(module.id);
    const moduleRole = getDefaultFeatureRole(moduleFeatureId);

    // Add module flag
    flags.push({
      id: moduleFeatureId,
      name: `${module.label} Module`,
      description:
        module.description ||
        `Access to ${module.label.toLowerCase()} features`,
      minimumRole: moduleRole,
      enabled: true,
      category: "module",
    });

    // Add tab flags for this module
    for (const section of module.sections) {
      const tabFeatureId = tabIdToFeatureId(module.id, section.id);
      const tabRole = getDefaultFeatureRole(tabFeatureId, moduleRole);

      flags.push({
        id: tabFeatureId,
        name: `${section.label} Tab`,
        description:
          section.description || `${section.label} in ${module.label}`,
        minimumRole: tabRole,
        enabled: true,
        category: "tab",
      });
    }
  }

  return flags;
}

// Default feature flags from navigation modules
const _DEFAULT_FEATURE_FLAGS: FeatureFlagConfig[] =
  generateFeatureFlagsFromModules();

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Get the default feature config from MODULE_DEFINITIONS
 */
function getDefaultFeatureConfig(
  featureId: FeatureId
): FeatureFlagConfig | null {
  return _DEFAULT_FEATURE_FLAGS.find((f) => f.id === featureId) || null;
}

/**
 * Check PostHog for a feature flag with fallback to role-based defaults
 * Also checks globalFlagOverrides (admin UI changes) first
 */
function checkPostHogFlag(featureId: FeatureId): boolean | null {
  if (!browser) return null;

  const postHogKey = featureIdToPostHogKey(featureId);

  // Priority 1: Check local admin overrides (set via admin UI)
  const localOverride = _state.globalFlagOverrides[postHogKey];
  if (typeof localOverride === "boolean") {
    return localOverride;
  }

  // Priority 2: Check PostHog remote flag value
  const flagValue = getFeatureFlag(postHogKey);

  // PostHog flag exists - use its value
  if (typeof flagValue === "boolean") {
    return flagValue;
  }

  // PostHog multivariate flag - treat any truthy string as enabled
  if (typeof flagValue === "string") {
    return flagValue !== "" && flagValue !== "false" && flagValue !== "control";
  }

  // Flag doesn't exist in PostHog - return null to signal fallback
  return null;
}

/**
 * Check if a feature is accessible based on role and overrides
 * Priority: User overrides > PostHog flag > Role-based default
 */
function checkFeatureAccess(featureId: FeatureId): boolean {
  // 1. Check user-specific overrides first (highest priority)
  if (_state.userOverrides.disabledFeatures.includes(featureId)) {
    return false; // Explicitly disabled for this user
  }

  if (_state.userOverrides.enabledFeatures.includes(featureId)) {
    return true; // Explicitly enabled for this user (bypasses all other checks)
  }

  // 2. Check PostHog flag (if it exists)
  const postHogResult = checkPostHogFlag(featureId);
  if (postHogResult !== null) {
    return postHogResult;
  }

  // 3. Fall back to role-based default
  const config = getDefaultFeatureConfig(featureId);
  if (!config) {
    console.warn(`[PostHogFeatureFlagService] Unknown feature: ${featureId}`);
    return false;
  }

  // Check if globally disabled (from default config)
  if (!config.enabled) {
    return false;
  }

  // Check role-based access (use debug override if set)
  const effectiveRole = _state.debugRoleOverride ?? _state.userRole;
  return hasRolePrivilege(effectiveRole, config.minimumRole);
}

/**
 * Load user overrides from localStorage
 * PostHog doesn't have a good way to store per-user overrides, so we use localStorage
 */
function loadUserOverridesFromStorage(userId: string): UserFeatureOverrides {
  if (!browser) {
    return { enabledFeatures: [], disabledFeatures: [], moduleOrder: undefined };
  }

  try {
    const stored = localStorage.getItem(`tka_feature_overrides_${userId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        enabledFeatures: parsed.enabledFeatures || [],
        disabledFeatures: parsed.disabledFeatures || [],
        moduleOrder: parsed.moduleOrder || undefined,
      };
    }
  } catch (error) {
    console.warn("[PostHogFeatureFlagService] Failed to load user overrides:", error);
  }

  return { enabledFeatures: [], disabledFeatures: [], moduleOrder: undefined };
}

/**
 * Save user overrides to localStorage
 */
function saveUserOverridesToStorage(
  userId: string,
  overrides: UserFeatureOverrides
): void {
  if (!browser) return;

  try {
    localStorage.setItem(
      `tka_feature_overrides_${userId}`,
      JSON.stringify(overrides)
    );
  } catch (error) {
    console.warn("[PostHogFeatureFlagService] Failed to save user overrides:", error);
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export const postHogFeatureFlagService = {
  // ===== Getters =====

  /** Current user role */
  get userRole(): UserRole {
    return _state.userRole;
  },

  /** Current user ID */
  get userId(): string | null {
    return _state.userId;
  },

  /** Current user's feature overrides */
  get userOverrides(): UserFeatureOverrides {
    return _state.userOverrides;
  },

  /** Whether the service has been initialized */
  get isInitialized(): boolean {
    return _state.initialized;
  },

  /** Whether currently loading */
  get isLoading(): boolean {
    return _state.loading;
  },

  /** Version counter - increments when flags are updated via admin UI */
  get flagsVersion(): number {
    return _state.flagsVersion;
  },

  /** Get all feature configs (merged with PostHog state and local overrides) */
  get featureConfigs(): FeatureFlagConfig[] {
    // Reference flagsVersion to make this reactive when flags are updated
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    _state.flagsVersion;

    // Get current PostHog flags (user's local evaluation)
    const postHogFlags = getAllFeatureFlags();

    // Merge default configs with PostHog values and local admin overrides
    return _DEFAULT_FEATURE_FLAGS.map((config) => {
      const postHogKey = featureIdToPostHogKey(config.id);
      let mergedConfig = { ...config };

      // Priority 1: Local admin enabled overrides (set via admin UI)
      const localEnabledOverride = _state.globalFlagOverrides[postHogKey];
      if (typeof localEnabledOverride === "boolean") {
        mergedConfig.enabled = localEnabledOverride;
      } else {
        // Priority 2: PostHog flag value (user's evaluation)
        const postHogValue = postHogFlags[postHogKey];
        if (typeof postHogValue === "boolean") {
          mergedConfig.enabled = postHogValue;
        } else if (typeof postHogValue === "string") {
          mergedConfig.enabled = postHogValue !== "" && postHogValue !== "false" && postHogValue !== "control";
        }
      }

      // Apply role overrides (local admin UI changes)
      const localRoleOverride = _state.globalRoleOverrides[postHogKey];
      if (localRoleOverride) {
        mergedConfig.minimumRole = localRoleOverride;
      }

      return mergedConfig;
    });
  },

  // ===== Core Access Checks =====

  /**
   * Check if a feature is accessible to the current user
   */
  canAccess(featureId: FeatureId): boolean {
    return checkFeatureAccess(featureId);
  },

  /**
   * Check if a module is accessible to the current user
   * Combines role-based access with environment-based visibility
   */
  canAccessModule(moduleId: ModuleId): boolean {
    // First check environment visibility (production vs dev)
    if (!isModuleEnabledInEnvironment(moduleId)) {
      return false;
    }

    // Then check role-based access
    const featureId = moduleIdToFeatureId(moduleId);
    return checkFeatureAccess(featureId);
  },

  /**
   * Check if a module WOULD be accessible based on role/environment alone,
   * ignoring user's disabled features. Used by ModuleQuickToggle to show
   * all modules a user COULD enable.
   */
  canAccessModuleIgnoringDisables(moduleId: ModuleId): boolean {
    // Check environment visibility
    if (!isModuleEnabledInEnvironment(moduleId)) {
      return false;
    }

    const featureId = moduleIdToFeatureId(moduleId);

    // Check PostHog flag first
    const postHogResult = checkPostHogFlag(featureId);
    if (postHogResult !== null) {
      return postHogResult;
    }

    // Fall back to role-based check
    const config = getDefaultFeatureConfig(featureId);
    if (!config || !config.enabled) {
      return false;
    }

    const effectiveRole = _state.debugRoleOverride ?? _state.userRole;
    return hasRolePrivilege(effectiveRole, config.minimumRole);
  },

  /**
   * Check if a tab within a module is accessible to the current user
   * Falls back to module-level access if tab isn't explicitly defined
   */
  canAccessTab(moduleId: ModuleId, tabId: string): boolean {
    // First check if the module itself is accessible
    if (!this.canAccessModule(moduleId)) {
      return false;
    }

    const featureId = tabIdToFeatureId(moduleId, tabId);

    // Check if this specific tab has a feature flag definition
    const config = getDefaultFeatureConfig(featureId);
    if (!config) {
      // No explicit tab config - inherit from module access (which we already checked above)
      return true;
    }

    return checkFeatureAccess(featureId);
  },

  // ===== Role Checks =====

  /** Check if user is admin */
  get isAdmin(): boolean {
    return _state.userRole === "admin";
  },

  /** Check if user is at least tester level */
  get isTester(): boolean {
    const effectiveRole = _state.debugRoleOverride ?? _state.userRole;
    return hasRolePrivilege(effectiveRole, "tester");
  },

  /** Check if user is at least premium level */
  get isPremium(): boolean {
    const effectiveRole = _state.debugRoleOverride ?? _state.userRole;
    return hasRolePrivilege(effectiveRole, "premium");
  },

  // ===== Debug Role Override (Admin Only) =====

  /** Get current debug role override */
  get debugRoleOverride(): UserRole | null {
    return _state.debugRoleOverride;
  },

  /** Get effective role (override or actual) */
  get effectiveRole(): UserRole {
    return _state.debugRoleOverride ?? _state.userRole;
  },

  /** Set debug role override (admin only) */
  setDebugRoleOverride(role: UserRole | null): void {
    if (_state.userRole !== "admin") {
      console.warn("[PostHogFeatureFlagService] Only admins can set debug role override");
      return;
    }
    _state.debugRoleOverride = role;
  },

  /** Clear debug role override */
  clearDebugRoleOverride(): void {
    _state.debugRoleOverride = null;
  },

  // ===== Initialization =====

  /**
   * Initialize the feature flag service for a user
   * Call this after authentication is confirmed
   *
   * @param userId - The user ID to initialize for (null for anonymous)
   * @param initialRole - The user's role from auth token claims (if available)
   */
  async initialize(
    userId: string | null,
    initialRole?: UserRole
  ): Promise<void> {
    _state.loading = true;

    try {
      // Store user ID
      _state.userId = userId;

      if (userId) {
        // Set the role immediately if provided
        if (initialRole) {
          _state.userRole = initialRole;
        }

        // Load user overrides from localStorage
        _state.userOverrides = loadUserOverridesFromStorage(userId);

        // Update PostHog person properties with role info
        // This enables PostHog flag targeting based on role
        if (browser) {
          setUserProperties({
            role: _state.userRole,
            is_admin: _state.userRole === "admin",
            is_tester: hasRolePrivilege(_state.userRole, "tester"),
            is_premium: hasRolePrivilege(_state.userRole, "premium"),
          });

          // Reload feature flags to get fresh values based on updated properties
          reloadFeatureFlags();
        }
      } else {
        // No user - reset to defaults
        _state.userRole = "user";
        _state.userOverrides = {
          enabledFeatures: [],
          disabledFeatures: [],
          moduleOrder: undefined,
        };
      }

      _state.initialized = true;
    } catch (error) {
      console.error("[PostHogFeatureFlagService] Initialization failed:", error);
      // Fall back to defaults (or initialRole if provided)
      _state.userRole = initialRole || "user";
      _state.initialized = true;
    } finally {
      _state.loading = false;
    }
  },

  // ===== User Override Management =====

  /**
   * Update user's feature overrides
   * Note: In PostHog implementation, this only updates localStorage.
   * For admin-level control, use PostHog dashboard directly.
   */
  async setUserFeatureOverrides(
    targetUserId: string,
    overrides: UserFeatureOverrides
  ): Promise<void> {
    // For the current user, update local state and storage
    if (targetUserId === _state.userId) {
      _state.userOverrides = overrides;
      saveUserOverridesToStorage(targetUserId, overrides);
    } else {
      // For other users, just save to their localStorage key
      // (This is a fallback - in production, use PostHog dashboard for admin overrides)
      saveUserOverridesToStorage(targetUserId, overrides);
    }
  },

  /**
   * Update a user's role
   * Note: In PostHog implementation, roles are managed via custom claims (Firebase Auth)
   * This method is kept for interface compatibility but logs a warning.
   */
  async setUserRole(targetUserId: string, newRole: UserRole): Promise<void> {
    console.warn(
      "[PostHogFeatureFlagService] setUserRole is deprecated. " +
      "User roles should be managed via Firebase Auth custom claims. " +
      `Attempted to set ${targetUserId} to ${newRole}.`
    );

    // If setting current user's role (for testing), allow it locally
    if (targetUserId === _state.userId) {
      _state.userRole = newRole;
      if (browser) {
        setUserProperties({
          role: newRole,
          is_admin: newRole === "admin",
          is_tester: hasRolePrivilege(newRole, "tester"),
          is_premium: hasRolePrivilege(newRole, "premium"),
        });
        reloadFeatureFlags();
      }
    }
  },

  /**
   * Result of a feature flag update operation
   */
  // (Type defined inline to avoid circular imports)

  /**
   * Update global feature flag configuration via PostHog API.
   * Calls server-side endpoint which proxies to PostHog.
   *
   * Note: minimumRole changes are stored in localStorage (PostHog doesn't support
   * role-based filters via simple API). They persist across browser sessions
   * and provide immediate UI feedback.
   *
   * Returns result with action type, flag info, and optional PostHog dashboard URL.
   */
  async updateGlobalFeatureFlag(
    featureId: FeatureId,
    updates: Partial<FeatureFlagConfig>
  ): Promise<{
    action: "created" | "updated" | "role_updated";
    flagKey: string;
    flagId?: number;
    note?: string;
    dashboardUrl?: string;
  }> {
    if (!browser) {
      return { action: "updated", flagKey: featureIdToPostHogKey(featureId) };
    }

    const flagKey = featureIdToPostHogKey(featureId);

    // Handle minimumRole updates locally (PostHog doesn't support this)
    if (updates.minimumRole) {
      _state.globalRoleOverrides = {
        ..._state.globalRoleOverrides,
        [flagKey]: updates.minimumRole,
      };
      // Persist to localStorage
      saveGlobalRoleOverrides(_state.globalRoleOverrides);
      // Trigger reactive update
      _state.flagsVersion++;
      console.log(`[PostHogFeatureFlagService] Flag ${flagKey} minimumRole set to: ${updates.minimumRole} (persisted)`);

      // If only role update (no enabled change), return early
      if (typeof updates.enabled !== "boolean") {
        return { action: "role_updated", flagKey };
      }
    }

    // Handle enabled updates via PostHog API
    if (typeof updates.enabled === "boolean") {
      // Store previous value for rollback on failure
      const previousValue = _state.globalFlagOverrides[flagKey];

      // OPTIMISTIC UPDATE: Apply immediately for responsive UI
      _state.globalFlagOverrides = {
        ..._state.globalFlagOverrides,
        [flagKey]: updates.enabled,
      };
      saveGlobalFlagOverrides(_state.globalFlagOverrides);
      _state.flagsVersion++;

      try {
        // Get the current user's auth token for server-side verification
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error("Not authenticated");
        }
        const idToken = await currentUser.getIdToken();

        const response = await fetch("/api/admin/feature-flags", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            flagKey,
            enabled: updates.enabled,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log(`[PostHogFeatureFlagService] Flag ${flagKey} ${result.action}:`, result.flag);

        // Also reload PostHog's local flags (for user-facing access checks)
        reloadFeatureFlags();

        // Build dashboard URL if we have the flag ID
        let dashboardUrl: string | undefined;
        if (result.flag?.id) {
          // PostHog project ID from env (passed through the response)
          dashboardUrl = `https://us.posthog.com/project/${result.projectId || "unknown"}/feature_flags/${result.flag.id}`;
        }

        return {
          action: result.action as "created" | "updated",
          flagKey,
          flagId: result.flag?.id,
          note: result.note,
          dashboardUrl,
        };
      } catch (err) {
        // ROLLBACK: Revert optimistic update on failure
        console.error(`[PostHogFeatureFlagService] Failed to update ${flagKey}, rolling back:`, err);

        if (previousValue !== undefined) {
          _state.globalFlagOverrides = {
            ..._state.globalFlagOverrides,
            [flagKey]: previousValue,
          };
        } else {
          // Remove the key if it didn't exist before
          const { [flagKey]: _, ...rest } = _state.globalFlagOverrides;
          _state.globalFlagOverrides = rest;
        }
        saveGlobalFlagOverrides(_state.globalFlagOverrides);
        _state.flagsVersion++;

        throw err;
      }
    }

    return { action: "updated", flagKey };
  },

  /**
   * Log an audit entry
   * Note: PostHog automatically tracks all feature flag evaluations.
   * This method is kept for interface compatibility but is a no-op.
   */
  async logAuditEntry(
    entry: Record<string, unknown>
  ): Promise<void> {
    // PostHog tracks flag evaluations automatically
    // No manual audit logging needed
    if (import.meta.env.DEV) {
      console.debug("[PostHogFeatureFlagService] Audit entry (no-op):", entry);
    }
  },

  // ===== Firestore Methods (Compatibility Stubs) =====

  /**
   * Fetch user data from Firestore
   * @deprecated Use initialize() instead - PostHog gets role from person properties
   */
  async fetchUserData(_userId: string): Promise<void> {
    console.warn(
      "[PostHogFeatureFlagService] fetchUserData is deprecated. " +
      "Use initialize() instead."
    );
  },

  /**
   * Subscribe to user overrides
   * @deprecated PostHog doesn't need real-time subscriptions - flags are evaluated on-demand
   */
  subscribeToUserOverrides(_userId: string): void {
    console.warn(
      "[PostHogFeatureFlagService] subscribeToUserOverrides is deprecated. " +
      "PostHog flags are evaluated on-demand."
    );
  },

  /**
   * Subscribe to global flags
   * @deprecated PostHog loads flags automatically
   */
  subscribeToGlobalFlags(): void {
    console.warn(
      "[PostHogFeatureFlagService] subscribeToGlobalFlags is deprecated. " +
      "PostHog loads flags automatically."
    );
  },

  // ===== Cleanup =====

  /**
   * Clean up subscriptions
   * Note: PostHog doesn't use subscriptions, so this is a no-op
   */
  cleanup(): void {
    // No subscriptions to clean up with PostHog
  },

  // ===== PostHog-Specific Methods =====

  /**
   * Get all PostHog feature flags (for debugging)
   */
  getAllPostHogFlags(): Record<string, boolean | string> {
    return getAllFeatureFlags();
  },

  /**
   * Force reload PostHog feature flags
   */
  reloadFlags(): void {
    if (browser) {
      reloadFeatureFlags();
    }
  },
};

// ============================================================================
// EXPORT AS DEFAULT (same name as original for drop-in replacement)
// ============================================================================

/**
 * Feature flag service singleton
 * This is the PostHog-backed implementation that replaces the Firebase version.
 */
export const featureFlagService = postHogFeatureFlagService;

/**
 * Direct access to reactive state for Svelte 5 $derived tracking.
 * Use this when you need $derived to react to flag changes:
 *
 * ```ts
 * const modules = $derived.by(() => {
 *   const _ = featureFlagState.flagsVersion; // Track changes
 *   return MODULE_DEFINITIONS.filter(m => featureFlagService.canAccessModule(m.id));
 * });
 * ```
 */
export const featureFlagState = _state;
