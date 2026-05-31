<!--
  AuthDrawer.svelte - Authentication Drawer Overlay

  Slides in when a guest taps "Create Account" from an AuthNudge.
  Contains a tier progression display and existing auth form components.

  - Desktop: slides in from right, width min(420px, 90vw)
  - Mobile (<768px): slides up from bottom, full width, max-height 85vh
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import GoogleOneTap from "./GoogleOneTap.svelte";
  import SocialAuthCompact from "./SocialAuthCompact.svelte";
  import EmailAuthTabs from "./EmailAuthTabs.svelte";
  import { ACCESS_TIER_LABELS } from "../domain/access-tier";

  interface Props {
    open: boolean;
    initialMode?: "signin" | "signup";
    onClose: () => void;
  }

  let { open, initialMode = "signup", onClose }: Props = $props();

  // Detect mobile via matchMedia so the drawer placement switches correctly.
  // This reactive derivation reads window width on mount and on resize.
  let isMobile = $state(false);

  $effect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    isMobile = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      isMobile = e.matches;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });

  // Local bindable that the Drawer component controls.
  let isOpen = $state(false);

  // Keep local state in sync with the external prop.
  $effect(() => {
    isOpen = open;
  });

  // Propagate Drawer-initiated closes (backdrop click, escape key) back to caller.
  function handleClose() {
    onClose();
  }

  let authMode = $state<"signin" | "signup">("signup");
  let showEmailAuth = $state(false);

  // Sync authMode when drawer opens with a specific initial mode
  $effect(() => {
    if (open) {
      authMode = initialMode;
      showEmailAuth = false;
    }
  });

  // Tier progression data derived from domain constants
  const tiers: Array<{ key: keyof typeof ACCESS_TIER_LABELS; subtitle: string; isCurrent?: boolean }> = [
    { key: "guest", subtitle: "You're here", isCurrent: true },
    { key: "user", subtitle: "Free" },
    { key: "premium", subtitle: "Coming soon" },
  ];

  function handleFacebookAuth() {
    // Facebook auth is handled inside SocialAuthCompact; this satisfies the prop.
  }
</script>

<Drawer
  bind:isOpen
  placement={isMobile ? "bottom" : "right"}
  class="auth-drawer"
  ariaLabel="Create account"
  closeOnBackdrop
  closeOnEscape
  showHandle={isMobile}
  onclose={handleClose}
>
  <div class="auth-drawer-content">
    <!-- Close button -->
    <button class="close-btn" onclick={onClose} aria-label="Close">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>

    <!-- Tier progression -->
    <div class="tier-progression" aria-label="Account tiers">
      {#each tiers as tier, i}
        <div class="tier" class:current={tier.isCurrent} class:future={tier.key === "premium"}>
          <span class="tier-name">{ACCESS_TIER_LABELS[tier.key]}</span>
          <span class="tier-subtitle">{tier.subtitle}</span>
        </div>
        {#if i < tiers.length - 1}
          <div class="tier-arrow" aria-hidden="true">
            <i class="fas fa-chevron-right"></i>
          </div>
        {/if}
      {/each}
    </div>

    <!-- Heading -->
    <div class="auth-heading">
      {#if authMode === "signup"}
        <h2>Create your account</h2>
        <p class="auth-subtitle">Free to use. Save your creations.</p>
      {:else}
        <h2>Welcome back</h2>
        <p class="auth-subtitle">Sign in to continue</p>
      {/if}
    </div>

    <!-- Google One Tap (renders its own prompt UI) -->
    <GoogleOneTap autoPrompt={open} />

    <!-- Social auth buttons -->
    <SocialAuthCompact mode={authMode} onFacebookAuth={handleFacebookAuth} />

    <!-- Email auth toggle -->
    {#if !showEmailAuth}
      <button class="email-toggle" onclick={() => (showEmailAuth = true)}>
        <i class="fas fa-envelope" aria-hidden="true"></i>
        <span>Continue with email</span>
      </button>
    {:else}
      <div class="divider"><span>or use email</span></div>
      <div class="email-auth-wrapper">
        <EmailAuthTabs bind:mode={authMode} />
      </div>
    {/if}

    <!-- Mode toggle -->
    <div class="mode-toggle">
      {#if authMode === "signup"}
        <span class="mode-text">Already have an account?</span>
        <button
          class="mode-link"
          onclick={() => {
            authMode = "signin";
            showEmailAuth = false;
          }}
        >
          Sign in
        </button>
      {:else}
        <span class="mode-text">New here?</span>
        <button
          class="mode-link"
          onclick={() => {
            authMode = "signup";
            showEmailAuth = false;
          }}
        >
          Create an account
        </button>
      {/if}
    </div>
  </div>
</Drawer>

<style>
  /* Override drawer width for desktop (right placement) */
  :global(.auth-drawer[data-placement="right"]) {
    width: min(420px, 90vw);
  }

  /* Mobile: bottom sheet, capped height with rounded top corners */
  :global(.auth-drawer[data-placement="bottom"]) {
    max-height: 85vh;
    border-radius: var(--radius-lg, 16px) var(--radius-lg, 16px) 0 0;
  }

  .auth-drawer-content {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.5rem 1.5rem 2rem;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    min-height: 100%;
    position: relative;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  /* Close button */
  .close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    color: var(--theme-text, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    font-size: 1rem;
    padding: 0.375rem;
    border-radius: var(--radius-sm, 6px);
    line-height: 1;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .close-btn:hover {
    color: var(--theme-text, #fff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
  }

  /* Tier progression row */
  .tier-progression {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 10px);
    margin-top: 1.5rem; /* space below close button */
  }

  .tier {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    flex: 1;
  }

  .tier-name {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, rgba(255, 255, 255, 0.5));
    line-height: 1.2;
  }

  .tier-subtitle {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, rgba(255, 255, 255, 0.4));
    line-height: 1.2;
  }

  .tier.current .tier-name {
    color: var(--theme-accent, #7c6af7);
  }

  .tier.current .tier-subtitle {
    color: var(--theme-accent, #7c6af7);
    opacity: 0.8;
  }

  .tier.future .tier-name,
  .tier.future .tier-subtitle {
    opacity: 0.35;
  }

  .tier-arrow {
    color: var(--theme-text, rgba(255, 255, 255, 0.3));
    font-size: 0.625rem;
    flex-shrink: 0;
  }

  /* Auth heading */
  .auth-heading {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .auth-heading h2 {
    font-size: var(--font-size-lg, 20px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    margin: 0;
    line-height: 1.2;
  }

  .auth-subtitle {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, rgba(255, 255, 255, 0.55));
    margin: 0;
  }

  /* Email toggle button */
  .email-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.625rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 10px);
    color: var(--theme-text, rgba(255, 255, 255, 0.75));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .email-toggle:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.09));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
  }

  /* Divider between social and email */
  .divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--theme-text, rgba(255, 255, 255, 0.3));
    font-size: var(--font-size-compact, 12px);
  }

  .divider::before,
  .divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .email-auth-wrapper {
    display: flex;
    flex-direction: column;
  }

  /* Mode toggle */
  .mode-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    font-size: var(--font-size-compact, 12px);
    margin-top: auto;
    padding-top: 0.5rem;
  }

  .mode-text {
    color: var(--theme-text, rgba(255, 255, 255, 0.45));
  }

  .mode-link {
    background: none;
    border: none;
    color: var(--theme-accent, #7c6af7);
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .mode-link:hover {
    opacity: 0.8;
  }

  @media (max-width: 768px) {
    .auth-drawer-content {
      padding: 1.25rem 1.25rem 1.75rem;
    }
  }
</style>
