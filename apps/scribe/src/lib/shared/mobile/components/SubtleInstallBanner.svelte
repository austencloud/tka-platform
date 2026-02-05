<!--
  SubtleInstallBanner.svelte

  Tier 1: Subtle, non-blocking banner that slides in from top
  after user meets engagement thresholds.

  Features:
  - Minimalist design
  - Easy to dismiss
  - Shows only after meaningful engagement
  - Respects dismissal timing (7/30/90 days)
-->
<script lang="ts">
  import { container } from "../../di";
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import type { IMobileFullscreenManager } from "../services/contracts/IMobileFullscreenManager";
  import type { IPWAEngagementTracker } from "../services/contracts/IPWAEngagementTracker";
  import type { IPWAInstallDismissalManager } from "../services/contracts/IPWAInstallDismissalManager";

  // Services
  let fullscreenService: IMobileFullscreenManager | null = null;
  let engagementService: IPWAEngagementTracker | null = null;
  let dismissalService: IPWAInstallDismissalManager | null = null;

  // State
  let show = $state(false);
  let canInstallPWA = $state(false);
  let isPWA = $state(false);
  let isInstalling = $state(false);

  onMount(() => {
    try {
      fullscreenService = container.items.mobileFullscreenManager;
      engagementService = container.items.pwaEngagementTracker;
      dismissalService = container.items.pwaInstallDismissalManager;
    } catch (error) {
      console.warn("Failed to resolve PWA services:", error);
      return;
    }

    if (!fullscreenService || !engagementService || !dismissalService) {
      return;
    }

    // Check initial state
    isPWA = fullscreenService.isPWA();
    canInstallPWA = fullscreenService.canInstallPWA();

    // Don't show if already installed as PWA
    if (isPWA) {
      return;
    }

    // Check if we should show based on engagement and dismissal timing
    const hasEngagement = engagementService.shouldShowInstallPrompt();
    const canShowPrompt = dismissalService.canShowPrompt();

    if (hasEngagement && canShowPrompt) {
      // Delay banner appearance to avoid interrupting
      setTimeout(() => {
        show = true;
      }, 1500);
    }

    // Listen for install prompt availability
    const unsubscribe = fullscreenService.onInstallPromptAvailable(
      (available) => {
        canInstallPWA = available;
      }
    );

    // Listen for app installation
    const handleAppInstalled = () => {
      show = false;
      isPWA = true;
      dismissalService?.recordInstallation();
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      unsubscribe?.();
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  });

  async function handleInstall() {
    if (!fullscreenService || !canInstallPWA || isInstalling) {
      return;
    }

    isInstalling = true;

    try {
      const accepted = await fullscreenService.promptInstallPWA();
      if (accepted) {
        show = false;
        dismissalService?.recordInstallation();
      }
    } catch (error) {
      console.error("Failed to install PWA:", error);
    } finally {
      isInstalling = false;
    }
  }

  function handleDismiss() {
    show = false;
    dismissalService?.recordDismissal();
  }

  function handleOpenGuide() {
    // Dispatch event to open full install guide
    window.dispatchEvent(new CustomEvent("pwa:open-install-guide"));
    show = false;
  }
</script>

{#if show && !isPWA}
  <div class="subtle-banner" transition:slide={{ duration: 300 }}>
    <div class="banner-content">
      <span class="banner-icon">
        <i class="fas fa-mobile-alt" aria-hidden="true"></i>
      </span>
      <span class="banner-text"
        >Install for a distraction-free, fullscreen-like experience!</span
      >

      <div class="banner-actions">
        {#if canInstallPWA}
          <button
            class="install-btn"
            onclick={handleInstall}
            disabled={isInstalling}
          >
            <i class="fas fa-download" aria-hidden="true"></i>
            <span>{isInstalling ? "Installing..." : "Install"}</span>
          </button>
        {:else}
          <button class="learn-btn" onclick={handleOpenGuide}>
            <i class="fas fa-info-circle" aria-hidden="true"></i>
            <span>Learn How</span>
          </button>
        {/if}
        <button
          class="dismiss-btn"
          onclick={handleDismiss}
          aria-label="Dismiss"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .subtle-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 999;

    /* Glass morphism styling matching app design */
    background: rgba(26, 26, 46, 0.92);
    backdrop-filter: blur(20px) saturate(180%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow:
      0 4px 24px var(--theme-shadow),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset;

    padding: 14px 20px;
    animation: slideDown var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .banner-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 1200px;
    margin: 0 auto;
    gap: 16px;
  }

  .banner-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    border-radius: 10px;
    background: linear-gradient(
      135deg,
      color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent-strong)) 25%,
          transparent
        )
        0%,
      color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent-strong)) 25%,
          transparent
        )
        100%
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 30%,
        transparent
      );
    color: var(--theme-accent-strong, var(--theme-accent-strong));
    font-size: var(--font-size-lg);
    flex-shrink: 0;
  }

  .banner-text {
    flex: 1;
    font-size: var(--font-size-sm);
    font-weight: 500;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.95);
  }

  .banner-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .install-btn,
  .learn-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(
      135deg,
      color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent-strong)) 90%,
          transparent
        )
        0%,
      color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent-strong)) 90%,
          transparent
        )
        100%
    );
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 8px 16px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
    box-shadow: 0 2px 8px
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 30%,
        transparent
      );
  }

  .install-btn:hover,
  .learn-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 40%,
        transparent
      );
    background: var(--theme-accent-strong, var(--theme-accent-strong));
  }

  .install-btn:active,
  .learn-btn:active {
    transform: translateY(0);
    box-shadow: 0 1px 4px
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 30%,
        transparent
      );
  }

  .install-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .dismiss-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .dismiss-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.95);
  }

  .dismiss-btn:active {
    transform: scale(0.95);
  }

  @keyframes slideDown {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  /* Mobile optimizations */
  @media (max-width: 480px) {
    .subtle-banner {
      padding: 12px 16px;
    }

    /* Keep 50px minimum for accessibility */
    .banner-icon {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }

    .banner-text {
      font-size: var(--font-size-compact);
    }

    .install-btn,
    .learn-btn {
      padding: 7px 14px;
      font-size: var(--font-size-compact);
      gap: 5px;
      min-height: var(--min-touch-target);
    }

    .dismiss-btn {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
      font-size: var(--font-size-compact);
    }
  }

  /* Very small screens */
  @media (max-width: 360px) {
    .subtle-banner {
      padding: 10px 12px;
    }

    .banner-content {
      gap: 12px;
    }

    /* Keep 50px minimum for accessibility */
    .banner-icon {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
      font-size: var(--font-size-sm);
    }

    .banner-actions {
      gap: 8px;
    }

    .install-btn,
    .learn-btn {
      padding: 6px 12px;
      font-size: var(--font-size-compact);
      min-height: var(--min-touch-target);
    }

    .install-btn span,
    .learn-btn span {
      display: none; /* Hide text on very small screens, show icon only */
    }

    .dismiss-btn {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .subtle-banner {
      animation: none;
    }
  }
</style>
