<script lang="ts">
  // Import vendor-prefixed types
  import "../types/vendor-prefixed";
  import type { IHapticFeedback } from "../application/services/contracts/IHapticFeedback";
  import type { IMobileFullscreenManager } from "../mobile/services/contracts/IMobileFullscreenManager";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  let isFullscreen = $state(false);
  let isSupported = $state(false);
  let isPWA = $state(false);

  // Services
  let hapticService: IHapticFeedback;
  let fullscreenService: IMobileFullscreenManager;

  // Check if fullscreen is supported and if running as PWA
  onMount(() => {
    hapticService = container.items.hapticFeedback;
    fullscreenService = container.items.mobileFullscreenManager;

    // Check if running as PWA - if so, don't show the button
    isPWA = fullscreenService.isPWA();

    isSupported = !!(
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled
    );

    // Listen for fullscreen changes
    const handleFullscreenChange = () => {
      isFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange
      );
    };
  });

  async function toggleFullscreen() {
    try {
      if (isFullscreen) {
        // Trigger subtle navigation haptic for exiting fullscreen
        hapticService?.trigger("selection");

        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      } else {
        // Trigger selection haptic for entering fullscreen
        hapticService?.trigger("selection");

        // Enter fullscreen
        const element = document.documentElement;
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
          await element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen();
        }
      }
    } catch (error) {
      console.warn("Fullscreen toggle failed:", error);
    }
  }
</script>

<!-- Only show button if:
     1. Fullscreen API is supported
     2. NOT running as a PWA (PWAs are already fullscreen)
-->
{#if isSupported && !isPWA}
  <button
    class="fullscreen-button"
    onclick={toggleFullscreen}
    aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
    title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
  >
    {#if isFullscreen}
      <!-- Exit fullscreen icon -->
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
        />
      </svg>
    {:else}
      <!-- Enter fullscreen icon -->
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
        />
      </svg>
    {/if}
  </button>
{/if}

<style>
  .fullscreen-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    color: #ffffff;

    /* Professional glass styling matching ButtonPanel and UndoButton */
    background: rgba(100, 116, 139, 0.8);
    border: 1px solid rgba(148, 163, 184, 0.3);
    box-shadow: 0 2px 8px var(--theme-shadow);
    z-index: 99; /* Same as other workbench buttons */
  }

  .fullscreen-button:hover {
    transform: scale(1.05);
    background: rgba(100, 116, 139, 0.9);
    border-color: rgba(148, 163, 184, 0.4);
    box-shadow: 0 4px 12px var(--theme-shadow);
  }

  .fullscreen-button:active {
    transform: scale(0.95);
    transition: all 0.1s ease;
  }

  .fullscreen-button:focus-visible {
    outline: 2px solid #818cf8;
    outline-offset: 2px;
  }

  /* Desktop: Left panel is on left side, empty space is bottom-left */
  @media (min-width: 768px) {
    .fullscreen-button {
      bottom: 16px;
      left: 16px;
    }
  }

  /* Mobile: Left panel is on top, empty space is top-right */
  @media (max-width: 699px) {
    .fullscreen-button {
      top: 16px;
      right: 16px;
    }
  }

  /* Mobile responsive adjustments */
  @media (max-width: 768px) {
    .fullscreen-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
    }
  }

  @media (max-width: 480px) {
    .fullscreen-button {
      top: 12px;
      right: 12px;
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
    }
  }

  /* Z Fold 6 cover screen optimization */
  @media (max-width: 320px) {
    .fullscreen-button {
      top: 8px;
      right: 8px;
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
    }
  }
</style>
