<!--
  HeroInstallFlow.svelte

  Simplified install flow for the landing hero.
  Platform-specific handling:
  - Already installed → "Open App" message
  - In-app browser → Redirect modal with copy URL
  - Android → Play Store link
  - iOS Safari → "Add to Home Screen" expandable instructions
  - iOS non-Safari → Redirect to Safari modal
  - Desktop → "Open App" button (use browser)
-->
<script lang="ts">
  import { detectPlatformAndBrowser } from "$lib/shared/mobile/services/platform-detector";
  import { onMount } from "svelte";
  import type { Platform, InAppBrowser } from '$lib/shared/mobile/services/types';
import {  } from '$lib/shared/mobile/services/types';
  import { APP_DOMAIN } from "../../../config/domains";
  import InAppBrowserModal from "./InAppBrowserModal.svelte";
  import IOSInstallInstructions from "./IOSInstallInstructions.svelte";

  // Install state - simplified
  type InstallState =
    | "loading"
    | "installed"
    | "in-app-browser"
    | "ios-safari"
    | "ios-non-safari"
    | "android"
    | "desktop";

  let installState = $state<InstallState>("loading");
  let platform = $state<Platform>("desktop");
  let inAppBrowser = $state<InAppBrowser>("none");

  // UI states
  let showIOSInstructions = $state(false);
  let showInAppBrowserModal = $state(false);

  // Play Store URL
  const PLAY_STORE_URL =
    "https://play.google.com/store/apps/details?id=com.tkacomposer.app";

  onMount(async () => {
    const info = detectPlatformAndBrowser();

    platform = info.platform;
    inAppBrowser = info.inAppBrowser;

    // Check if already installed (standalone mode)
    const isStandaloneMedia = window.matchMedia(
      "(display-mode: standalone)"
    ).matches;
    const isFullscreenMedia = window.matchMedia(
      "(display-mode: fullscreen)"
    ).matches;
    const isInstalled =
      info.isStandalone ||
      isStandaloneMedia ||
      isFullscreenMedia ||
      (navigator as any).standalone;

    // Determine install state
    if (isInstalled) {
      installState = "installed";
    } else if (info.inAppBrowser !== "none") {
      installState = "in-app-browser";
    } else if (info.platform === "android") {
      installState = "android";
    } else if (info.platform === "ios" && info.browser === "safari") {
      installState = "ios-safari";
    } else if (info.platform === "ios") {
      installState = "ios-non-safari";
    } else {
      installState = "desktop";
    }
  });

  // Get display name for in-app browser
  const inAppBrowserNames: Record<InAppBrowser, string> = {
    instagram: "Instagram",
    facebook: "Facebook",
    twitter: "X",
    tiktok: "TikTok",
    snapchat: "Snapchat",
    linkedin: "LinkedIn",
    pinterest: "Pinterest",
    messenger: "Messenger",
    threads: "Threads",
    none: "",
  };

  const inAppBrowserName = $derived(
    inAppBrowserNames[inAppBrowser] || "this app"
  );
  const targetBrowser = $derived(platform === "ios" ? "Safari" : "Chrome");
</script>

<div class="install-flow">
  {#if installState === "loading"}
    <div class="cta-placeholder"></div>
  {:else if installState === "installed"}
    <!-- Already installed -->
    <div class="installed-container">
      <div class="installed-success">
        <i class="fas fa-check-circle" aria-hidden="true"></i>
        <span>App Installed!</span>
      </div>
      <p class="installed-instruction">
        Open <strong>TKA Composer</strong> from your home screen
      </p>
      <a href="/create" class="link-secondary"> Or continue in browser → </a>
    </div>
  {:else if installState === "in-app-browser"}
    <!-- In-app browser -->
    <button
      class="btn btn-primary"
      onclick={() => (showInAppBrowserModal = true)}
    >
      <i class="fas fa-external-link-alt" aria-hidden="true"></i>
      <span>Open in {targetBrowser}</span>
    </button>
    <p class="browser-note">
      <i class="fas fa-info-circle" aria-hidden="true"></i>
      {inAppBrowserName} browser doesn't support installation
    </p>
  {:else if installState === "android"}
    <!-- Android - Play Store -->
    <a
      href={PLAY_STORE_URL}
      class="btn btn-primary"
      target="_blank"
      rel="noopener"
    >
      <i class="fab fa-google-play" aria-hidden="true"></i>
      <span>Get TKA Composer</span>
    </a>
  {:else if installState === "ios-non-safari"}
    <!-- iOS but not Safari -->
    <button
      class="btn btn-primary"
      onclick={() => (showInAppBrowserModal = true)}
    >
      <i class="fab fa-safari" aria-hidden="true"></i>
      <span>Open in Safari</span>
    </button>
    <p class="browser-note">
      <i class="fas fa-info-circle" aria-hidden="true"></i>
      iOS requires Safari for installation
    </p>
  {:else if installState === "ios-safari"}
    <!-- iOS Safari - expandable instructions -->
    <IOSInstallInstructions
      bind:isExpanded={showIOSInstructions}
      onToggle={() => (showIOSInstructions = !showIOSInstructions)}
    />
    <a href="/create" class="link-secondary"> Or continue in browser → </a>
  {:else}
    <!-- Desktop - just open in browser -->
    <a href="/create" class="btn btn-primary">
      <i class="fas fa-play-circle" aria-hidden="true"></i>
      <span>Start exploring</span>
      <span class="arrow">→</span>
    </a>
  {/if}

  <a href="#features" class="btn btn-secondary">Learn More</a>
</div>

<!-- In-app browser / Non-Safari modal -->
<InAppBrowserModal
  bind:isOpen={showInAppBrowserModal}
  {platform}
  inAppBrowserName={inAppBrowser !== "none" ? inAppBrowserName : ""}
  onClose={() => (showInAppBrowserModal = false)}
/>

<style>
  .install-flow {
    display: flex;
    gap: 16px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 48px;
  }

  .cta-placeholder {
    height: 52px;
    width: 200px;
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 28px;
    border-radius: 12px;
    font-weight: 600;
    font-size: var(--font-size-base, 1rem);
    text-decoration: none;
    transition: all var(--duration-normal) ease;
    cursor: pointer;
    border: none;
  }

  .btn-primary {
    background: var(--primary, #6366f1);
    color: white;
  }

  .btn-primary:hover {
    background: var(--primary-light, #818cf8);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.3);
  }

  .btn-secondary {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
    border: 1.5px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    backdrop-filter: blur(8px);
  }

  .btn-secondary:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.12));
    border-color: var(--theme-accent, #6366f1);
  }

  .arrow {
    transition: transform var(--duration-normal) ease;
  }

  .btn:hover .arrow {
    transform: translateX(4px);
  }

  .link-secondary {
    display: block;
    width: 100%;
    text-align: center;
    color: var(--text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 0.875rem);
    text-decoration: none;
    margin-top: -8px;
    transition: color var(--duration-normal) ease;
  }

  .link-secondary:hover {
    color: var(--text, white);
  }

  /* Notes */
  .browser-note {
    width: 100%;
    text-align: center;
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--text-muted, rgba(255, 255, 255, 0.6));
    margin-top: -8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  /* Installed state */
  .installed-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .installed-success {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 28px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border-radius: 12px;
    font-weight: 600;
    font-size: var(--font-size-lg, 1.125rem);
  }

  .installed-instruction {
    color: var(--text, white);
    font-size: var(--font-size-base, 1rem);
    margin: 0;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .install-flow {
      flex-direction: column;
      align-items: center;
    }

    .btn {
      width: 100%;
      max-width: 300px;
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .btn,
    .arrow {
      transition: none;
    }
  }
</style>
