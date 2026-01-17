<script lang="ts">
  /**
   * Login Page
   *
   * Provides social authentication options for users.
   * Note: OAuth redirect results are handled centrally by authState.initializeAuthListener()
   * in the root layout. This page just reacts to auth state changes.
   */

  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import SocialAuthButton from "$lib/shared/auth/components/SocialAuthButton.svelte";
  import EmailPasswordAuth from "$lib/shared/auth/components/EmailPasswordAuth.svelte";
  import EmailLinkAuth from "$lib/shared/auth/components/EmailLinkAuth.svelte";
  import GoogleOneTap from "$lib/shared/auth/components/GoogleOneTap.svelte";
  import { isGoogleOneTapConfigured } from "$lib/shared/auth/config/google-oauth";
  import LegalSheet from "$lib/shared/legal/components/LegalSheet.svelte";

  let emailAuthMode: "password" | "link" = $state("link"); // Default to passwordless
  let hasRedirected = $state(false);

  // Legal sheet state
  let sheetOpen = $state(false);
  let sheetType = $state<"terms" | "privacy">("terms");
  const MOBILE_BREAKPOINT = 768;

  function handleTermsClick(e: MouseEvent) {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      e.preventDefault();
      sheetType = "terms";
      sheetOpen = true;
    }
  }

  function handlePrivacyClick(e: MouseEvent) {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      e.preventDefault();
      sheetType = "privacy";
      sheetOpen = true;
    }
  }

  function closeSheet() {
    sheetOpen = false;
  }

  onMount(() => {
    // Clear any stale auth attempt markers
    try {
      localStorage.removeItem("tka_auth_attempt");
      sessionStorage.removeItem("tka_auth_attempt");
    } catch {
      // Ignore storage errors
    }
  });

  // Redirect when auth state changes (handles both direct login and OAuth redirects)
  // OAuth redirect results are processed by authState.initializeAuthListener() in the root layout
  $effect(() => {
    if (authState.isAuthenticated && authState.initialized && !hasRedirected) {
      hasRedirected = true;
      goto("/");
    }
  });
</script>

<svelte:head>
  <title>Login - TKA</title>
</svelte:head>

<div class="login-container">
  <!-- Google One Tap - shows the one-tap prompt automatically -->
  <!-- Let Google decide positioning: bottom sheet on mobile, corner popup on desktop -->
  {#if isGoogleOneTapConfigured()}
    <GoogleOneTap autoPrompt={true} />
  {/if}

  <div class="login-card">
    <div class="login-header">
      <h1>Welcome to TKA</h1>
      <p>Sign in to continue</p>
    </div>

    {#if !authState.initialized}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>
    {:else}
      <div class="social-buttons">
        <SocialAuthButton provider="facebook">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
            />
          </svg>
          Continue with Facebook
        </SocialAuthButton>

        <!-- Optional: Add Google login -->
        <SocialAuthButton provider="google">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </SocialAuthButton>
      </div>

      <div class="divider">
        <span>or</span>
      </div>

      <!-- Toggle between passwordless and password-based auth -->
      <div class="auth-mode-toggle">
        <button
          type="button"
          class:active={emailAuthMode === "link"}
          onclick={() => (emailAuthMode = "link")}
        >
          Magic Link
        </button>
        <button
          type="button"
          class:active={emailAuthMode === "password"}
          onclick={() => (emailAuthMode = "password")}
        >
          Password
        </button>
      </div>

      {#if emailAuthMode === "link"}
        <EmailLinkAuth />
      {:else}
        <EmailPasswordAuth />
      {/if}

      <div class="login-footer">
        <p>
          By continuing, you agree to our
          <a href="/terms" onclick={handleTermsClick}>Terms of Service</a> and
          <a href="/privacy" onclick={handlePrivacyClick}>Privacy Policy</a>
        </p>
      </div>
    {/if}
  </div>
</div>

<LegalSheet isOpen={sheetOpen} type={sheetType} onClose={closeSheet} />

<style>
  .login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: var(
      --gradient-cosmic,
      linear-gradient(135deg, #667eea 0%, #764ba2 100%)
    );
  }

  .login-card {
    background: var(--theme-panel-elevated-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 1rem;
    padding: 2rem;
    width: 100%;
    max-width: 400px;
    box-shadow: var(--theme-panel-shadow, 0 20px 60px var(--theme-shadow));
  }

  .login-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .login-header h1 {
    font-size: 1.875rem;
    font-weight: 700;
    color: var(--theme-text);
    margin: 0 0 0.5rem 0;
  }

  .login-header p {
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin: 0;
    font-size: 1rem;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    gap: 1rem;
  }

  .loading-state .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent)) 20%,
        transparent
      );
    border-top-color: var(--theme-accent, var(--theme-accent));
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-state p {
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: 0.95rem;
    margin: 0;
  }

  .social-buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .divider {
    display: flex;
    align-items: center;
    text-align: center;
    margin: 1.5rem 0;
  }

  .divider::before,
  .divider::after {
    content: "";
    flex: 1;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .divider span {
    padding: 0 1rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: 0.875rem;
  }

  .auth-mode-toggle {
    display: flex;
    gap: 0.5rem;
    background: var(--theme-card-bg);
    padding: 0.25rem;
    border-radius: 0.5rem;
  }

  .auth-mode-toggle button {
    flex: 1;
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .auth-mode-toggle button:hover {
    color: var(--theme-text);
  }

  .auth-mode-toggle button.active {
    background: var(--theme-panel-elevated-bg);
    color: var(--theme-text);
    box-shadow: 0 1px 3px
      color-mix(in srgb, var(--theme-shadow) 25%, transparent);
  }

  .login-footer {
    margin-top: 2rem;
    text-align: center;
  }

  .login-footer p {
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: 0.75rem;
    margin: 0;
    line-height: 1.5;
  }

  .login-footer a {
    color: var(--theme-accent, var(--semantic-info));
    text-decoration: none;
  }

  .login-footer a:hover {
    text-decoration: underline;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .login-card {
      padding: 1.5rem;
    }

    .login-header h1 {
      font-size: 1.5rem;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
