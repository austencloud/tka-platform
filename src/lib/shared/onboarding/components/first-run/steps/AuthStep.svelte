<!--
  AuthStep - Final step of onboarding: create account to save preferences

  Presents auth options (Google, Facebook, Email) with messaging that
  emphasizes saving the preferences they just configured.
-->
<script lang="ts">
  import { signInWithFacebook } from "$lib/shared/auth/services/authenticator";
  import { fly, fade } from "svelte/transition";
  import SocialAuthCompact from "$lib/shared/auth/components/SocialAuthCompact.svelte";
  import EmailAuthTabs from "$lib/shared/auth/components/EmailAuthTabs.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { onMount } from "svelte";

  interface Props {
    onComplete: () => void;
    onBack: () => void;
  }

  const { onComplete, onBack }: Props = $props();

  let authMode = $state<"signin" | "signup">("signup");
  let showEmailAuth = $state(false);

  // Watch for authentication to complete
  const isAuthenticated = $derived(authState.isAuthenticated);

  onMount(() => {});

  // When user authenticates, complete the wizard
  $effect(() => {
    if (isAuthenticated) {
      onComplete();
    }
  });

  async function handleFacebookAuth() {
    try {
      await signInWithFacebook();
    } catch (error: any) {
      console.error("Facebook auth failed:", error);
    }
  }
</script>

<div class="auth-step" in:fade={{ duration: 200 }}>
  <div class="icon-container">
    <i class="fas fa-user-plus" aria-hidden="true"></i>
  </div>

  <h1 class="title">Almost done!</h1>
  <p class="subtitle">Create an account to save your preferences</p>

  <div class="benefits">
    <div class="benefit">
      <i class="fas fa-check" aria-hidden="true"></i>
      <span>Your theme and prop choices saved</span>
    </div>
    <div class="benefit">
      <i class="fas fa-check" aria-hidden="true"></i>
      <span>Create and save sequences</span>
    </div>
    <div class="benefit">
      <i class="fas fa-check" aria-hidden="true"></i>
      <span>Join the flow arts community</span>
    </div>
  </div>

  <div class="auth-container">
    <SocialAuthCompact mode={authMode} onFacebookAuth={handleFacebookAuth} />

    {#if !showEmailAuth}
      <button class="email-toggle" onclick={() => (showEmailAuth = true)}>
        <i class="fas fa-envelope" aria-hidden="true"></i>
        <span>Continue with email</span>
      </button>
    {:else}
      <div class="divider">
        <span>or use email</span>
      </div>
      <div class="email-auth-wrapper" in:fly={{ y: 10, duration: 200 }}>
        <EmailAuthTabs bind:mode={authMode} />
      </div>
    {/if}
  </div>

  <div class="button-row">
    <button
      type="button"
      class="back-button"
      onclick={onBack}
      aria-label="Go back"
    >
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
    </button>
  </div>
</div>

<style>
  .auth-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    max-width: 480px;
    width: 100%;
    text-align: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .icon-container {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 15%,
      transparent
    );
    border-radius: 18px;
    font-size: 1.5rem;
    color: var(--theme-accent-strong, #8b5cf6);
  }

  .title {
    font-size: 1.4rem;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .benefits {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    padding: 16px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 8%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 20%, transparent);
    border-radius: 14px;
    margin: 8px 0;
  }

  .benefit {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.9rem;
    color: var(--theme-text, white);
    text-align: left;
  }

  .benefit i {
    color: #22c55e;
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .auth-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .email-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 12px 20px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 12%,
      rgba(255, 255, 255, 0.02)
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 20%, transparent);
    border-radius: 12px;
    color: var(--theme-text, white);
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .email-toggle:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 18%,
      rgba(255, 255, 255, 0.04)
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 30%,
      transparent
    );
  }

  .email-toggle i {
    font-size: 1rem;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    margin: 4px 0;
  }

  .divider::before,
  .divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 20%,
      transparent
    );
  }

  .divider span {
    font-size: 0.8125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .email-auth-wrapper {
    width: 100%;
  }

  .button-row {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 1rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .back-button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }

  /* Mobile */
  @media (max-width: 480px) {
    .auth-step {
      padding: 16px;
    }

    .icon-container {
      width: 56px;
      height: 56px;
      font-size: 1.3rem;
    }

    .title {
      font-size: 1.25rem;
    }

    .benefits {
      padding: 12px;
    }

    .benefit {
      font-size: 0.85rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .back-button,
    .email-toggle {
      transition: none;
    }
  }
</style>
