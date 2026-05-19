/**
 * AuthState - Core authentication state management using Svelte 5 runes
 *
 * This module manages the global authentication state and orchestrates auth operations
 * using injected services from the DI container. It does NOT use Svelte 4 stores (writables).
 *
 * Responsibilities:
 * - Reactive auth state ($state rune)
 * - Firebase onAuthStateChanged listener
 * - Role & permission resolution
 * - Sign out orchestration
 * - Email/display name updates
 *
 * Extracted responsibilities (now services):
 * - Profile picture management → ProfilePictureManager
 * - User document CRUD → UserDocumentManager
 *
 * Preview mode integration:
 * - getEffectiveUserId/Role/Admin check userPreviewState for admin preview mode
 */

import { getUserDocumentManager } from "$lib/shared/auth/getUserDocumentManager";
import { updateFacebookProfilePictureIfNeeded, updateGoogleProfilePictureIfNeeded } from "$lib/shared/auth/services/profile-picture-manager";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getPresenceTracker } from "../../presence/getPresenceTracker";

import { auth } from "../firebase";
import { userPreviewState } from "../../debug/state/user-preview-state.svelte";

import { featureFlagService } from "../services/PostHogFeatureFlagService.svelte";
import type { UserRole } from "../domain/models/UserRole";
import { identifyUser, resetUser } from "../../analytics/services/posthog";

import { linkDeviceToUser } from "$lib/shared/auth/services/device-id-service";
import { getFCMTokenManager } from "$lib/shared/push/getFCMTokenManager";

import {
  changeEmail as doChangeEmail,
  updateDisplayName as doUpdateDisplayName,
  updateUsername as doUpdateUsername,
  updateInstagramUsername as doUpdateInstagramUsername,
  updatePronouns as doUpdatePronouns,
} from "../services/profile-field-updater";
import { initializeChildServices } from "../services/auth-boot-orchestrator";

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  isAdmin: boolean;
  role: UserRole;
}

// ============================================================================
// HMR STATE PRESERVATION
// ============================================================================
// Without this, every HMR update resets auth state to uninitialized, which
// triggers the full auth → Firestore → settings → theme cascade.
const hmrAuthData = import.meta.hot?.data as
  | {
      authState?: AuthState;
      cleanupAuthListener?: (() => void) | null;
      cleanupSubscriptionListener?: (() => void) | null;
      childServicesInitialized?: boolean;
    }
  | undefined;

// Reactive state using Svelte 5 $state rune
let _state = $state<AuthState>(
  hmrAuthData?.authState ?? {
    user: null,
    loading: true,
    initialized: false,
    isAdmin: false,
    role: "user",
  }
);

// Auth listener cleanup - preserve across HMR so we don't lose the active listener
let cleanupAuthListener: (() => void) | null = hmrAuthData?.cleanupAuthListener ?? null;
let cleanupSubscriptionListener: (() => void) | null = hmrAuthData?.cleanupSubscriptionListener ?? null;

// Track whether child services (settings, arrows, onboarding, etc.) have been initialized.
// On HMR, the auth listener fires again because the Firebase app instance rotates, but
// the child services don't need to re-initialize - they're already listening/loaded.
// Without this guard, every file save in dev triggers ~12 Firestore reads.
let childServicesInitialized = hmrAuthData?.childServicesInitialized ?? false;

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.authState = { ..._state };
    data.cleanupAuthListener = cleanupAuthListener;
    data.cleanupSubscriptionListener = cleanupSubscriptionListener;
    data.childServicesInitialized = childServicesInitialized;
  });
}

/**
 * Get the effective user ID (previewed user or actual)
 */
export function getEffectiveUserId(): string | null {
  if (userPreviewState.isActive && userPreviewState.data.profile) {
    return userPreviewState.data.profile.uid;
  }
  return _state.user?.uid ?? null;
}

/**
 * Get the effective user role (previewed user or actual)
 */
export function getEffectiveRole(): UserRole {
  if (userPreviewState.isActive && userPreviewState.data.profile?.role) {
    return userPreviewState.data.profile.role as UserRole;
  }
  return _state.role;
}

/**
 * Check if the effective user is an admin
 */
export function isEffectiveAdmin(): boolean {
  if (userPreviewState.isActive && userPreviewState.data.profile) {
    return userPreviewState.data.profile.role === "admin";
  }
  return _state.isAdmin;
}

/**
 * Get the user state (non-reactive snapshot)
 */
export function getUserState(): Readonly<AuthState> {
  return { ..._state };
}

/**
 * Reactive getter for user
 */
export function getUser(): User | null {
  return _state.user;
}

/**
 * Reactive getter for loading state
 */
export function isLoading(): boolean {
  return _state.loading;
}

/**
 * Reactive getter for initialized state
 */
export function isInitialized(): boolean {
  return _state.initialized;
}

/**
 * Reactive getter for admin status (actual user, not impersonated)
 */
export function isAdmin(): boolean {
  return _state.isAdmin;
}

/**
 * Reactive getter for role (actual user, not impersonated)
 */
export function getRole(): UserRole {
  return _state.role;
}

/**
 * Initialize subscription status listener
 * Watches Firestore for subscription changes and syncs role to auth state
 */
async function initializeSubscriptionListener(user: User) {
  // Clean up existing listener if any
  if (cleanupSubscriptionListener) {
    cleanupSubscriptionListener();
    cleanupSubscriptionListener = null;
  }

  try {
    const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
    const firestore = await getFirestoreInstance();
    const { collection, onSnapshot } = await import("firebase/firestore");

    const subscriptionsRef = collection(
      firestore,
      `customers/${user.uid}/subscriptions`
    );

    cleanupSubscriptionListener = onSnapshot(
      subscriptionsRef,
      async (snapshot) => {
        // Skip initial snapshot (only react to changes)
        if (snapshot.metadata.hasPendingWrites) return;

        try {
          // Force token refresh to get updated custom claims from server
          const idTokenResult = await user.getIdTokenResult(true);
          const newRole = (idTokenResult.claims.role as UserRole) || "user";
          const newIsAdmin = idTokenResult.claims.admin === true;

          // Only update if role actually changed
          if (newRole !== _state.role || newIsAdmin !== _state.isAdmin) {
            _state = {
              ..._state,
              role: newRole,
              isAdmin: newIsAdmin,
            };

            // Re-initialize feature flags with new role
            await featureFlagService.initialize(user.uid, newRole);
          }
        } catch (error) {
          console.error("❌ [authState] Failed to refresh token:", error);
        }
      },
      (error) => {
        console.error("❌ [authState] Subscription listener error:", error);
      }
    );
  } catch (error) {
    console.error(
      "❌ [authState] Failed to initialize subscription listener:",
      error
    );
  }
}

/**
 * Initialize the auth state listener
 * Sets up Firebase onAuthStateChanged and orchestrates auth flows
 */
export async function initializeAuthListener() {
  if (cleanupAuthListener) {
    console.warn("⚠️ [authState] Auth listener already initialized");
    return;
  }

  // CRITICAL: Ensure auth persistence is configured BEFORE setting up listener
  // This prevents race conditions after cache clearing where onAuthStateChanged
  // might not fire properly if IndexedDB persistence is still being set up
  try {
    const { ensureAuthPersistence } = await import("../firebase");
    await ensureAuthPersistence();
  } catch (error) {
    console.warn("⚠️ [authState] Could not ensure auth persistence:", error);
    // Continue anyway - auth will work, just might have stale state issues
  }

  // Create a promise that resolves when auth state is first determined
  // CRITICAL: Add timeout to prevent infinite hang after cache clearing
  const AUTH_TIMEOUT_MS = 10000; // 10 seconds max wait

  const authReady = new Promise<User | null>((resolve) => {
    let resolved = false;

    // Timeout safety - if onAuthStateChanged never fires, resolve with null
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn(
          "⚠️ [authState] Auth state timed out after 10s - treating as signed out"
        );
        resolve(null);
      }
    }, AUTH_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        unsubscribe(); // Only need the first callback
        resolve(user);
      }
    });
  });

  await authReady;

  const { isDesktop } = await import("$lib/shared/desktop/isDesktop");
  const isDesktopEnv = isDesktop();

  if (isDesktopEnv) {
    _state = {
      user: null,
      loading: false,
      initialized: true,
      isAdmin: true,
      role: "admin",
    };
  }

  cleanupAuthListener = onAuthStateChanged(
    auth,
    async (user) => {
      // Immediately reflect user in state so UI updates even if
      // downstream Firestore/network operations hang (common in Tauri desktop)
      if (user !== _state.user) {
        _state = { ..._state, user, initialized: true };
      }

      // ── Fast path: cached claims → set state → unblock UI ──
      // getIdTokenResult(false) reads the local token cache — no network.
      // The subscription listener force-refreshes when claims change.
      let isAdmin = false;
      let role: UserRole = "user";

      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult(false);
          isAdmin = idTokenResult.claims.admin === true;
          role = (idTokenResult.claims.role as UserRole) || "user";

          // Persist role for offline fallback — when the token expires and
          // can't refresh (no network), we restore the last verified role
          // so admin modules remain accessible at festivals etc.
          try {
            localStorage.setItem("tka-offline-auth-cache", JSON.stringify({
              uid: user.uid,
              role,
              isAdmin,
              timestamp: Date.now(),
            }));
          } catch { /* quota exceeded or private browsing — non-critical */ }
        } catch (_error) {
          console.warn("⚠️ [authState] Failed to read cached token:", _error);

          // Offline fallback: restore last-known role from localStorage.
          // The user identity is already verified by Firebase Auth persistence;
          // we're just carrying forward the role that was last confirmed from
          // a valid token. Scoped to the same UID to prevent cross-user leaks.
          try {
            const cached = localStorage.getItem("tka-offline-auth-cache");
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed.uid === user.uid) {
                isAdmin = parsed.isAdmin === true;
                role = parsed.role || "user";
                console.info("📴 [authState] Using offline-cached role:", role);
              }
            }
          } catch { /* corrupted cache — proceed with default role */ }
        }
      }

      const desktopAdminFallback = isDesktopEnv && !user;
      _state = {
        user,
        loading: false,
        initialized: true,
        isAdmin: desktopAdminFallback ? true : isAdmin,
        role: desktopAdminFallback ? "admin" : role,
      };

      // ── Background work: none of this blocks the UI ──
      if (user) {
        import("$lib/shared/auth/firebase")
          .then(({ getFirestoreInstance }) => getFirestoreInstance())
          .catch((error) => {
            console.error("❌ [authState] Failed to initialize Firestore:", error);
          });

        const userDocumentService = getUserDocumentManager();
        if (userDocumentService) {
          userDocumentService.createOrUpdateUserDocument(user).catch((error) => {
            console.error("❌ [authState] Failed to update user document:", error);
          });
        }

        updateFacebookProfilePictureIfNeeded(user).catch((error: unknown) => {
          console.warn("⚠️ [authState] Facebook profile picture update failed:", error);
        });
        updateGoogleProfilePictureIfNeeded(user).catch((error: unknown) => {
          console.warn("⚠️ [authState] Google profile picture update failed:", error);
        });

        featureFlagService.initialize(user.uid, role).catch((_error) => {
          console.warn("⚠️ [authState] Failed to initialize feature flags:", _error);
        });

        linkDeviceToUser(user.uid).catch((err: unknown) => {
          console.warn("⚠️ [authState] Failed to link device to user", err);
        });
      } else {
        featureFlagService.initialize(null).catch((_error) => {
          console.warn("⚠️ [authState] Failed to initialize feature flags:", _error);
        });
      }

      // If the user just became authenticated, clear any in-flight auth
      // drawer state. Otherwise a "Sign up" the user opened before signing
      // in a different way (popover, magic link, One Tap) stays flagged as
      // open - then re-appears as a ghost sheet the next time they sign out,
      // because MainApplication re-mounts AuthDrawer with `open={authDrawerState.open}`.
      if (user) {
        try {
          const { authDrawerState } =
            await import("../state/auth-drawer-state.svelte");
          authDrawerState.reset();
        } catch {
          // Drawer state may not be loaded in some code paths - safe to ignore.
        }
      }

      // 📊 PostHog user identification
      if (user) {
        identifyUser(user.uid, {
          email: user.email ?? undefined,
          name: user.displayName ?? undefined,
          role,
          createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : undefined,
          isPremium: role === "premium" || role === "admin",
          isTester: role === "tester" || role === "admin",
          isAdmin,
        });
      } else {
        // User logged out - reset PostHog identity
        resetUser();
      }

      // Initialize child services (non-blocking). The childServicesInitialized guard
      // prevents re-running all Firestore reads on every Vite HMR reload.
      if (user && !childServicesInitialized) {
        childServicesInitialized = true;
        initializeChildServices(user, () => _state.user);

        // Initialize subscription listener for real-time role sync
        void initializeSubscriptionListener(user);
      }

      // Revalidate current module after auth state changes
      if (typeof window !== "undefined") {
        import("../../application/state/ui/module-state")
          .then(async (moduleState) => {
            await moduleState.revalidateCurrentModule();
          })
          .catch(() => {
            // Ignore - module state may not be available yet
          });
      }
    },
    (_error) => {
      console.error("❌ [authState] Auth state change error:", _error);
      _state = {
        user: null,
        loading: false,
        initialized: true,
        isAdmin: false,
        role: "user",
      };
    }
  );
}

/**
 * Sign out the current user
 * Clears all sensitive data from client-side storage
 */
export async function signOut() {
  try {
    // Close any open auth drawer synchronously. This prevents the "sign up"
    // sheet from flashing back into view the moment Firebase's auth state
    // flips to signed-out and MainApplication re-mounts <AuthDrawer>.
    try {
      const { authDrawerState } =
        await import("../state/auth-drawer-state.svelte");
      authDrawerState.reset();
    } catch {
      // Non-critical; UI will still end up in the right place.
    }

    // Tell Google Identity Services not to auto-select this account on the
    // next One Tap prompt. Without this, if the One Tap library is already
    // loaded, it will eagerly re-prompt the user the instant any surface
    // that mounts <GoogleOneTap autoPrompt /> reappears.
    try {
      (window as { google?: { accounts?: { id?: { disableAutoSelect?: () => void } } } })
        .google?.accounts?.id?.disableAutoSelect?.();
    } catch {
      // GSI may not be loaded yet; nothing to do.
    }

    // Clear any auth-related localStorage items
    const keysToRemove = Object.keys(localStorage).filter(
      (key) =>
        key.startsWith("tka_") ||
        key.includes("auth") ||
        key.includes("session")
    );
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Clear sessionStorage entirely
    sessionStorage.clear();

    // Note: Profile settings state is now context-based (profile-settings-context.svelte.ts)
    // State is automatically cleaned up when the component unmounts, no manual reset needed

    // Reset child services flag so next sign-in triggers the full init cascade
    childServicesInitialized = false;

    // Reset first-run cloud sync so next signin will sync fresh
    try {
      const { firstRunState } =
        await import("../../onboarding/state/first-run-state.svelte");
      firstRunState.resetCloudSync();
    } catch {
      // First-run state may not be loaded - that's ok
    }

    // Mark user as offline in presence system before signing out
    try {
      const presenceService = getPresenceTracker();
      if (presenceService) {
        await presenceService.goOffline();
      }
    } catch {
      // Silently fail - presence is non-critical
    }

    // Clean up subscription listener
    if (cleanupSubscriptionListener) {
      cleanupSubscriptionListener();
      cleanupSubscriptionListener = null;
    }

    // Unregister FCM push token before signing out
    try {
      const userId = _state.user?.uid;
      const fcmTokenManager = getFCMTokenManager();
      if (userId && fcmTokenManager) {
        await fcmTokenManager.unregisterToken(userId);
      }
    } catch {
      // Push token cleanup is non-critical
    }

    // Clean up Firestore subscriptions BEFORE signing out
    // This prevents permission errors when Firebase auth is invalidated
    try {
      const { settingsService } =
        await import("../../settings/state/SettingsState.svelte");
      settingsService.cleanup();
    } catch {
      // Settings service may not be loaded - that's ok
    }

    // Sign out from Firebase
    await firebaseSignOut(auth);
    // State will be updated automatically by onAuthStateChanged
  } catch (_error) {
    console.error("❌ [authState] Sign out error:", _error);
    throw _error;
  }
}

export async function changeEmail(newEmail: string, currentPassword: string) {
  const user = _state.user;
  if (!user) throw new Error("No authenticated user");
  return doChangeEmail(user, newEmail, currentPassword);
}

/**
 * Refresh the current user's data from Firebase
 * Used after operations that modify user data (like linking providers)
 * to ensure the local state reflects the latest server state.
 */
export async function refreshUser(): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    console.warn("⚠️ [authState] Cannot refresh - no user signed in");
    return;
  }

  try {
    // Reload user from Firebase to get fresh providerData
    await user.reload();

    // Get the refreshed user (reload mutates the object but we need to trigger reactivity)
    const refreshedUser = auth.currentUser;

    if (refreshedUser) {
      // Update state with refreshed user to trigger Svelte reactivity
      _state = {
        ..._state,
        user: refreshedUser,
      };
    }
  } catch (error) {
    console.error("❌ [authState] Failed to refresh user:", error);
    throw error;
  }
}

export async function updateDisplayName(displayName: string) {
  const user = _state.user;
  if (!user) throw new Error("No authenticated user");
  const result = await doUpdateDisplayName(user, displayName);
  _state = { ..._state, user: auth.currentUser };
  return result;
}

export async function updateUsername(newUsername: string) {
  const user = _state.user;
  if (!user) throw new Error("No authenticated user");
  return doUpdateUsername(user, newUsername);
}

export async function updateInstagramUsername(username: string) {
  const user = _state.user;
  if (!user) throw new Error("No authenticated user");
  return doUpdateInstagramUsername(user, username);
}

export async function updatePronouns(pronouns: string) {
  const user = _state.user;
  if (!user) throw new Error("No authenticated user");
  return doUpdatePronouns(user, pronouns);
}

/**
 * Clean up the auth listener
 * Call this when your app unmounts (if ever)
 */
export function cleanup() {
  if (cleanupAuthListener) {
    cleanupAuthListener();
    cleanupAuthListener = null;
  }
  if (cleanupSubscriptionListener) {
    cleanupSubscriptionListener();
    cleanupSubscriptionListener = null;
  }
}

/**
 * Default export with all methods (for backward compatibility during migration)
 */
export const authState = {
  // Direct state access (for Svelte 5 reactivity)
  get user() {
    return _state.user;
  },
  get loading() {
    return _state.loading;
  },
  get initialized() {
    return _state.initialized;
  },
  get isAdmin() {
    return _state.isAdmin;
  },
  get role() {
    return _state.role;
  },
  get isAuthenticated() {
    return _state.user !== null;
  },

  // Effective user helpers (as properties)
  get effectiveUserId() {
    return getEffectiveUserId();
  },
  get effectiveRole() {
    return getEffectiveRole();
  },
  get isEffectiveAdmin() {
    return isEffectiveAdmin();
  },

  // Function-style getters (for explicit calls)
  getUserState,
  getUser,
  isLoading,
  isInitialized,
  getRole,
  getEffectiveUserId,
  getEffectiveRole,

  // Auth operations
  initialize: initializeAuthListener, // Alias for backward compatibility
  initializeAuthListener,
  signOut,
  changeEmail,
  updateDisplayName,
  updateUsername,
  updateInstagramUsername,
  updatePronouns,
  refreshUser,
  cleanup,
};
