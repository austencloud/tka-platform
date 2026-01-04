<script lang="ts">
  /**
   * SocialAuthButton
   *
   * Branded social auth button wrapper using popup authentication.
   * For Google, cancels any pending One Tap prompt to prevent race conditions.
   *
   * Note: Google One Tap is handled separately by GoogleOneTap.svelte
   * which auto-prompts on page load. This button is the manual fallback.
   */

  import { goto } from "$app/navigation";
  import {
    browserLocalPersistence,
    FacebookAuthProvider,
    GithubAuthProvider,
    GoogleAuthProvider,
    indexedDBLocalPersistence,
    setPersistence,
    signInWithPopup,
    TwitterAuthProvider,
  } from "firebase/auth";
  import { auth } from "../firebase";

  let {
    provider,
    class: className = "",
    children,
  }: {
    provider: "facebook" | "google" | "github" | "twitter";
    class?: string;
    children: import("svelte").Snippet;
  } = $props();

  let loading = $state(false);
  let error = $state<string | null>(null);

  function getProvider() {
    switch (provider) {
      case "google":
        return new GoogleAuthProvider();
      case "facebook":
        return new FacebookAuthProvider();
      case "github":
        return new GithubAuthProvider();
      case "twitter":
        return new TwitterAuthProvider();
    }
  }

  async function handleClick() {
    if (loading) return;
    loading = true;
    error = null;

    // Cancel any pending One Tap prompt to prevent race conditions
    // This avoids the AbortError when popup succeeds while One Tap is still initializing
    if (provider === "google") {
      window.google?.accounts?.id?.cancel();
    }

    await handlePopupAuth();
  }

  async function handlePopupAuth() {
    try {
      try {
        await setPersistence(auth, indexedDBLocalPersistence);
      } catch {
        await setPersistence(auth, browserLocalPersistence);
      }

      const authProvider = getProvider();

      // Use popup for all devices - redirect flow has never worked
      await signInWithPopup(auth, authProvider);
      await goto("/app");
    } catch (e: unknown) {
      const errorCode = (e as { code?: string })?.code;
      console.error("[SocialAuthButton] Sign-in error:", errorCode, e);

      // Provide user-friendly error messages
      if (errorCode === "auth/popup-blocked") {
        error = "Popup was blocked. Please allow popups for this site.";
      } else if (errorCode === "auth/popup-closed-by-user") {
        error = "Sign-in cancelled. Please try again.";
      } else if (errorCode === "auth/cancelled-popup-request") {
        error = null; // Silent - user just clicked away
      } else if (errorCode === "auth/account-exists-with-different-credential") {
        error = "An account already exists with this email using a different sign-in method.";
      } else {
        error = e instanceof Error ? e.message : "Sign-in failed. Please try again.";
      }
    } finally {
      loading = false;
    }
  }
</script>

<div class="social-auth-button {className}">
  <button type="button" class="btn" onclick={handleClick} disabled={loading}>
    {@render children()}
  </button>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
</div>

<style>
  .social-auth-button {
    width: 100%;
  }

  .btn {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: var(--min-touch-target);
    padding: 12px 16px;
    border-radius: 10px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg, var(--theme-card-bg));
    color: var(--theme-text);
    font-weight: 700;
    cursor: pointer;
    transition:
      transform 0.15s ease,
      background 0.15s ease;
  }

  .btn:hover:not(:disabled) {
    transform: translateY(-1px);
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .error {
    margin: 10px 0 0;
    font-size: var(--font-size-compact);
    color: var(--semantic-error, var(--semantic-error));
  }
</style>
