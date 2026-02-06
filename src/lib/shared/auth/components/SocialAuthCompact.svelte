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
  import { goto } from "$app/navigation";
  import {
    GoogleAuthProvider,
    browserLocalPersistence,
    indexedDBLocalPersistence,
    setPersistence,
    signInWithPopup,
  } from "firebase/auth";
  import { auth } from "../firebase";

  let { mode = "signin", onFacebookAuth } = $props<{
    mode: "signin" | "signup";
    onFacebookAuth: () => void;
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
      // Set persistence for reliable auth state
      try {
        await setPersistence(auth, indexedDBLocalPersistence);
      } catch {
        await setPersistence(auth, browserLocalPersistence);
      }

      const provider = new GoogleAuthProvider();
      provider.addScope("email");
      provider.addScope("profile");

      // Use popup for all devices - redirect flow has never worked
      await signInWithPopup(auth, provider);
      await goto("/");
    } catch (error: unknown) {
      const errorCode = (error as { code?: string })?.code;

      // Provide user-friendly error messages
      if (errorCode === "auth/popup-blocked") {
        googleError = "Popup was blocked. Please allow popups for this site.";
      } else if (errorCode === "auth/popup-closed-by-user") {
        googleError = "Sign-in cancelled. Please try again.";
      } else if (errorCode === "auth/cancelled-popup-request") {
        googleError = null; // Silent - user just clicked away
      } else if (errorCode === "auth/account-exists-with-different-credential") {
        googleError = "An account already exists with this email using a different sign-in method.";
      } else {
        googleError = error instanceof Error ? error.message : "Google sign-in failed. Please try again.";
      }
    } finally {
      isLoading = false;
    }
  }

  function handleFacebookClick() {
    onFacebookAuth();
  }
</script>

<div class="social-auth-compact">
  <p class="social-compact-label">
    {mode === "signin" ? "Sign in with" : "Or sign up with"}
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
        <span class="spinner"></span>
        Signing in...
      {:else}
        <GoogleIcon />
        Google
      {/if}
    </button>
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

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(0, 0, 0, 0.2);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
