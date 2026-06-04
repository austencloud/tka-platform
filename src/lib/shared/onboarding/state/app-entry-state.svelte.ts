/**
 * App Entry State
 *
 * Manages the post-onboarding experience:
 * - Wizard exit transition after first-run wizard
 * - Create tutorial walkthrough
 *
 * State machine phases:
 *   "wizard-active" -> "wizard-exiting" -> "create-tutorial" -> "complete"
 *
 * Returning users start at "complete" (checked via localStorage).
 * Persisted to localStorage + Firebase (same pattern as first-run-state).
 */

import { AUTO_TOURS_ENABLED } from "../domain/onboarding-flags";

export type AppEntryPhase =
  | "wizard-active"
  | "wizard-exiting"
  | "tutorial-prompt"
  | "create-tutorial"
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

  // If first-run is done but entry isn't, skip straight to create-tutorial.
  // Otherwise the "wizard-active" phase falls through to main app and the
  // tutorial is never shown for returning users who missed it.
  // With auto-tours disabled, first-run-done users land straight on the app.
  const firstRunDone =
    isBrowser &&
    localStorage.getItem("tka-first-run-completed") === "true";
  const initialPhase: AppEntryPhase = completed
    ? "complete"
    : firstRunDone
      ? AUTO_TOURS_ENABLED
        ? "tutorial-prompt"
        : "complete"
      : "wizard-active";

  const state = $state<AppEntryState>({
    phase: initialPhase,
    hasCompleted: completed,
  });

  // Duration constants (ms) for the choreography
  const WIZARD_EXIT_DURATION = 400;

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
     * Check if create tutorial should be showing.
     */
    isCreateTutorial(): boolean {
      return state.phase === "create-tutorial";
    },

    /**
     * Check if entry animation is in progress (wizard exit transition).
     */
    isEntryAnimating(): boolean {
      return state.phase === "wizard-exiting";
    },

    /**
     * Called when the first-run wizard finishes.
     * Kicks off the wizard exit -> create tutorial sequence.
     */
    startEntrySequence(force = false) {
      if (state.hasCompleted && !force) {
        state.phase = "complete";
        return;
      }

      // Auto-tours are deactivated: skip the tutorial prompt entirely and
      // drop the user straight into the app after the first-run wizard.
      if (!AUTO_TOURS_ENABLED) {
        this.completeEntry();
        return;
      }

      state.phase = "wizard-exiting";

      setTimeout(() => {
        state.phase = "tutorial-prompt";
      }, WIZARD_EXIT_DURATION);
    },

    /**
     * Check if the tutorial prompt should be showing.
     */
    isTutorialPrompt(): boolean {
      return state.phase === "tutorial-prompt";
    },

    /**
     * User accepted the tutorial prompt - show the full walkthrough.
     */
    acceptTutorial() {
      state.phase = "create-tutorial";
    },

    /**
     * User declined the tutorial prompt - skip to main app.
     */
    declineTutorial() {
      this.completeEntry();
    },

    /**
     * Called when create tutorial completes (all steps done or skipped).
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
     * Skip straight to complete (used when user skips create tutorial).
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

      setTimeout(() => {
        // Skip the prompt when replaying from Settings - user already opted in
        state.phase = "create-tutorial";
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
          "$lib/shared/auth/state/auth-state.svelte"
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
          "$lib/shared/auth/state/auth-state.svelte"
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
