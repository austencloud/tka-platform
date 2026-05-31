/**
 * First-Run State
 *
 * Manages first-time user onboarding (separate from module onboarding).
 * This is the FIRST experience users see - before the module intro.
 *
 * Collects:
 * - Display name
 * - Favorite prop
 * - Pictograph mode (light/dark)
 *
 * IMPORTANT: This state syncs with Firebase so returning users on new
 * devices/browsers don't see the wizard again.
 */

const FIRST_RUN_COMPLETED_KEY = "tka-first-run-completed";
const FIRST_RUN_COMPLETED_AT_KEY = "tka-first-run-completed-at";
const FIRST_RUN_SKIPPED_KEY = "tka-first-run-skipped";

interface FirstRunState {
  /** Whether first-run wizard has been completed */
  hasCompleted: boolean;
  /** Whether first-run was skipped */
  wasSkipped: boolean;
  /** When first-run was completed */
  completedAt: Date | null;
  /** Whether to show the first-run wizard */
  shouldShow: boolean;
  /** Whether we've synced with cloud this session */
  cloudSynced: boolean;
  /** Whether we're currently syncing with cloud */
  syncInProgress: boolean;
}

function createFirstRunState() {
  // Check if we're in the browser
  const isBrowser = typeof window !== "undefined";

  // Read initial state from localStorage
  const completed = isBrowser
    ? localStorage.getItem(FIRST_RUN_COMPLETED_KEY) === "true"
    : false;
  const skipped = isBrowser
    ? localStorage.getItem(FIRST_RUN_SKIPPED_KEY) === "true"
    : false;
  const completedAtStr = isBrowser
    ? localStorage.getItem(FIRST_RUN_COMPLETED_AT_KEY)
    : null;
  const completedAt = completedAtStr ? new Date(completedAtStr) : null;

  const state = $state<FirstRunState>({
    hasCompleted: completed,
    wasSkipped: skipped,
    completedAt,
    shouldShow: false, // Controlled by trigger function
    cloudSynced: false,
    syncInProgress: false,
  });

  return {
    get hasCompleted() {
      return state.hasCompleted;
    },
    get wasSkipped() {
      return state.wasSkipped;
    },
    get completedAt() {
      return state.completedAt;
    },
    get shouldShow() {
      return state.shouldShow;
    },
    get syncInProgress() {
      return state.syncInProgress;
    },
    get cloudSynced() {
      return state.cloudSynced;
    },

    /**
     * Check if this is the user's first time and trigger the wizard.
     * Call this after the app initializes.
     */
    triggerIfFirstTime(): boolean {
      // Don't show if already completed or skipped
      if (state.hasCompleted || state.wasSkipped) {
        return false;
      }

      state.shouldShow = true;
      return true;
    },

    /**
     * Force show the first-run wizard (e.g., from settings "replay intro")
     */
    forceShow() {
      state.shouldShow = true;
    },

    /**
     * Mark first-run as completed
     */
    markCompleted() {
      if (!isBrowser) return;

      const now = new Date();
      state.hasCompleted = true;
      state.completedAt = now;
      state.shouldShow = false;

      localStorage.setItem(FIRST_RUN_COMPLETED_KEY, "true");
      localStorage.setItem(FIRST_RUN_COMPLETED_AT_KEY, now.toISOString());

      // Sync to cloud (non-blocking)
      this.syncToCloud();
    },

    /**
     * Mark first-run as skipped
     */
    markSkipped() {
      if (!isBrowser) return;

      state.wasSkipped = true;
      state.shouldShow = false;

      localStorage.setItem(FIRST_RUN_SKIPPED_KEY, "true");

      // Sync to cloud (non-blocking)
      this.syncToCloud();
    },

    /**
     * Hide the wizard without marking complete (temporary dismiss)
     */
    hide() {
      state.shouldShow = false;
    },

    /**
     * Reset first-run state (for testing/development)
     */
    reset() {
      if (!isBrowser) return;

      state.hasCompleted = false;
      state.wasSkipped = false;
      state.completedAt = null;
      state.shouldShow = false;
      state.cloudSynced = false;

      localStorage.removeItem(FIRST_RUN_COMPLETED_KEY);
      localStorage.removeItem(FIRST_RUN_COMPLETED_AT_KEY);
      localStorage.removeItem(FIRST_RUN_SKIPPED_KEY);
    },

    /**
     * Reset cloud sync state (call on signout so next signin syncs fresh)
     */
    resetCloudSync() {
      state.cloudSynced = false;
      state.syncInProgress = false;
    },

    /**
     * Mark cloud sync as complete (call when sync fails externally)
     * This prevents the UI from getting stuck on "Loading preferences..." forever
     * when Firebase/network errors occur before syncFromCloud() is called.
     */
    markCloudSyncComplete() {
      state.cloudSynced = true;
      state.syncInProgress = false;
    },

    /**
     * Check if first-run has been done (completed or skipped)
     */
    isDone(): boolean {
      return state.hasCompleted || state.wasSkipped;
    },

    /**
     * Sync first-run status FROM Firebase.
     * Call this when a user authenticates to check if they've completed
     * first-run on another device.
     */
    async syncFromCloud(): Promise<void> {
      if (!isBrowser || state.cloudSynced) return;

      state.syncInProgress = true;

      try {
        const { getFirestoreInstance } =
          await import("$lib/shared/auth/firebase");
        const { doc, getDoc } = await import("firebase/firestore");
        const { authState } =
          await import("$lib/shared/auth/state/auth-state.svelte");

        const userId = authState.effectiveUserId;
        if (!userId) {
          state.syncInProgress = false;
          return;
        }

        const firestore = await getFirestoreInstance();
        const docRef = doc(firestore, `users/${userId}/onboarding/firstRun`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.completed || data.skipped) {
            // User has completed first-run on another device
            state.hasCompleted = data.completed ?? false;
            state.wasSkipped = data.skipped ?? false;
            state.completedAt = data.completedAt
              ? new Date(data.completedAt)
              : null;

            // Also update localStorage for consistency
            if (data.completed) {
              localStorage.setItem(FIRST_RUN_COMPLETED_KEY, "true");
            }
            if (data.skipped) {
              localStorage.setItem(FIRST_RUN_SKIPPED_KEY, "true");
            }
            if (data.completedAt) {
              localStorage.setItem(
                FIRST_RUN_COMPLETED_AT_KEY,
                data.completedAt
              );
            }
          }
        } else {
          // CRITICAL FIX: Document doesn't exist - this is a brand new user!
          // We must RESET local state to prevent inheriting previous user's first-run status
          // (happens when multiple users share the same browser)
          state.hasCompleted = false;
          state.wasSkipped = false;
          state.completedAt = null;

          // Clear localStorage to match
          localStorage.removeItem(FIRST_RUN_COMPLETED_KEY);
          localStorage.removeItem(FIRST_RUN_COMPLETED_AT_KEY);
          localStorage.removeItem(FIRST_RUN_SKIPPED_KEY);

          // Also clear the module cache so new users start on default module (create)
          // instead of inheriting previous user's last-visited module
          localStorage.removeItem("tka-active-module-cache");
        }

        state.cloudSynced = true;
      } catch (error) {
        console.warn("⚠️ [firstRunState] Failed to sync from cloud:", error);
        // Mark as synced even on failure to avoid getting stuck in loading state
        // localStorage fallback will be used
        state.cloudSynced = true;
      } finally {
        state.syncInProgress = false;
      }
    },

    /**
     * Sync first-run status TO Firebase.
     * Called automatically when marking complete/skipped.
     */
    async syncToCloud(): Promise<void> {
      if (!isBrowser) return;

      try {
        const { getFirestoreInstance } =
          await import("$lib/shared/auth/firebase");
        const { doc, setDoc, serverTimestamp } =
          await import("firebase/firestore");
        const { authState } =
          await import("$lib/shared/auth/state/auth-state.svelte");

        const userId = authState.effectiveUserId;
        if (!userId) return;

        const firestore = await getFirestoreInstance();
        const docRef = doc(firestore, `users/${userId}/onboarding/firstRun`);

        await setDoc(
          docRef,
          {
            completed: state.hasCompleted,
            skipped: state.wasSkipped,
            completedAt: state.completedAt?.toISOString() ?? null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        console.warn("⚠️ [firstRunState] Failed to sync to cloud:", error);
        // Don't throw - localStorage still works as fallback
      }
    },
  };
}

// Singleton instance
export const firstRunState = createFirstRunState();
