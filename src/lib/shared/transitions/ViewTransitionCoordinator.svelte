<!--
  ViewTransitionCoordinator
  Modern 2025/2026 component for coordinating view transitions

  This component provides visual feedback during module/tab transitions
  and coordinates the timing to prevent content overlap
-->
<script lang="ts">
  import { viewTransitionManager } from "./view-transition-state.svelte";

  // Get reactive state from the manager
  const state = $derived(viewTransitionManager.state);
  const progress = $derived(viewTransitionManager.progress);
  const supportsViewTransitions = $derived(
    viewTransitionManager.supportsViewTransitions
  );

  // Visual feedback configuration
  const showOverlay = $derived(state.isTransitioning && state.phase !== "idle");

  // Determine overlay style based on transition phase
  const overlayOpacity = $derived.by(() => {
    if (!showOverlay) return 0;

    switch (state.phase) {
      case "preparing":
        // Fade in quickly
        return Math.min(progress * 4, 0.15);
      case "transitioning":
        // Stay visible
        return 0.15;
      case "completing":
        // Fade out
        return Math.max(0.15 - progress * 0.3, 0);
      default:
        return 0;
    }
  });

  // Direction-based animation class
  const _directionClass = $derived(
    state.direction === "forward"
      ? "slide-forward"
      : state.direction === "backward"
        ? "slide-backward"
        : "fade"
  );
</script>

<!-- Transition overlay for visual feedback -->
{#if showOverlay}
  <div
    class="view-transition-overlay"
    class:active={showOverlay}
    class:supports-native={supportsViewTransitions}
    style:opacity={overlayOpacity}
    role="presentation"
    aria-hidden="true"
  >
    <!-- Subtle progress indicator -->
    <div class="transition-progress" style:transform="scaleX({progress})"></div>
  </div>
{/if}

<style>
  /* ============================================================================
     VIEW TRANSITION OVERLAY
     Provides subtle visual feedback during transitions
     ============================================================================ */
  .view-transition-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(2px);
    transition: opacity var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* When native View Transitions are supported, reduce overlay visibility */
  .view-transition-overlay.supports-native {
    background: rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(1px);
  }

  /* ============================================================================
     PROGRESS INDICATOR
     Subtle line at top showing transition progress
     ============================================================================ */
  .transition-progress {
    position: absolute;
    top: 0;
    left: 0;
    height: 2px;
    width: 100%;
    background: linear-gradient(
      90deg,
      rgba(103, 126, 234, 0.8) 0%,
      rgba(118, 75, 162, 0.8) 100%
    );
    box-shadow: 0 0 8px rgba(103, 126, 234, 0.6);
    transform-origin: left center;
    transition: transform var(--duration-instant) linear;
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .view-transition-overlay {
      transition: none !important;
      backdrop-filter: none !important;
    }

    .transition-progress {
      display: none;
    }
  }

  @media (prefers-contrast: high) {
    .view-transition-overlay {
      background: rgba(0, 0, 0, 0.5);
    }

    .transition-progress {
      height: 3px;
      background: white;
      box-shadow: none;
    }
  }
</style>
