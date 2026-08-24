<!--
  Account creation and sign-in modal.

  BaseModal owns the native dialog behavior. ContextualAuthPrompt owns the
  approved visual surface and changes its copy to match the action that opened
  it. The existing provider components still own every authentication flow.
-->
<script lang="ts">
  import { page } from "$app/state";
  import { captureWhenReady } from "$lib/shared/analytics/services/posthog";
  import {
    trackAuthModalAbandoned,
    trackAuthProviderResult,
  } from "$lib/shared/analytics/auth-events";
  import type {
    AuthMode,
    AuthNudgeTrigger,
  } from "$lib/shared/auth/domain/auth-nudge-trigger";
  import { getAuthPromptContent } from "$lib/shared/auth/domain/auth-nudge-trigger";
  import { getInAppBrowserDetector } from "$lib/shared/auth/get-in-app-browser-detector";
  import {
    clearAuthSubmissionBridge,
    recordAuthSubmission,
  } from "$lib/shared/auth/services/auth-analytics-bridge";
  import { signInWithFacebook } from "$lib/shared/auth/services/authenticator";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import ContextualAuthPrompt from "./ContextualAuthPrompt.svelte";
  import GoogleOneTap from "./GoogleOneTap.svelte";

  interface Props {
    open: boolean;
    initialMode?: AuthMode;
    reason?: AuthNudgeTrigger | null;
    onClose: () => void;
  }

  let {
    open,
    initialMode = "signup",
    reason = null,
    onClose,
  }: Props = $props();

  let authMode = $state<AuthMode>("signup");
  let facebookError = $state<string | null>(null);

  const promptContent = $derived(getAuthPromptContent(reason, authMode));
  const inAppBrowser = $derived(
    getInAppBrowserDetector().isInAppBrowserOrForced(page.url.searchParams)
  );

  // Reopening the dialog always starts from the mode requested by the action
  // that launched it. Provider errors belong only to that encounter.
  $effect(() => {
    if (!open) return;
    authMode = initialMode;
    facebookError = null;
  });

  // In webviews, email is promoted because provider popups cannot complete.
  // Keep the measurement fire-once without making it reactive state.
  let promotedFired = false;
  $effect(() => {
    if (!open) {
      promotedFired = false;
      return;
    }
    if (!inAppBrowser || promotedFired) return;
    promotedFired = true;
    captureWhenReady("inapp_auth_magic_link_promoted", {
      route: page.url.pathname,
    });
  });

  function handleGoogleOneTapError(error: Error) {
    trackAuthProviderResult("google_one_tap", "failed", "one_tap_error");
    console.error("[AuthModal] Google One Tap sign-in failed", error);
    toast.error("Google sign-in failed. Please try again.");
  }

  async function handleFacebookAuth() {
    facebookError = null;
    recordAuthSubmission("facebook", authMode);
    try {
      await signInWithFacebook();
      trackAuthProviderResult("facebook", "completed");
    } catch (error: unknown) {
      console.error("[AuthModal] Facebook auth failed", error);
      const errorCode = (error as { code?: string })?.code;
      const interrupted =
        errorCode === "auth/popup-closed-by-user" ||
        errorCode === "auth/cancelled-popup-request";
      trackAuthProviderResult(
        "facebook",
        interrupted ? "interrupted" : "failed",
        errorCode ?? "unknown"
      );

      if (errorCode === "auth/popup-blocked") {
        facebookError = "Popup was blocked. Please allow popups for this site.";
      } else if (errorCode === "auth/popup-closed-by-user") {
        facebookError = "Sign-in cancelled. Please try again.";
      } else if (errorCode === "auth/cancelled-popup-request") {
        facebookError = null;
      } else if (
        errorCode === "auth/account-exists-with-different-credential"
      ) {
        facebookError =
          "This email is already registered. Sign in with your original method and Facebook will be connected automatically.";
      } else {
        facebookError =
          error instanceof Error
            ? error.message
            : "Facebook sign-in failed. Please try again.";
      }
    }
  }

  function handleCloseButtonClick() {
    trackAuthModalAbandoned("close_button");
    clearAuthSubmissionBridge();
    onClose();
  }

  function handleModalDismiss() {
    trackAuthModalAbandoned("backdrop_or_escape");
    clearAuthSubmissionBridge();
    onClose();
  }
</script>

<BaseModal
  {open}
  size="fit"
  position="center"
  animation="pop"
  class="chromeless contextual-auth-shell"
  labelledBy="auth-modal-title"
  describedBy="auth-modal-description"
  closeOnBackdrop
  closeOnEscape
  onclose={handleModalDismiss}
>
  <GoogleOneTap
    autoPrompt={open}
    onSuccess={() => {
      recordAuthSubmission("google_one_tap", authMode);
      trackAuthProviderResult("google_one_tap", "completed");
    }}
    onError={handleGoogleOneTapError}
  />

  <ContextualAuthPrompt
    content={promptContent}
    bind:mode={authMode}
    active={open}
    idPrefix="auth-modal"
    showClose
    {inAppBrowser}
    {facebookError}
    onClose={handleCloseButtonClick}
    onFacebookAuth={handleFacebookAuth}
  />
</BaseModal>
