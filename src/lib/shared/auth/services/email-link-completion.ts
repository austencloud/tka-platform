/**
 * Magic-link (email-link) sign-in completion.
 *
 * Detects a Firebase email-link in the current URL and completes sign-in.
 * Safe to call on ANY route / app entry point — it no-ops when the URL is not a
 * magic link. This is the single source of truth for completion: both the app
 * bootstrap (so a link landing on /create completes regardless of which surface
 * is mounted) and the EmailLinkAuth form call it.
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
 * Complete a pending email-link sign-in from the current URL.
 * Returns `{ completed: false }` with no error when there's nothing to do.
 */
export async function completeEmailLinkSignIn(): Promise<EmailLinkCompletionResult> {
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
  // link was opened on a different device — prompt to prevent session fixation.
  let savedEmail = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
  if (!savedEmail) {
    savedEmail = window.prompt("Please enter your email address to confirm:");
  }
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
