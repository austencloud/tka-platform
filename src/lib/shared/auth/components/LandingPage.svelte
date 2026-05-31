<script lang="ts">
  /**
   * AuthGate (LandingPage.svelte)
   *
   * This is the AUTH GATE - shown by MainApplication when user is not authenticated.
   * NOT the marketing landing page (that's /routes/+page.svelte).
   *
   * This component:
   * - Respects user theme preferences (dynamic --theme-* variables)
   * - Provides sign-in/sign-up flow
   * - Has background toggle easter egg
   *
   * The marketing landing page:
   * - Lives at /routes/+page.svelte
   * - Uses fixed dark theme (static CSS variables in .landing-page)
   * - Is SEO-focused with feature sections
   * - Uses shared utilities from src/styles/landing-utilities.css
   */
  import { signInWithFacebook } from "$lib/shared/auth/services/authenticator";
  import { fly, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { onMount } from "svelte";
  import SocialAuthCompact from "./SocialAuthCompact.svelte";
  import EmailAuthTabs from "./EmailAuthTabs.svelte";
  import AuthFooter from "./AuthFooter.svelte";
  import GoogleOneTap from "./GoogleOneTap.svelte";
  import LegalSheet from "../../legal/components/LegalSheet.svelte";
  import { settingsService } from "../../settings/state/settings-state.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { applyThemeForBackground } from "../../settings/utils/background-theme-calculator";
  import { isGoogleOneTapConfigured } from "../config/google-oauth";

  let authMode = $state<"signin" | "signup">("signin");
  let showEmailAuth = $state(false);

  // Legal sheet state (lifted here so it renders outside backdrop-filter container)
  let sheetOpen = $state(false);
  let sheetType = $state<"terms" | "privacy">("terms");

  function openTerms() {
    sheetType = "terms";
    sheetOpen = true;
  }

  function openPrivacy() {
    sheetType = "privacy";
    sheetOpen = true;
  }

  function closeSheet() {
    sheetOpen = false;
  }

  // Background toggle state
  const backgrounds: { type: BackgroundType; icon: string; label: string }[] = [
    { type: BackgroundType.COSMIC, icon: "fa-moon", label: "Cosmic" },
    { type: BackgroundType.RAINBOW, icon: "fa-rainbow", label: "Rainbow" },
    { type: BackgroundType.OCEAN, icon: "fa-water", label: "Ocean" },
    { type: BackgroundType.WINTER, icon: "fa-snowflake", label: "Winter" },
    { type: BackgroundType.EMBER, icon: "fa-fire", label: "Ember" },
    { type: BackgroundType.BLOSSOM, icon: "fa-leaf", label: "Blossom" },
  ];
  let currentBgIndex = $state(0);

  onMount(async () => {
    // Find current background index and apply its theme
    const current = settingsService.currentSettings?.backgroundType;
    const idx = backgrounds.findIndex((b) => b.type === current);
    if (idx >= 0) {
      currentBgIndex = idx;
    }
    // Ensure theme is applied for current background
    if (current) {
      applyThemeForBackground(current);
    }
  });

  async function handleFacebookAuth() {
    try {
      await signInWithFacebook();
    } catch (error: any) {
      console.error("Facebook auth failed:", error);
    }
  }

  async function cycleBackground() {
    currentBgIndex = (currentBgIndex + 1) % backgrounds.length;
    const next = backgrounds[currentBgIndex];
    if (next) {
      await settingsService.updateSetting("backgroundType", next.type);
      applyThemeForBackground(next.type);
    }
  }
</script>

<div class="landing-page" in:fade={{ duration: 300 }}>
  <!-- Google One Tap container at top of page -->
  <div id="google-one-tap-container" class="one-tap-container"></div>

  <!-- Google One Tap - shows the One Tap prompt in the container above -->
  {#if isGoogleOneTapConfigured()}
    <GoogleOneTap autoPrompt={true} promptParentId="google-one-tap-container" />
  {/if}

  <div class="landing-content">
    <!-- Logo & Branding -->
    <header
      class="landing-header"
      in:fly={{ y: -20, duration: 400, delay: 100, easing: cubicOut }}
    >
      <div class="logo-container">
        <i class="fas fa-infinity logo-icon" aria-hidden="true"></i>
      </div>
      <h1>TKA Composer</h1>
      <p class="tagline">Notation for flow arts</p>
    </header>

    <!-- Auth Section -->
    <section
      class="auth-section"
      in:fly={{ y: 20, duration: 400, delay: 200, easing: cubicOut }}
    >
      {#if authMode === "signin"}
        <h2>Welcome back!</h2>
        <p class="auth-subtitle">Sign in to continue</p>
      {:else}
        <h2>Create your account</h2>
        <p class="auth-subtitle">Free to use. Save your creations.</p>
      {/if}

      <div class="auth-container">
        <SocialAuthCompact
          mode={authMode}
          onFacebookAuth={handleFacebookAuth}
        />

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

      <!-- Mode toggle -->
      <div class="mode-toggle">
        {#if authMode === "signin"}
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
        {:else}
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
        {/if}
      </div>
    </section>

    <!-- Footer -->
    <footer
      class="landing-footer"
      in:fly={{ y: 20, duration: 400, delay: 500, easing: cubicOut }}
    >
      <AuthFooter />
    </footer>
  </div>

  <!-- Legal Sheet - rendered OUTSIDE landing-content to avoid backdrop-filter containment -->
  <LegalSheet isOpen={sheetOpen} type={sheetType} onClose={closeSheet} />

  <!-- Background Toggle (Easter Egg) -->
  <button
    class="bg-toggle"
    onclick={cycleBackground}
    title="Change background: {backgrounds[currentBgIndex]?.label}"
    aria-label="Change background theme"
    in:fade={{ duration: 400, delay: 600 }}
  >
    <i class="fas {backgrounds[currentBgIndex]?.icon}" aria-hidden="true"></i>
  </button>
</div>

<style>
  /* Screen reader only - visually hidden but accessible */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Google One Tap container - positioned at top of viewport */
  .one-tap-container {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: var(--z-overlay);
  }

  .landing-page {
    --theme-transition: var(--duration-emphasis) ease-in-out;

    position: fixed;
    inset: 0;
    display: flex;
    align-items: safe center;
    justify-content: safe center;
    padding: clamp(12px, 2vh, 24px);
    overflow-y: auto;
    z-index: 100;
  }

  .landing-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(12px, 2vh, 24px);
    max-width: 520px;
    width: 100%;
    padding: clamp(16px, 2.5vh, 32px) clamp(16px, 3vw, 32px);
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid var(--theme-stroke);
    border-radius: clamp(16px, 2vw, 28px);
  }

  /* Header */
  .landing-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(4px, 1vh, 10px);
    text-align: center;
  }

  .logo-container {
    width: clamp(48px, 10vh, 80px);
    height: clamp(48px, 10vh, 80px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent-strong)) 12%,
      transparent
    );
    border-radius: clamp(12px, 2vh, 20px);
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 25%,
        transparent
      );
    transition:
      background var(--theme-transition),
      border-color var(--theme-transition);
  }

  .logo-icon {
    font-size: clamp(1.5rem, 5vh, var(--font-size-3xl));
    color: var(--theme-accent-strong, var(--theme-accent-strong));
    transition: color var(--theme-transition);
  }

  .landing-header h1 {
    margin: 0;
    font-size: clamp(1.5rem, 5vh, 2.5rem);
    font-weight: 700;
    color: var(--theme-text);
    letter-spacing: -0.03em;
  }

  .tagline {
    margin: 0;
    font-size: clamp(0.875rem, 2vh, 1.125rem);
    font-weight: 500;
    color: var(--theme-accent-strong, var(--theme-accent-strong));
    transition: color var(--theme-transition);
  }

  /* Auth Section */
  .auth-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(8px, 1.5vh, 14px);
    width: 100%;
    padding: clamp(14px, 2vh, 24px) clamp(14px, 2.5vw, 20px);
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent-strong)) 15%,
      rgba(255, 255, 255, 0.03)
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 25%,
        transparent
      );
    border-radius: clamp(12px, 1.5vh, 18px);
    transition:
      background var(--theme-transition),
      border-color var(--theme-transition);
  }

  .auth-section h2 {
    margin: 0;
    font-size: clamp(1rem, 2.5vh, 1.25rem);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .auth-subtitle {
    margin: 0;
    font-size: clamp(0.75rem, 1.8vh, 0.875rem);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .auth-container {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 1.5vh, 12px);
    width: 100%;
  }

  .email-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: clamp(10px, 1.5vh, 12px) 20px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent-strong)) 12%,
      rgba(255, 255, 255, 0.02)
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 20%,
        transparent
      );
    border-radius: clamp(10px, 1.5vh, 12px);
    color: var(--theme-text, var(--theme-text));
    font-size: clamp(0.8125rem, 1.8vh, 0.9375rem);
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--theme-transition),
      border-color var(--theme-transition),
      color var(--theme-transition);
  }

  .email-toggle:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong) 18%,
      rgba(255, 255, 255, 0.04)
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent-strong)) 30%,
      transparent
    );
    color: var(--theme-text, white);
  }

  .email-toggle i {
    font-size: clamp(0.875rem, 1.8vh, var(--font-size-base));
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    margin: clamp(2px, 0.5vh, 4px) 0;
  }

  .divider::before,
  .divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent-strong)) 20%,
      transparent
    );
    transition: background var(--theme-transition);
  }

  .divider span {
    font-size: clamp(0.6875rem, 1.5vh, 0.8125rem);
    color: var(--theme-text-dim);
  }

  .email-auth-wrapper {
    width: 100%;
  }

  /* Mode Toggle */
  .mode-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: clamp(4px, 1vh, 8px);
  }

  .mode-text {
    font-size: clamp(0.75rem, 1.8vh, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .mode-link {
    background: transparent;
    border: none;
    padding: 4px 8px;
    font-size: clamp(0.75rem, 1.8vh, 0.875rem);
    font-weight: 600;
    color: var(--theme-accent-strong, #8b5cf6);
    cursor: pointer;
    transition: color var(--duration-normal) ease;
  }

  .mode-link:hover {
    color: var(--theme-text, white);
    text-decoration: underline;
  }

  /* Footer */
  .landing-footer {
    opacity: 0.7;
  }

  /* Background Toggle Button */
  .bg-toggle {
    position: fixed;
    bottom: clamp(12px, 3vh, 24px);
    right: clamp(12px, 3vw, 24px);
    width: clamp(36px, 6vh, 44px);
    height: clamp(36px, 6vh, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent-strong)) 10%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 18%,
        transparent
      );
    border-radius: clamp(8px, 1.5vh, 12px);
    color: var(--theme-accent-strong, var(--theme-accent-strong));
    font-size: clamp(0.875rem, 2vh, var(--font-size-lg));
    cursor: pointer;
    transition:
      background var(--theme-transition),
      border-color var(--theme-transition),
      color var(--theme-transition),
      transform 200ms ease;
    z-index: 101;
  }

  .bg-toggle:hover {
    background: color-mix(in srgb, var(--theme-accent-strong) 20%, transparent);
    border-color: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent-strong)) 30%,
      transparent
    );
    transform: scale(1.05);
  }

  .bg-toggle:active {
    transform: scale(0.95);
  }

  @media (prefers-reduced-motion: reduce) {
    .logo-container,
    .logo-icon,
    .tagline,
    .auth-section,
    .email-toggle,
    .divider::before,
    .divider::after,
    .bg-toggle {
      transition: none;
    }
  }
</style>
