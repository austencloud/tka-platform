/**
 * Feature Flag Service
 *
 * Centralized service for managing feature access control.
 * Checks user roles and feature flags to determine access.
 *
 * Usage:
 * - featureFlagService.canAccess('module:animate') // Check feature access
 * - featureFlagService.canAccessModule('animate')  // Check module access
 * - featureFlagService.canAccessTab('create', 'assembler') // Check tab access
 */

import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  onSnapshot,
  type Firestore,
} from "firebase/firestore";
import { getFirestoreInstance } from "../firebase";
import { type UserRole, hasRolePrivilege } from "../domain/models/UserRole";
import {
  type FeatureId,
  type FeatureFlagConfig,
  type UserFeatureOverrides,
  moduleIdToFeatureId,
  tabIdToFeatureId,
  getDefaultFeatureRole,
} from "../domain/models/FeatureFlag";
import type { ModuleId } from "../../navigation/domain/types";
import { MODULE_DEFINITIONS } from "../../navigation/config/module-definitions";
import { isModuleEnabledInEnvironment } from "../../environment/environment-features";

/**
 * Global feature flags stored in Firestore
 */
interface GlobalFeatureFlags {
  /** Override configs (partial updates to defaults) */
  overrides: Partial<Record<FeatureId, Partial<FeatureFlagConfig>>>;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Updated by user ID */
  updatedBy: string;
}

/**
 * Audit log entry for feature flag changes
 */
interface FeatureFlagAuditEntry {
  /** Type of action */
  action: "global_flag_update" | "user_override_update" | "user_role_update";
  /** Admin who made the change */
  adminId: string;
  /** Target user (for user-specific changes) */
  targetUserId?: string;
  /** Feature ID (for flag changes) */
  featureId?: FeatureId;
  /** Previous value */
  previousValue?: unknown;
  /** New value */
  newValue?: unknown;
  /** Timestamp */
  timestamp: Date;
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
  /** User-specific feature overrides */
  userOverrides: UserFeatureOverrides;
  /** Global feature flag overrides from Firestore */
  globalOverrides: Partial<Record<FeatureId, Partial<FeatureFlagConfig>>>;
  /** Whether the service has been initialized */
  initialized: boolean;
  /** Whether currently loading */
  loading: boolean;
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
  globalOverrides: {},
  initialized: false,
  loading: false,
});

// Cleanup functions
let unsubscribeGlobalFlags: (() => void) | null = null;
let unsubscribeUserOverrides: (() => void) | null = null;

// Lazy-loaded Firestore instance (cached after first load)
let firestoreCache: Firestore | null = null;
async function getFirestore(): Promise<Firestore> {
  if (!firestoreCache) {
    firestoreCache = await getFirestoreInstance();
  }
  return firestoreCache;
}

// ============================================================================
// FEATURE FLAG GENERATION
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

// Generate default feature flags from navigation modules
// This is the source of truth for all feature flags
//
// NOTE: Capabilities (like export:video, share:social) were removed 2026-01-07
// because they were placeholder definitions with no actual gate checks in the codebase.
// When you need to gate a specific capability:
// 1. Add a capability flag here with category: "capability"
// 2. Add actual canAccess() checks in the feature code
// 3. Test that the gate actually works
const _DEFAULT_FEATURE_FLAGS: FeatureFlagConfig[] =
  generateFeatureFlagsFromModules();

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Get the effective feature config (defaults + global overrides)
 */
function getEffectiveFeatureConfig(
  featureId: FeatureId
): FeatureFlagConfig | null {
  const defaultConfig = _DEFAULT_FEATURE_FLAGS.find((f) => f.id === featureId);
  if (!defaultConfig) return null;

  const globalOverride = _state.globalOverrides[featureId];
  if (!globalOverride) return defaultConfig;

  return {
    ...defaultConfig,
    ...globalOverride,
  };
}

/**
 * Check if a feature is accessible based on role and overrides
 */
function checkFeatureAccess(featureId: FeatureId): boolean {
  // Check user-specific overrides first
  if (_state.userOverrides.disabledFeatures.includes(featureId)) {
    return false; // Explicitly disabled for this user
  }

  if (_state.userOverrides.enabledFeatures.includes(featureId)) {
    return true; // Explicitly enabled for this user (bypasses role check)
  }

  // Get effective feature config
  const config = getEffectiveFeatureConfig(featureId);
  if (!config) {
    console.warn(`Unknown feature: ${featureId}`);
    return false;
  }

  // Check if globally disabled
  if (!config.enabled) {
    return false;
  }

  // Check role-based access (use debug override if set)
  const effectiveRole = _state.debugRoleOverride ?? _state.userRole;
  return hasRolePrivilege(effectiveRole, config.minimumRole);
}

// ============================================================================
// PUBLIC API
// ============================================================================

export const featureFlagService = {
  // ===== Getters =====

  /** Current user role */
  get userRole(): UserRole {
    return _state.userRole;
  },

  /** Current user ID (needed for setUserFeatureOverrides) */
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

  /** Get all feature configs (with global overrides applied) */
  get featureConfigs(): FeatureFlagConfig[] {
    return _DEFAULT_FEATURE_FLAGS.map((defaultConfig) => {
      const override = _state.globalOverrides[defaultConfig.id];
      return override ? { ...defaultConfig, ...override } : defaultConfig;
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
    const config = getEffectiveFeatureConfig(featureId);
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
      console.warn("Only admins can set debug role override");
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
      // Clean up previous subscriptions
      this.cleanup();

      // Store user ID for audit logging
      _state.userId = userId;

      if (userId) {
        // If we have an initial role from auth token, use it immediately
        // This prevents race condition with Firestore writes
        if (initialRole) {
          _state.userRole = initialRole;
        }

        // Fetch user role and overrides from Firestore
        // This will override if Firestore has different data, but initialRole prevents flash of wrong permissions
        await this.fetchUserData(userId);

        // Subscribe to real-time updates
        this.subscribeToUserOverrides(userId);
      } else {
        // No user - reset to defaults
        _state.userRole = "user";
        _state.userOverrides = {
          enabledFeatures: [],
          disabledFeatures: [],
          moduleOrder: undefined,
        };
      }

      // Subscribe to global feature flags
      this.subscribeToGlobalFlags();

      _state.initialized = true;
    } catch (error) {
      console.error("FeatureFlagService: Initialization failed:", error);
      // Fall back to defaults (or initialRole if provided)
      _state.userRole = initialRole || "user";
      _state.initialized = true;
    } finally {
      _state.loading = false;
    }
  },

  /**
   * Fetch user data from Firestore
   */
  async fetchUserData(userId: string): Promise<void> {
    try {
      const firestore = await getFirestore();
      const userDocRef = doc(firestore, `users/${userId}`);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();

        // Get role (backwards compatible with isAdmin)
        if (data["role"]) {
          _state.userRole = data["role"] as UserRole;
        } else if (data["isAdmin"] === true) {
          // Backwards compatibility
          _state.userRole = "admin";
        } else {
          _state.userRole = "user";
        }

        // Get feature overrides
        if (data["featureOverrides"]) {
          _state.userOverrides = {
            enabledFeatures: data["featureOverrides"]["enabledFeatures"] || [],
            disabledFeatures:
              data["featureOverrides"]["disabledFeatures"] || [],
            moduleOrder: data["featureOverrides"]["moduleOrder"] || undefined,
          };
        }
      }
    } catch (error) {
      console.warn("Failed to fetch user data:", error);
    }
  },

  /**
   * Subscribe to user-specific feature overrides
   */
  subscribeToUserOverrides(userId: string): void {
    getFirestore().then((firestore) => {
      const userDocRef = doc(firestore, `users/${userId}`);
      unsubscribeUserOverrides = onSnapshot(
        userDocRef,
        (_snapshot) => {
          if (_snapshot.exists()) {
            const data = _snapshot.data();

            // Update role
            if (data["role"]) {
              _state.userRole = data["role"] as UserRole;
            } else if (data["isAdmin"] === true) {
              _state.userRole = "admin";
            }

            // Update feature overrides
            if (data["featureOverrides"]) {
              _state.userOverrides = {
                enabledFeatures:
                  data["featureOverrides"]["enabledFeatures"] || [],
                disabledFeatures:
                  data["featureOverrides"]["disabledFeatures"] || [],
                moduleOrder:
                  data["featureOverrides"]["moduleOrder"] || undefined,
              };
            }
          }
        },
        (_error) => {
          console.warn("User overrides subscription error:", _error);
        }
      );
    });
  },

  /**
   * Subscribe to global feature flags
   */
  subscribeToGlobalFlags(): void {
    getFirestore().then((firestore) => {
      const globalFlagsRef = doc(firestore, "config/featureFlags");
      unsubscribeGlobalFlags = onSnapshot(
        globalFlagsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as GlobalFeatureFlags;
            _state.globalOverrides = data.overrides || {};
          }
        },
        (_error) => {
          // Don't warn - config may not exist yet
          console.debug(
            "[FeatureFlagService] Global flags not found (this is normal for new deployments)"
          );
        }
      );
    });
  },

  // ===== Audit Logging =====

  /**
   * Log an admin action to the audit trail
   */
  async logAuditEntry(
    entry: Omit<FeatureFlagAuditEntry, "adminId" | "timestamp">
  ): Promise<void> {
    try {
      const firestore = await getFirestore();
      const auditRef = collection(firestore, "audit/featureFlags/entries");
      await addDoc(auditRef, {
        ...entry,
        adminId: _state.userId ?? "unknown",
        timestamp: new Date(),
      });
    } catch (error) {
      // Don't fail the main operation if audit logging fails
      console.warn("[FeatureFlagService] Failed to log audit entry:", error);
    }
  },

  // ===== Admin Functions =====

  /**
   * Update a user's role (admin only)
   */
  async setUserRole(targetUserId: string, newRole: UserRole): Promise<void> {
    if (!this.isAdmin) {
      throw new Error("Only admins can change user roles");
    }

    const firestore = await getFirestore();
    const userDocRef = doc(firestore, `users/${targetUserId}`);

    // Get previous role for audit
    const userDoc = await getDoc(userDocRef);
    const previousRole = userDoc.exists() ? userDoc.data()?.role : undefined;

    await setDoc(
      userDocRef,
      {
        role: newRole,
        // Keep isAdmin in sync for backwards compatibility
        isAdmin: newRole === "admin",
      },
      { merge: true }
    );

    // Log audit entry
    await this.logAuditEntry({
      action: "user_role_update",
      targetUserId,
      previousValue: previousRole,
      newValue: newRole,
    });
  },

  /**
   * Update a user's feature overrides (admin only)
   */
  async setUserFeatureOverrides(
    targetUserId: string,
    overrides: UserFeatureOverrides
  ): Promise<void> {
    if (!this.isAdmin) {
      throw new Error("Only admins can change user feature overrides");
    }

    const firestore = await getFirestore();
    const userDocRef = doc(firestore, `users/${targetUserId}`);

    // Get previous overrides for audit
    const userDoc = await getDoc(userDocRef);
    const previousOverrides = userDoc.exists()
      ? userDoc.data()?.featureOverrides
      : null; // Use null instead of undefined for Firestore compatibility

    await setDoc(
      userDocRef,
      {
        featureOverrides: overrides,
      },
      { merge: true }
    );

    // Log audit entry
    await this.logAuditEntry({
      action: "user_override_update",
      targetUserId,
      previousValue: previousOverrides ?? null, // Ensure no undefined
      newValue: overrides,
    });
  },

  /**
   * Update global feature flag configuration (admin only)
   */
  async updateGlobalFeatureFlag(
    featureId: FeatureId,
    updates: Partial<FeatureFlagConfig>
  ): Promise<void> {
    if (!this.isAdmin) {
      throw new Error("Only admins can change global feature flags");
    }

    const firestore = await getFirestore();
    const globalFlagsRef = doc(firestore, "config/featureFlags");
    const currentDoc = await getDoc(globalFlagsRef);
    const currentData = currentDoc.exists()
      ? (currentDoc.data() as GlobalFeatureFlags)
      : {
          overrides: {} as Partial<
            Record<FeatureId, Partial<FeatureFlagConfig>>
          >,
        };

    const currentOverride = currentData.overrides[featureId] ?? {};

    await setDoc(globalFlagsRef, {
      overrides: {
        ...currentData.overrides,
        [featureId]: {
          ...currentOverride,
          ...updates,
        },
      },
      updatedAt: new Date(),
      updatedBy: _state.userId ?? "unknown",
    });

    // Log audit entry
    await this.logAuditEntry({
      action: "global_flag_update",
      featureId,
      previousValue: currentOverride,
      newValue: { ...currentOverride, ...updates },
    });
  },

  // ===== Cleanup =====

  /**
   * Clean up subscriptions
   */
  cleanup(): void {
    if (unsubscribeGlobalFlags) {
      unsubscribeGlobalFlags();
      unsubscribeGlobalFlags = null;
    }
    if (unsubscribeUserOverrides) {
      unsubscribeUserOverrides();
      unsubscribeUserOverrides = null;
    }
  },
};
