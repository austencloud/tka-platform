<!--
  HelpButtonDiscovery.svelte - First-time attention grabber for help button

  Shows a cute animated overlay pointing to the help button on first visit.
  Responsive positioning:
  - Desktop (>= 1024px): Points to top-right of generator panel
  - Mobile (< 1024px): Points to bottom-right of ButtonPanel

  Features:
  - Pulsing ring animation around the button
  - Friendly speech bubble with helpful text
  - Dismisses on click/tap anywhere or pressing the help button
  - Persists dismissal to localStorage
  - Respects reduced motion preferences
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { elasticOut } from "svelte/easing";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";

  interface Props {
    /** Button size (same for both layouts) */
    buttonSize?: number;
    /** Desktop position: distance from top */
    desktopTop?: number;
    /** Desktop position: distance from right */
    desktopRight?: number;
    /** Mobile position: distance from bottom */
    mobileBottom?: number;
    /** Mobile position: distance from right */
    mobileRight?: number;
    onDismiss?: () => void;
  }

  const {
    buttonSize = 44,
    desktopTop = 12,
    desktopRight = 12,
    mobileBottom = 20,
    mobileRight = 20,
    onDismiss,
  }: Props = $props();

  const STORAGE_KEY = "helpButtonDiscoverySeen:generate";
  const DESKTOP_BREAKPOINT = 1024;

  let isVisible = $state(false);
  let hasCheckedStorage = $state(false);
  let hapticService: HapticFeedback | null = $state(null);
  let isDesktop = $state(false);

  // Update isDesktop based on viewport
  function updateIsDesktop() {
    isDesktop = window.innerWidth >= DESKTOP_BREAKPOINT;
  }

  onMount(() => {
    try {
      hapticService = getHapticFeedback();
    } catch {
      /* Optional */
    }

    // Initialize desktop detection
    updateIsDesktop();
    window.addEventListener("resize", updateIsDesktop);

    // Check if user has seen this before
    checkAndShowIfNeeded();
    hasCheckedStorage = true;

    // Listen for storage changes (e.g., admin reset from another component)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue === null) {
        // Key was removed, show again
        checkAndShowIfNeeded();
      }
    };

    // Also listen for custom event from admin toolbar (same-tab reset)
    const handleReset = () => {
      checkAndShowIfNeeded();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("helpDiscoveryReset", handleReset);

    return () => {
      window.removeEventListener("resize", updateIsDesktop);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("helpDiscoveryReset", handleReset);
    };
  });

  function checkAndShowIfNeeded() {
    if (typeof localStorage !== "undefined") {
      const hasSeen = localStorage.getItem(STORAGE_KEY) === "true";
      if (!hasSeen && !isVisible) {
        // Small delay for smoother entrance after panel renders
        setTimeout(() => {
          isVisible = true;
        }, 400);
      }
    }
  }

  function dismiss() {
    hapticService?.trigger("selection");
    isVisible = false;

    // Persist dismissal
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }

    onDismiss?.();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      dismiss();
    }
  }
</script>

{#if isVisible}
  <!-- Clickable backdrop to dismiss -->
  <button
    class="discovery-backdrop"
    onclick={dismiss}
    onkeydown={handleKeydown}
    aria-label="Dismiss help button hint"
    transition:fade={{ duration: 200 }}
  >
    {#if isDesktop}
      <!-- DESKTOP: Top-right positioning, bubble BELOW button -->
      <div
        class="pulse-container"
        style="top: {desktopTop}px; right: {desktopRight}px; width: {buttonSize}px; height: {buttonSize}px;"
      >
        <div class="pulse-ring pulse-ring-1"></div>
        <div class="pulse-ring pulse-ring-2"></div>
        <div class="pulse-ring pulse-ring-3"></div>
        <div class="glow-dot"></div>
      </div>

      <div
        class="speech-bubble speech-bubble-desktop"
        style="top: {desktopTop + buttonSize + 16}px; right: {desktopRight}px;"
        transition:fly={{ y: -10, duration: 400, delay: 200, easing: elasticOut }}
      >
        <div class="bubble-pointer bubble-pointer-top"></div>
        <div class="bubble-content">
          <i class="fas fa-lightbulb bubble-icon" aria-hidden="true"></i>
          <div class="bubble-text">
            <span class="bubble-title">Feeling overwhelmed?</span>
            <span class="bubble-hint">Click the <strong>?</strong> button to learn what each setting does</span>
          </div>
        </div>
        <div class="tap-hint">
          <span>Click anywhere to dismiss</span>
        </div>
      </div>
    {:else}
      <!-- MOBILE: Bottom-right positioning, bubble ABOVE button -->
      <div
        class="pulse-container"
        style="bottom: {mobileBottom}px; right: {mobileRight}px; width: {buttonSize}px; height: {buttonSize}px;"
      >
        <div class="pulse-ring pulse-ring-1"></div>
        <div class="pulse-ring pulse-ring-2"></div>
        <div class="pulse-ring pulse-ring-3"></div>
        <div class="glow-dot"></div>
      </div>

      <div
        class="speech-bubble speech-bubble-mobile"
        style="bottom: {mobileBottom + buttonSize + 16}px; right: {mobileRight}px;"
        transition:fly={{ y: 10, duration: 400, delay: 200, easing: elasticOut }}
      >
        <div class="bubble-pointer bubble-pointer-bottom"></div>
        <div class="bubble-content">
          <i class="fas fa-lightbulb bubble-icon" aria-hidden="true"></i>
          <div class="bubble-text">
            <span class="bubble-title">Feeling overwhelmed?</span>
            <span class="bubble-hint">Tap the <strong>?</strong> button to learn what each setting does</span>
          </div>
        </div>
        <div class="tap-hint">
          <span>Tap anywhere to dismiss</span>
        </div>
      </div>
    {/if}
  </button>
{/if}

<style>
  .discovery-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.4);
    border: none;
    cursor: pointer;
    padding: 0;
    margin: 0;
  }

  /* Pulse container - positioned around the help button */
  .pulse-container {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .pulse-ring {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid rgba(99, 102, 241, 0.6);
    animation: pulse-expand 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  .pulse-ring-1 {
    animation-delay: 0s;
  }

  .pulse-ring-2 {
    animation-delay: 0.5s;
  }

  .pulse-ring-3 {
    animation-delay: 1s;
  }

  @keyframes pulse-expand {
    0% {
      transform: scale(1);
      opacity: 0.8;
    }
    100% {
      transform: scale(2.2);
      opacity: 0;
    }
  }

  .glow-dot {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: radial-gradient(
      circle at center,
      rgba(99, 102, 241, 0.4) 0%,
      rgba(99, 102, 241, 0.1) 50%,
      transparent 70%
    );
    animation: glow-pulse 1.5s ease-in-out infinite alternate;
  }

  @keyframes glow-pulse {
    0% {
      transform: scale(1.3);
      opacity: 0.6;
    }
    100% {
      transform: scale(1.8);
      opacity: 0.3;
    }
  }

  /* Speech bubble - base styles */
  .speech-bubble {
    position: absolute;
    width: 240px;
    background: linear-gradient(
      135deg,
      rgba(30, 30, 50, 0.98) 0%,
      rgba(25, 25, 45, 0.98) 100%
    );
    border: 1px solid rgba(99, 102, 241, 0.4);
    border-radius: 16px;
    padding: 16px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 0 20px rgba(99, 102, 241, 0.15);
    pointer-events: none;
  }

  /* Bubble pointer pointing UP (for desktop - bubble below button) */
  .bubble-pointer-top {
    position: absolute;
    top: -8px;
    right: 16px;
    width: 16px;
    height: 16px;
    background: rgba(30, 30, 50, 0.98);
    border-left: 1px solid rgba(99, 102, 241, 0.4);
    border-top: 1px solid rgba(99, 102, 241, 0.4);
    transform: rotate(45deg);
  }

  /* Bubble pointer pointing DOWN (for mobile - bubble above button) */
  .bubble-pointer-bottom {
    position: absolute;
    bottom: -8px;
    right: 16px;
    width: 16px;
    height: 16px;
    background: rgba(30, 30, 50, 0.98);
    border-right: 1px solid rgba(99, 102, 241, 0.4);
    border-bottom: 1px solid rgba(99, 102, 241, 0.4);
    transform: rotate(45deg);
  }

  .bubble-content {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .bubble-icon {
    flex-shrink: 0;
    font-size: 1.25rem;
    color: #fbbf24;
    margin-top: 2px;
    animation: icon-wiggle 2s ease-in-out infinite;
  }

  @keyframes icon-wiggle {
    0%, 100% {
      transform: rotate(-5deg);
    }
    50% {
      transform: rotate(5deg);
    }
  }

  .bubble-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .bubble-title {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: white;
  }

  .bubble-hint {
    font-size: var(--font-size-compact, 12px);
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.7);
  }

  .bubble-hint strong {
    color: #a5b4fc;
    font-weight: 600;
  }

  .tap-hint {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
  }

  .tap-hint span {
    font-size: var(--font-size-xs, 11px);
    color: rgba(255, 255, 255, 0.4);
  }

  /* Respect reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .pulse-ring,
    .glow-dot,
    .bubble-icon {
      animation: none;
    }

    .pulse-ring {
      transform: scale(1.5);
      opacity: 0.5;
    }

    .glow-dot {
      transform: scale(1.5);
      opacity: 0.4;
    }
  }

  /* Adjust for smaller screens */
  @media (max-width: 400px) {
    .speech-bubble {
      width: 200px;
      right: 8px !important;
      padding: 12px;
    }

    .bubble-pointer-bottom {
      right: 14px;
    }
  }
</style>
