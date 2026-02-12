/**
 * App Entry State
 *
 * Manages the post-onboarding experience:
 * - Entry animation choreography after first-run wizard
 * - Guided first build walkthrough
 *
 * State machine phases:
 *   "wizard-active" -> "wizard-exiting" -> "entry-animating" -> "guided-build" -> "complete"
 *
 * Returning users start at "complete" (checked via localStorage).
 * Persisted to localStorage + Firebase (same pattern as first-run-state).
 */

export type AppEntryPhase =
  | "wizard-active"
  | "wizard-exiting"
  | "entry-animating"
  | "guided-build"
  | "complete";

const APP_ENTRY_COMPLETED_KEY = "tka-app-entry-completed";

interface AppEntryState {
  phase: AppEntryPhase;
  /** Whether entry has been completed at least once (persisted) */
  hasCompleted: boolean;
}

function createAppEntryState() {
  const isBrowser = typeof window !== "undefined";

  const completed = isBrowser
    ? localStorage.getItem(APP_ENTRY_COMPLETED_KEY) === "true"
    : false;

  const state = $state<AppEntryState>({
    phase: completed ? "complete" : "wizard-active",
    hasCompleted: completed,
  });

  // Duration constants (ms) for the choreography
  const WIZARD_EXIT_DURATION = 400;
  const ENTRY_ANIMATION_DURATION = 1400; // Enough for full stagger

  return {
    get phase() {
      return state.phase;
    },
    get hasCompleted() {
      return state.hasCompleted;
    },

    /**
     * Check if the full entry flow is done (user should see normal app).
     */
    isComplete(): boolean {
      return state.phase === "complete";
    },

    /**
     * Check if entry animation should be playing.
     */
    isEntryAnimating(): boolean {
      return state.phase === "entry-animating";
    },

    /**
     * Check if guided build should be showing.
     */
    isGuidedBuild(): boolean {
      return state.phase === "guided-build";
    },

    /**
     * Called when the first-run wizard finishes.
     * Kicks off the wizard exit -> entry animation -> guided build sequence.
     */
    startEntrySequence() {
      if (state.hasCompleted) {
        state.phase = "complete";
        return;
      }

      state.phase = "wizard-exiting";

      // After wizard exit animation completes, start entry animation
      setTimeout(() => {
        state.phase = "entry-animating";

        // After entry animation completes, start guided build
        setTimeout(() => {
          state.phase = "guided-build";
        }, ENTRY_ANIMATION_DURATION);
      }, WIZARD_EXIT_DURATION);
    },

    /**
     * Called when guided build completes (all steps done or skipped).
     */
    completeEntry() {
      state.phase = "complete";
      state.hasCompleted = true;

      if (isBrowser) {
        localStorage.setItem(APP_ENTRY_COMPLETED_KEY, "true");
      }

      // Sync to cloud (non-blocking)
      this.syncToCloud();
    },

    /**
     * Skip straight to complete (used when user skips guided build).
     */
    skipToComplete() {
      this.completeEntry();
    },

    /**
     * Force replay the entry experience (from Settings).
     */
    replay() {
      state.hasCompleted = false;
      state.phase = "wizard-exiting";

      // Skip the wizard exit since there's no wizard, go straight to entry animation
      setTimeout(() => {
        state.phase = "entry-animating";

        setTimeout(() => {
          state.phase = "guided-build";
        }, ENTRY_ANIMATION_DURATION);
      }, 100); // Brief delay for DOM reset
    },

    /**
     * Reset state (for testing/development).
     */
    reset() {
      if (!isBrowser) return;

      state.phase = "wizard-active";
      state.hasCompleted = false;
      localStorage.removeItem(APP_ENTRY_COMPLETED_KEY);
    },

    /**
     * Sync entry status FROM Firebase.
     * Called after authentication to check if user completed entry on another device.
     */
    async syncFromCloud(): Promise<void> {
      if (!isBrowser) return;

      try {
        const { getFirestoreInstance } = await import(
          "$lib/shared/auth/firebase"
        );
        const { doc, getDoc } = await import("firebase/firestore");
        const { authState } = await import(
          "$lib/shared/auth/state/authState.svelte"
        );

        const userId = authState.effectiveUserId;
        if (!userId) return;

        const firestore = await getFirestoreInstance();
        const docRef = doc(
          firestore,
          `users/${userId}/onboarding/appEntry`
        );
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.completed) {
            state.hasCompleted = true;
            state.phase = "complete";
            localStorage.setItem(APP_ENTRY_COMPLETED_KEY, "true");
          }
        }
      } catch (error) {
        console.warn(
          "[appEntryState] Failed to sync from cloud:",
          error
        );
      }
    },

    /**
     * Sync entry status TO Firebase.
     */
    async syncToCloud(): Promise<void> {
      if (!isBrowser) return;

      try {
        const { getFirestoreInstance } = await import(
          "$lib/shared/auth/firebase"
        );
        const { doc, setDoc, serverTimestamp } = await import(
          "firebase/firestore"
        );
        const { authState } = await import(
          "$lib/shared/auth/state/authState.svelte"
        );

        const userId = authState.effectiveUserId;
        if (!userId) return;

        const firestore = await getFirestoreInstance();
        const docRef = doc(
          firestore,
          `users/${userId}/onboarding/appEntry`
        );

        await setDoc(
          docRef,
          {
            completed: state.hasCompleted,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        console.warn(
          "[appEntryState] Failed to sync to cloud:",
          error
        );
      }
    },
  };
}

// Singleton instance
export const appEntryState = createAppEntryState();
