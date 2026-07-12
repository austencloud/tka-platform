<!--
  SocialAuthCompact.svelte - Compact Social Authentication Buttons

  Side-by-side Google and Facebook auth buttons for sign-in/sign-up flows.

  Auth Flow Priority:
  1. Google One Tap (FedCM-native, no redirects) - via GoogleOneTap.svelte
  2. Popup-based auth (fallback for all providers)
  3. Error message (no redirect fallback - it never worked)
-->
<script lang="ts">
  import FacebookIcon from "./icons/FacebookIcon.svelte";
  import GoogleIcon from "./icons/GoogleIcon.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import {
    GoogleAuthProvider,
    browserLocalPersistence,
    indexedDBLocalPersistence,
    setPersistence,
    signInWithPopup,
  } from "firebase/auth";
  import { getAuthInstance } from "../firebase";
  import { upgradeAnonymousWithGoogle } from "$lib/shared/auth/services/anonymous-upgrade";
  import { promptAnonymousImport } from "$lib/shared/auth/state/anonymous-import-prompt.svelte";
  import { FACEBOOK_LOGIN_ENABLED } from "$lib/shared/auth/services/auth-providers.config";
  import { mapAuthError, getAuthErrorCode } from "$lib/shared/auth/services/auth-error-messages";

  let { mode = "signin", onFacebookAuth } = $props<{
    mode: "signin" | "signup";
    onFacebookAuth?: () => void;
  }>();

  let googleError = $state<string | null>(null);
  let isLoading = $state(false);

  async function handleGoogleClick() {
    if (isLoading) return;
    isLoading = true;
    googleError = null;

    // Cancel any pending One Tap prompt to prevent race conditions
    window.google?.accounts?.id?.cancel();

    try {
      // Resolve the Auth instance lazily. The static `auth` export is bound
      // to the Firebase app created at module-eval time, but the HMR manager
      // rotates the app on each dev cycle - leaving the static reference
      // bound to a terminated app. Firebase rejects such references with
      // auth/argument-error deep inside signInWithPopup. getAuthInstance()
      // always returns an Auth wired to the current app.
      const auth = await getAuthInstance();

      // Set persistence for reliable auth state
      try {
        await setPersistence(auth, indexedDBLocalPersistence);
      } catch {
        await setPersistence(auth, browserLocalPersistence);
      }

      const provider = new GoogleAuthProvider();
      provider.addScope("email");
      provider.addScope("profile");

      // Use popup for all devices - redirect flow has never worked.
      // Don't navigate on success: the AuthDrawer/AuthSheet that wraps this
      // button unmounts via `{#if !isAuthenticated}` in MainApplication, so
      // the user stays on whatever app page they opened the sheet from.
      // Navigating to "/" used to send them back to the marketing landing.
      if (auth.currentUser?.isAnonymous) {
        const result = await upgradeAnonymousWithGoogle();
        if (result.status === "collision-signed-in") {
          promptAnonymousImport(result.importable ?? []);
        }
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (error: unknown) {
      const errorCode = getAuthErrorCode(error);

      // Log the full error so we can see the stack in devtools. Firebase
      // swallows a lot of context inside FirebaseError; the stack is the
      // only reliable way to identify which call threw.
      console.error("[SocialAuthCompact] Google sign-in failed", {
        error,
        code: errorCode,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      googleError = mapAuthError(error);
    } finally {
      isLoading = false;
    }
  }

  function handleFacebookClick() {
    onFacebookAuth?.();
  }
</script>

<div class="social-auth-compact">
  <p class="social-compact-label">
    {mode === "signin" ? "Sign in with" : "Sign up with"}
  </p>
  <div class="social-compact-buttons">
    <button
      class="social-compact-button social-compact-button--google"
      onclick={handleGoogleClick}
      disabled={isLoading}
      aria-label={mode === "signin"
        ? "Sign in with Google"
        : "Sign up with Google"}
    >
      {#if isLoading}
        <ProgressRing percent={-1} size={24} strokeWidth={2} />
        Signing in...
      {:else}
        <GoogleIcon />
        Google
      {/if}
    </button>
    {#if FACEBOOK_LOGIN_ENABLED}
      <button
        class="social-compact-button social-compact-button--facebook"
        onclick={handleFacebookClick}
        aria-label={mode === "signin"
          ? "Sign in with Facebook"
          : "Sign up with Facebook"}
      >
        <FacebookIcon />
        Facebook
      </button>
    {/if}
  </div>
  {#if googleError}
    <p class="error-message" role="alert">{googleError}</p>
  {/if}
</div>

<style>
  .social-auth-compact {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(8px, 1.5vh, 12px);
    margin-top: clamp(2px, 0.5vh, 4px);
  }

  .social-compact-label {
    font-size: clamp(0.6875rem, 1.5vh, var(--font-size-compact));
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin: 0;
    font-weight: 500;
  }

  .social-compact-buttons {
    display: flex;
    gap: clamp(6px, 1vw, 10px);
    width: 100%;
    max-width: 400px;
  }

  .social-compact-button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1vw, 8px);
    min-height: clamp(36px, 5vh, var(--min-touch-target));
    padding: clamp(8px, 1.2vh, 10px) clamp(10px, 2vw, 16px);
    border-radius: clamp(6px, 1vh, 8px);
    font-size: clamp(0.75rem, 1.8vh, var(--font-size-sm));
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    border: none;
    box-shadow: 0 2px 6px var(--theme-shadow);
  }

  .social-compact-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .social-compact-button :global(svg) {
    flex-shrink: 0;
  }

  .social-compact-button--google {
    background: #ffffff;
    color: #111827;
  }

  .social-compact-button--google:hover:not(:disabled) {
    background: #f3f4f6;
    transform: translateY(-1px);
  }

  .social-compact-button--facebook {
    background: #1877f2;
    color: #ffffff;
  }

  .social-compact-button--facebook:hover:not(:disabled) {
    background: #166fe5;
    transform: translateY(-1px);
  }

  .error-message {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--semantic-error, var(--semantic-error));
  }

</style>
