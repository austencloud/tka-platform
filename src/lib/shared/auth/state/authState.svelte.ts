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
 * - Profile picture management → IProfilePictureManager
 * - User document CRUD → IUserDocumentManager
 *
 * Preview mode integration:
 * - getEffectiveUserId/Role/Admin check userPreviewState for admin preview mode
 */

import { getUserDocumentManager } from "$lib/shared/auth/getUserDocumentManager";
import { getUsernameValidator } from "$lib/shared/auth/getUsernameValidator";
import { getProfilePictureManager } from "$lib/shared/auth/getProfilePictureManager";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  updateEmail,
  updateProfile,
  sendEmailVerification,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User,
} from "firebase/auth";
import { getActivityLogger } from "../../analytics/getActivityLogger";
import { getPresenceTracker } from "../../presence/getPresenceTracker";

// Service imports
import type { IProfilePictureManager } from "../services/contracts/IProfilePictureManager";
import type { IUserDocumentManager } from "../services/contracts/IUserDocumentManager";
import { auth } from "../firebase";
// Preview state for admin "View As" feature
import { userPreviewState } from "../../debug/state/user-preview-state.svelte";
import type { IActivityLogger } from "../../analytics/services/contracts/IActivityLogger";
import type { IFCMTokenManager } from "../../push/services/contracts/IFCMTokenManager";
import type { IUsernameValidator } from "../services/contracts/IUsernameValidator";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirestoreInstance } from "../firebase";
import { featureFlagService } from "../services/PostHogFeatureFlagService.svelte";
import type { UserRole } from "../domain/models/UserRole";
import { identifyUser, resetUser } from "../../analytics/services/posthog";

import { getCollectionManager } from "$lib/features/library/getCollectionManager";
import { getDeviceIdService } from "$lib/shared/auth/getDeviceIdService";

import { getFCMTokenManager } from "$lib/shared/push/getFCMTokenManager";

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

      // Safety timeout: if auth processing hangs (bad network, Firestore
      // unreachable), force loading = false after 8 seconds so the app
      // is never stuck on the loading spinner indefinitely.
      const safetyTimeout = setTimeout(() => {
        if (_state.loading) {
          console.warn("⚠️ [authState] Auth processing timed out - unblocking UI");
          _state = {
            ..._state,
            loading: false,
            initialized: true,
          };
        }
      }, 8000);

      // CRITICAL: Initialize Firestore before any services try to use it
      // This prevents race condition errors with the lazy-loaded Firestore Proxy
      if (user) {
        try {
          const { getFirestoreInstance } =
            await import("$lib/shared/auth/firebase");
          await getFirestoreInstance();
        } catch (error) {
          console.error(
            "❌ [authState] Failed to initialize Firestore:",
            error
          );
        }
      }

      let isAdmin = false;
      let role: UserRole = "user";

      if (user) {
        try {
          // Get user claims to determine role
          const idTokenResult = await user.getIdTokenResult(true);
          isAdmin = idTokenResult.claims.admin === true;
          role = (idTokenResult.claims.role as UserRole) || "user";

          // Create or update user document in Firestore
          const userDocumentService = getUserDocumentManager();
          if (userDocumentService) {
            try {
              await userDocumentService.createOrUpdateUserDocument(user);
            } catch (error) {
              console.error(
                "❌ [authState] Failed to update user document:",
                error
              );
            }
          }

          // Update profile pictures from OAuth providers (non-blocking)
          const profilePictureService = getProfilePictureManager();
          if (profilePictureService) {
            profilePictureService
              .updateFacebookProfilePictureIfNeeded(user)
              .catch((error: unknown) => {
                console.warn(
                  "⚠️ [authState] Facebook profile picture update failed:",
                  error
                );
              });
            profilePictureService
              .updateGoogleProfilePictureIfNeeded(user)
              .catch((error: unknown) => {
                console.warn(
                  "⚠️ [authState] Google profile picture update failed:",
                  error
                );
              });
          }

          // Initialize feature flags for this user
          // Pass the role from auth token to prevent race condition with Firestore
          try {
            await featureFlagService.initialize(user.uid, role);
          } catch (_error) {
            console.warn(
              "⚠️ [authState] Failed to initialize feature flags:",
              _error
            );
          }

          // Link this device to the signed-in user (fire-and-forget)
          getDeviceIdService()
            .linkDeviceToUser(user.uid)
            .catch((err: unknown) => {
              console.warn("⚠️ [authState] Failed to link device to user", err);
            });
        } catch (_error) {
          console.warn("⚠️ [authState] Auth processing error:", _error);
        }
      } else {
        // Initialize feature flags without user
        try {
          await featureFlagService.initialize(null);
        } catch (_error) {
          console.warn(
            "⚠️ [authState] Failed to initialize feature flags:",
            _error
          );
        }
      }

      clearTimeout(safetyTimeout);

      const desktopAdminFallback = isDesktopEnv && !user;
      _state = {
        user,
        loading: false,
        initialized: true,
        isAdmin: desktopAdminFallback ? true : isAdmin,
        role: desktopAdminFallback ? "admin" : role,
      };

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

      // Log session start for analytics and initialize child services (non-blocking).
      // The childServicesInitialized guard prevents re-running all Firestore reads on
      // every Vite HMR reload. Without this, each file save costs ~12 Firestore operations.
      if (user && !childServicesInitialized) {
        childServicesInitialized = true;
        try {
          const activityService = getActivityLogger();
          if (activityService) {
            activityService.logSessionStart().catch((error: unknown) => {
              console.warn(
                "⚠️ [authState] Session start logging failed:",
                error
              );
            });
          }
        } catch {
          // Silently fail - activity logging is non-critical
        }

        // Initialize presence tracking (non-blocking)
        (async () => {
          try {
            const presenceService = getPresenceTracker();
            if (presenceService) {
              await presenceService.initialize();
            }
          } catch (error) {
            console.warn(
              "⚠️ [authState] Presence initialization failed:",
              error
            );
          }
        })();

        // Initialize settings Firebase sync (non-blocking)
        import("$lib/shared/settings/state/SettingsState.svelte")
          .then(async (settingsModule) => {
            // Ensure Firestore is initialized before settings sync
            const { getFirestoreInstance } =
              await import("$lib/shared/auth/firebase");
            await getFirestoreInstance();
            await settingsModule.settingsService.initializeFirebaseSync();
          })
          .catch((error) => {
            console.warn(
              "⚠️ [authState] Settings sync initialization failed:",
              error
            );
          });

        // Initialize global arrow adjustments (non-blocking)
        // This loads all admin-set arrow position overrides from Firestore
        import(
          "$lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton"
        )
          .then(async ({ initializeGlobalAdjustments }) => {
            const { getFirestoreInstance } =
              await import("$lib/shared/auth/firebase");
            await getFirestoreInstance();
            await initializeGlobalAdjustments();
          })
          .catch((error) => {
            console.warn(
              "⚠️ [authState] Global arrow adjustments initialization failed:",
              error
            );
          });

        // Initialize prop geometry adjustments (non-blocking)
        // Letter-free, prop-aware arrow adjustments for props like triads/fans
        import(
          "$lib/shared/pictograph/arrow/positioning/prop-geometry/services/prop-geometry-singleton"
        )
          .then(async ({ initializePropGeometryAdjustments }) => {
            const { getFirestoreInstance } =
              await import("$lib/shared/auth/firebase");
            await getFirestoreInstance();
            await initializePropGeometryAdjustments();
          })
          .catch((error) => {
            console.warn(
              "⚠️ [authState] Prop geometry adjustments initialization failed:",
              error
            );
          });

        // Sync first-run status FROM cloud (critical - must happen before UI renders)
        // This ensures returning users on new devices don't see the wizard again
        import("$lib/shared/onboarding/state/first-run-state.svelte")
          .then(async ({ firstRunState }) => {
            const { getFirestoreInstance } =
              await import("$lib/shared/auth/firebase");
            await getFirestoreInstance();
            await firstRunState.syncFromCloud();
          })
          .catch(async (error) => {
            console.warn("⚠️ [authState] First-run sync failed:", error);
            // CRITICAL: Mark sync as complete even on failure to prevent stuck loading screen
            // This allows new users to proceed to FirstRunWizard even if cloud sync fails
            try {
              const { firstRunState } =
                await import("$lib/shared/onboarding/state/first-run-state.svelte");
              firstRunState.markCloudSyncComplete();
            } catch {
              // If even the import fails, app is in a very bad state - nothing more we can do
            }
          });

        // Initialize onboarding Firebase sync (non-blocking)
        import("$lib/shared/onboarding/config/storage-keys")
          .then(async (onboardingModule) => {
            // Ensure Firestore is initialized before onboarding sync
            const { getFirestoreInstance } =
              await import("$lib/shared/auth/firebase");
            await getFirestoreInstance();
            await onboardingModule.syncOnboardingToCloud();
          })
          .catch((error) => {
            console.warn("⚠️ [authState] Onboarding sync failed:", error);
          });

        // Initialize system collections (Favorites, etc.) - non-blocking
        (async () => {
          try {
            // Ensure Firestore is initialized before collection operations
            const { getFirestoreInstance } =
              await import("$lib/shared/auth/firebase");
            await getFirestoreInstance();

            // Re-check auth after async gap - a logout callback may have
            // cleared _state.user while we were awaiting Firestore.
            if (!_state.user) return;

            const collectionService = getCollectionManager();
            if (collectionService?.ensureSystemCollections) {
              await collectionService.ensureSystemCollections();
            }
          } catch (error) {
            console.warn(
              "⚠️ [authState] System collections init failed:",
              error
            );
          }
        })();

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

/**
 * Change user email (requires re-authentication)
 * @param newEmail - The new email address
 * @param currentPassword - Current password for re-authentication
 */
export async function changeEmail(newEmail: string, currentPassword: string) {
  const user = _state.user;
  if (!user?.email) {
    throw new Error("No authenticated user");
  }

  try {
    // Re-authenticate user with current password
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword
    );
    await reauthenticateWithCredential(user, credential);

    // Update email
    await updateEmail(user, newEmail);

    // Send verification email to new address
    await sendEmailVerification(user);

    return {
      success: true,
      message:
        "Email updated successfully. Please check your inbox to verify your new email address.",
    };
  } catch (error: unknown) {
    console.error("❌ [authState] Email change error:", error);

    // Handle specific Firebase errors
    if (error instanceof Error && "code" in error) {
      const firebaseError = error as { code: string; message: string };
      if (firebaseError.code === "auth/wrong-password") {
        throw new Error("Incorrect password. Please try again.");
      } else if (firebaseError.code === "auth/email-already-in-use") {
        throw new Error("This email is already in use by another account.");
      } else if (firebaseError.code === "auth/invalid-email") {
        throw new Error("Invalid email address format.");
      } else if (firebaseError.code === "auth/requires-recent-login") {
        throw new Error(
          "Please sign out and sign in again before changing your email."
        );
      } else {
        throw new Error(
          firebaseError.message || "Failed to change email. Please try again."
        );
      }
    } else {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to change email. Please try again.";
      throw new Error(message);
    }
  }
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

/**
 * Update user's display name
 * @param displayName - The new display name
 */
export async function updateDisplayName(displayName: string) {
  const user = _state.user;
  if (!user) {
    throw new Error("No authenticated user");
  }

  try {
    await updateProfile(user, {
      displayName: displayName.trim() || null,
    });

    // Trigger Svelte reactivity by reassigning state with updated user
    _state = {
      ..._state,
      user: auth.currentUser,
    };

    return {
      success: true,
      message: "Display name updated successfully.",
    };
  } catch (error: unknown) {
    console.error("❌ [authState] Display name update error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update display name. Please try again.";
    throw new Error(message);
  }
}

/**
 * Update user's username
 * @param newUsername - The new username (case-preserving)
 */
export async function updateUsername(newUsername: string) {
  const user = _state.user;
  if (!user) {
    throw new Error("No authenticated user");
  }

  try {
    const usernameValidator = getUsernameValidator();

    if (!usernameValidator) {
      throw new Error("Username validation service not available");
    }

    // Get current username to release it later
    const firestore = await getFirestoreInstance();
    const userDocRef = doc(firestore, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    const currentUsername = userDoc.data()?.username;

    // Claim new username (this validates and updates Firestore atomically)
    await usernameValidator.claimUsername(user.uid, newUsername.trim());

    // Release old username if different
    if (
      currentUsername &&
      currentUsername.toLowerCase() !== newUsername.toLowerCase()
    ) {
      await usernameValidator.releaseUsername(currentUsername);
    }

    return {
      success: true,
      message: "Username updated successfully.",
    };
  } catch (error: unknown) {
    console.error("❌ [authState] Username update error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update username. Please try again.";
    throw new Error(message);
  }
}

/**
 * Update user's Instagram username
 * @param username - The Instagram username (@ prefix will be stripped)
 */
export async function updateInstagramUsername(username: string) {
  const user = _state.user;
  if (!user) {
    throw new Error("No authenticated user");
  }

  try {
    // Normalize: trim whitespace and strip @ prefix if present
    const normalized = username.trim().replace(/^@/, "");

    // If empty, we'll store null to clear the field
    const valueToStore = normalized || null;

    const firestore = await getFirestoreInstance();
    const userDocRef = doc(firestore, "users", user.uid);

    await setDoc(
      userDocRef,
      { instagramUsername: valueToStore },
      { merge: true }
    );

    return {
      success: true,
      message: valueToStore
        ? "Instagram username updated successfully."
        : "Instagram username cleared.",
    };
  } catch (error: unknown) {
    console.error("❌ [authState] Instagram username update error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update Instagram username. Please try again.";
    throw new Error(message);
  }
}

/**
 * Update user's pronouns
 * @param pronouns - Free-text pronouns (e.g., "she/her", "they/them")
 */
export async function updatePronouns(pronouns: string) {
  const user = _state.user;
  if (!user) {
    throw new Error("No authenticated user");
  }

  try {
    const trimmed = pronouns.trim();
    const valueToStore = trimmed || null;

    const firestore = await getFirestoreInstance();
    const userDocRef = doc(firestore, "users", user.uid);

    await setDoc(
      userDocRef,
      { pronouns: valueToStore },
      { merge: true }
    );

    return {
      success: true,
      message: valueToStore
        ? "Pronouns updated successfully."
        : "Pronouns cleared.",
    };
  } catch (error: unknown) {
    console.error("❌ [authState] Pronouns update error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update pronouns. Please try again.";
    throw new Error(message);
  }
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
