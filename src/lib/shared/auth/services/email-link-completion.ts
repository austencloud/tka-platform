/**
 * Magic-link (email-link) sign-in completion.
 *
 * Two phases, deliberately split so the single-use oobCode is never consumed
 * without a human in the loop:
 *
 *  - Detection (`isEmailLinkPending`, `getSavedEmailForSignIn`) is read-only
 *    and safe to call anywhere, including at app boot. It never talks to
 *    Firebase Auth beyond the local `isSignInWithEmailLink` URL check.
 *  - Completion (`completeEmailLinkSignIn`) consumes the oobCode via
 *    Firebase Auth. It must only run after the user explicitly confirms
 *    (EmailLinkConfirmModal's "Finish signing in" button) — never
 *    automatically on page load. Auto-completing on load let a corporate
 *    link-prescanner burn the single-use code before the human ever clicked,
 *    silently breaking sign-in.
 *
 * Handles the anonymous-upgrade path (link the email credential onto the
 * surviving anon user, preserving uid + data) and the email-already-in-use
 * collision path (sign into the existing account, offer to import anon drafts).
 */

import {
  isSignInWithEmailLink,
  signInWithEmailLink,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  setPersistence,
} from "firebase/auth";
import { auth } from "../firebase";

export interface EmailLinkCompletionResult {
  /** A magic link was present and sign-in completed. */
  completed: boolean;
  /** Set when completion was attempted but failed (or email was required). */
  errorCode?: string;
  errorMessage?: string;
}

const EMAIL_FOR_SIGN_IN_KEY = "emailForSignIn";

/**
 * Whether the current URL carries an unconsumed Firebase email-sign-in link.
 * Read-only — never touches the oobCode. Safe to call at any point (app
 * boot, route change) to decide whether to show the confirm interstitial.
 */
export function isEmailLinkPending(): boolean {
  if (typeof window === "undefined") return false;
  return isSignInWithEmailLink(auth, window.location.href);
}

/**
 * The email saved on this device when the link was requested, or null if the
 * link was opened on a different device (or a different browser/profile).
 * Read-only.
 */
export function getSavedEmailForSignIn(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
}

/**
 * Complete a pending email-link sign-in from the current URL. This is the
 * code-consuming call — only invoke it after explicit user confirmation
 * (EmailLinkConfirmModal), never automatically.
 *
 * Returns `{ completed: false }` with no error when there's nothing to do.
 * `explicitEmail` is used when the device has no saved email (the link was
 * opened on a different device) — the confirm modal collects it via an
 * in-page field rather than `window.prompt`.
 */
export async function completeEmailLinkSignIn(
  explicitEmail?: string
): Promise<EmailLinkCompletionResult> {
  if (typeof window === "undefined") return { completed: false };

  const link = window.location.href;
  if (!isSignInWithEmailLink(auth, link)) {
    return { completed: false };
  }

  // Persistence must be configured before sign-in so the session survives reload.
  try {
    await setPersistence(auth, indexedDBLocalPersistence);
  } catch {
    await setPersistence(auth, browserLocalPersistence);
  }

  // Email is saved on the device that requested the link. If it's missing the
  // link was opened on a different device — the caller must supply one from
  // an in-page field (collected via the confirm modal), not window.prompt.
  const savedEmail = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY) ?? explicitEmail ?? null;
  if (!savedEmail) {
    return {
      completed: false,
      errorCode: "auth/missing-email",
      errorMessage: "Email address is required to complete sign-in.",
    };
  }

  try {
    // If an anonymous session survived the email round-trip, LINK the email
    // credential onto the anon user in place (preserving its uid + data)
    // instead of minting a fresh account.
    if (auth.currentUser?.isAnonymous) {
      const { EmailAuthProvider, linkWithCredential } = await import(
        "firebase/auth"
      );
      const anonUid = auth.currentUser.uid;
      const credential = EmailAuthProvider.credentialWithLink(savedEmail, link);
      try {
        await linkWithCredential(auth.currentUser, credential);
        // Guest just upgraded to a full account — fire the admin signup
        // notification (createOrUpdateUserDocument skips it for anon users,
        // and the linked uid's doc already exists so it won't re-fire there).
        const { notifyUpgradeSignup } = await import(
          "$lib/shared/auth/services/anonymous-upgrade"
        );
        void notifyUpgradeSignup();
      } catch (linkErr) {
        const code = (linkErr as { code?: string })?.code;
        if (
          code === "auth/credential-already-in-use" ||
          code === "auth/email-already-in-use"
        ) {
          // Email already belongs to a permanent account: sign into it and
          // offer to import the anon's drafts.
          const { upgradeMagicLinkCollision } = await import(
            "$lib/shared/auth/services/anonymous-upgrade"
          );
          const { promptAnonymousImport } = await import(
            "$lib/shared/auth/state/anonymous-import-prompt.svelte"
          );
          const drafts = await upgradeMagicLinkCollision(
            anonUid,
            savedEmail,
            link
          );
          promptAnonymousImport(drafts);
        } else {
          throw linkErr;
        }
      }
    } else {
      await signInWithEmailLink(auth, savedEmail, link);
    }

    window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);

    // Magic-link accounts have no password. If this account is email-only (no
    // OAuth provider to fall back on), flag it to require setting one. The boot
    // cloud-sync clears this if the account already has a password (e.g. an
    // existing account reached via the collision path), so it never traps a
    // password-haver. OAuth accounts are exempt.
    const user = auth.currentUser;
    const hasOAuth = !!user?.providerData.some(
      (p) => p.providerId === "google.com" || p.providerId === "facebook.com"
    );
    if (user && !hasOAuth) {
      const { passwordOnboardingState } = await import(
        "$lib/shared/onboarding/state/password-onboarding-state.svelte"
      );
      passwordOnboardingState.markRequired();
    }

    // Strip the consumed Firebase link params from the URL so a reload doesn't
    // replay an already-used link (which throws auth/invalid-action-code) and
    // the address bar reads clean. Stays on the same route.
    try {
      const url = new URL(link);
      ["apiKey", "oobCode", "mode", "lang", "continueUrl"].forEach((p) =>
        url.searchParams.delete(p)
      );
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search + url.hash
      );
    } catch {
      // URL cleanup is cosmetic — never block sign-in on it.
    }

    return { completed: true };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    return {
      completed: false,
      errorCode: e?.code,
      errorMessage: e?.message,
    };
  }
}
