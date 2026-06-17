/**
 * AuthActionQueue.svelte.ts
 *
 * Pending-action queue with URL param handoff for gated actions.
 * Handles Google One Tap or popup sign-in routing and deferred
 * action replay after auth completes.
 *
 * Extracted from SequenceViewerOrchestrator to isolate auth concerns.
 */

import { browser } from "$app/environment";
import { replaceState } from "$app/navigation";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  setPersistence,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "$lib/shared/auth/firebase";
import { notePopupCoop } from "$lib/shared/auth/services/authenticator";
import { requiresFullAccount } from "$lib/shared/auth/domain/gated-action-policy";
import { ensureGuestIdentity } from "$lib/shared/auth/services/guest-identity";
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
import { getPendingActionQueue } from "../get-pending-action-queue";
import { isInAppWebview } from "../services/webview-detector";
import type { PendingActionType } from "$lib/shared/sequence-viewer/services/pending-action-queue";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

export interface AuthActionQueueCallbacks {
  handleSave: () => void;
  handleFavoriteToggle: () => void;
  handlePublishAction: () => Promise<void>;
  handleEdit: () => void;
  handleShare: () => void;
  handleOpenInBrowser: (pendingType?: PendingActionType | null) => void;
}

export function createAuthActionQueue() {
  const pendingActionQueue = getPendingActionQueue();

  let signInSheetOpen = $state(false);
  let signInSheetReason = $state<PendingActionType | null>(null);

  function openSignInSheet(reason: PendingActionType) {
    signInSheetReason = reason;
    signInSheetOpen = true;
  }

  function closeSignInSheet() {
    signInSheetOpen = false;
    signInSheetReason = null;
    pendingActionQueue.clear();
    if (browser) {
      const parsed = new URL(window.location.href);
      if (parsed.searchParams.has("pending")) {
        parsed.searchParams.delete("pending");
        replaceState(parsed, {});
      }
    }
  }

  /**
   * Called by footer action buttons. If signed in, runs the real handler.
   * If not, captures the intent, writes `?pending=` to the URL so a reload or
   * cross-browser handoff preserves it, and opens the sign-in sheet.
   */
  function invokeGatedAction(
    type: PendingActionType,
    realHandler: (() => void) | (() => Promise<void>) | undefined,
    sequence: SequenceData | null,
  ) {
    const isFullUser = authState.isAuthenticated && !authState.isAnonymous;

    if (requiresFullAccount(type)) {
      // publish: must be a permanent account.
      if (isFullUser) {
        void realHandler?.();
        return;
      }
      // fall through to the sign-in sheet below
    } else {
      // save / favorite / remix / sendTo: provision a guest identity if
      // needed, then run. Never prompts.
      void ensureGuestIdentity().then(() => realHandler?.());
      return;
    }

    const sequenceId = sequence?.id ?? sequence?.word ?? "";
    if (!sequenceId) return;

    pendingActionQueue.enqueue({ type, sequenceId });
    if (browser) {
      const parsed = new URL(window.location.href);
      parsed.searchParams.set("pending", type);
      replaceState(parsed, {});
    }
    openSignInSheet(type);
  }

  async function onSignInSheetPrimary(handleOpenInBrowser: (pendingType?: PendingActionType | null) => void) {
    if (isInAppWebview()) {
      handleOpenInBrowser(signInSheetReason);
      return;
    }

    // Prefer Google One Tap (FedCM) - it's the only flow that works reliably
    // on mobile web, where signInWithPopup is blocked by most browsers. The
    // app has a <GoogleOneTap /> mounted at root that already registered the
    // credential callback; we just need to invoke the prompt. The replay
    // effect below fires once the callback drives authState.isAuthenticated
    // to true.
    const oneTap = (window as unknown as Record<string, Record<string, Record<string, { prompt(): void }>>>).google?.accounts?.id;
    if (oneTap) {
      try {
        oneTap.prompt();
        signInSheetOpen = false;
        return;
      } catch {
        // FedCM cooldown or disabled - fall through to popup.
      }
    }

    // Desktop fallback: popup. Mirrors SocialAuthCompact's pattern.
    try {
      try {
        await setPersistence(auth, indexedDBLocalPersistence);
      } catch {
        await setPersistence(auth, browserLocalPersistence);
      }
      const provider = new GoogleAuthProvider();
      provider.addScope("email");
      provider.addScope("profile");
      notePopupCoop();
      await signInWithPopup(auth, provider);
      signInSheetOpen = false;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return; // user dismissed - leave sheet open for retry
      }
      console.error("[Viewer] Google sign-in failed:", err);
      showToast({ message: "Sign-in failed. Please try again.", type: "error", duration: 3000 });
    }
  }

  /** Bootstrap from URL on mount. Returns the pending action type if present. */
  function bootstrapFromUrl(): PendingActionType | null {
    if (!browser) return null;
    pendingActionQueue.bootstrapFromUrl(new URL(window.location.href));
    const pending = pendingActionQueue.peek();
    if (pending && !authState.isAuthenticated) {
      openSignInSheet(pending.type);
      return pending.type;
    }
    return null;
  }

  /**
   * Replay the pending action once the user finishes signing in. Call this
   * from an $effect that watches authState.isAuthenticated.
   */
  function replayPendingAction(callbacks: AuthActionQueueCallbacks): boolean {
    if (!authState.isAuthenticated) return false;
    const pending = pendingActionQueue.drain();
    if (!pending) return false;

    if (browser) {
      const parsed = new URL(window.location.href);
      if (parsed.searchParams.has("pending")) {
        parsed.searchParams.delete("pending");
        replaceState(parsed, {});
      }
    }

    try {
      switch (pending.type) {
        case "save":     void callbacks.handleSave(); break;
        case "favorite": callbacks.handleFavoriteToggle(); break;
        case "publish":  void callbacks.handlePublishAction(); break;
        case "remix":    callbacks.handleEdit(); break;
        case "sendTo":   callbacks.handleShare(); break;
      }
      signInSheetOpen = false;
      return true;
    } catch (err) {
      console.error("[Viewer] pending-action replay failed:", err);
      return false;
    }
  }

  return {
    get signInSheetOpen() { return signInSheetOpen; },
    set signInSheetOpen(v: boolean) { signInSheetOpen = v; },
    get signInSheetReason() { return signInSheetReason; },
    get isInAppWebview() { return isInAppWebview(); },
    openSignInSheet,
    closeSignInSheet,
    invokeGatedAction,
    onSignInSheetPrimary,
    bootstrapFromUrl,
    replayPendingAction,
  };
}

export type AuthActionQueueState = ReturnType<typeof createAuthActionQueue>;
