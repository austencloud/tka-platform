/**
 * Password-Onboarding State
 *
 * Tracks whether an email/magic-link account has set a password yet, and
 * whether it is being required to. Magic-link signup creates an account with no
 * password; this drives a required, non-skippable set-password gate at signup /
 * next sign-in (see SetPasswordWizard + MainApplication gate).
 *
 * Scope: email-only accounts. Accounts with a google.com/facebook.com provider
 * are exempt (they already have a working login) and never flagged.
 *
 * `fetchSignInMethodsForEmail` is deprecated and returns empty under email-
 * enumeration protection, so "has a password?" cannot be read from Firebase.
 * We track it ourselves here, synced to Firestore so it doesn't re-prompt across
 * devices. Mirrors first-run-state.svelte.ts.
 */

const HAS_PASSWORD_KEY = "tka-has-password";
const PASSWORD_REQUIRED_KEY = "tka-password-required";

interface PasswordOnboardingState {
  /** Source of truth: the account has a usable password. */
  hasPassword: boolean;
  /** The account needs to set a password and hasn't yet. */
  required: boolean;
  /** Whether we've synced with cloud this session. */
  cloudSynced: boolean;
  /** Whether we're currently syncing with cloud. */
  syncInProgress: boolean;
}

function createPasswordOnboardingState() {
  const isBrowser = typeof window !== "undefined";

  const hasPassword = isBrowser
    ? localStorage.getItem(HAS_PASSWORD_KEY) === "true"
    : false;
  const required = isBrowser
    ? localStorage.getItem(PASSWORD_REQUIRED_KEY) === "true"
    : false;

  const state = $state<PasswordOnboardingState>({
    hasPassword,
    required: required && !hasPassword,
    cloudSynced: false,
    syncInProgress: false,
  });

  return {
    get hasPassword() {
      return state.hasPassword;
    },
    get required() {
      return state.required;
    },
    get cloudSynced() {
      return state.cloudSynced;
    },
    get syncInProgress() {
      return state.syncInProgress;
    },

    /** True once a password exists — no gate needed. */
    isDone(): boolean {
      return state.hasPassword;
    },

    /**
     * Flag this account as needing a password. Called from the email-link
     * completion path for email-only accounts. Never overrides an existing
     * password (hasPassword wins).
     */
    markRequired(): void {
      if (!isBrowser || state.hasPassword) return;
      state.required = true;
      localStorage.setItem(PASSWORD_REQUIRED_KEY, "true");
      // Persist so a returning session keeps requiring until satisfied.
      void this.syncToCloud();
    },

    /**
     * Record that the account now has a password (set-password success, or an
     * email/password signup). Clears the requirement permanently.
     */
    markHasPassword(): void {
      if (!isBrowser) return;
      state.hasPassword = true;
      state.required = false;
      localStorage.setItem(HAS_PASSWORD_KEY, "true");
      localStorage.removeItem(PASSWORD_REQUIRED_KEY);
      void this.syncToCloud();
    },

    /** Reset cloud-sync flags (call on signout so next signin syncs fresh). */
    resetCloudSync(): void {
      state.cloudSynced = false;
      state.syncInProgress = false;
    },

    /** Mark sync complete without a read (used when sync fails externally). */
    markCloudSyncComplete(): void {
      state.cloudSynced = true;
      state.syncInProgress = false;
    },

    /** Local reset (testing / dev). */
    reset(): void {
      if (!isBrowser) return;
      state.hasPassword = false;
      state.required = false;
      state.cloudSynced = false;
      localStorage.removeItem(HAS_PASSWORD_KEY);
      localStorage.removeItem(PASSWORD_REQUIRED_KEY);
    },

    /**
     * Sync password status FROM Firestore. A stored hasPassword=true clears any
     * local requirement (they set it on another device). A missing doc leaves
     * local state intact (a just-flagged requirement must survive).
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
        const docRef = doc(firestore, `users/${userId}/onboarding/password`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const cloudHasPassword = data.hasPassword === true;
          const cloudRequired = data.required === true;
          state.hasPassword = cloudHasPassword;
          state.required = cloudHasPassword ? false : cloudRequired || state.required;

          if (cloudHasPassword) {
            localStorage.setItem(HAS_PASSWORD_KEY, "true");
            localStorage.removeItem(PASSWORD_REQUIRED_KEY);
          } else if (state.required) {
            localStorage.setItem(PASSWORD_REQUIRED_KEY, "true");
          }
        }
        // Missing doc: leave local state as-is (a requirement flagged this
        // session must survive until the user sets a password).

        state.cloudSynced = true;
      } catch (error) {
        console.warn("⚠️ [passwordOnboarding] Failed to sync from cloud:", error);
        state.cloudSynced = true; // localStorage fallback; never get stuck loading
      } finally {
        state.syncInProgress = false;
      }
    },

    /** Sync password status TO Firestore. */
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
        const docRef = doc(firestore, `users/${userId}/onboarding/password`);

        await setDoc(
          docRef,
          {
            hasPassword: state.hasPassword,
            required: state.required,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        console.warn("⚠️ [passwordOnboarding] Failed to sync to cloud:", error);
      }
    },
  };
}

export const passwordOnboardingState = createPasswordOnboardingState();
