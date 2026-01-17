<!--
  QuickFeedbackPanel - Desktop hotkey-triggered feedback drawer

  Opens via 'f' hotkey on desktop, slides in from the right as a side panel.
  Uses container queries for intelligent responsive sizing.
  
  Shares state with FeedbackSubmitTab so drafts persist between panel and tab.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { quickFeedbackState } from "../../state/quick-feedback-state.svelte";
  import {
    getSharedFeedbackSubmitState,
    resetSharedFeedbackSubmitState,
  } from "../../state/feedback-submit-state.svelte";
  import FeedbackForm from "../submit/FeedbackForm.svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";
  import { container } from "$lib/shared/di";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import type { ResponsiveSettings } from "$lib/shared/device/domain/models/device-models";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  const debug = createComponentLogger("QuickFeedbackPanel");

  // Use shared form state so drafts persist between panel and tab
  const formState = getSharedFeedbackSubmitState();
  const deviceDetector = container.items.deviceDetector;
  let responsiveSettings = $state<ResponsiveSettings | null>(null);
  let activeSnapPoint = $state<number | null>(null);
  let hasShownSuccessToast = $state(false);

  const isBottomSheet = $derived(
    responsiveSettings?.navigationLayout === "bottom"
  );
  const drawerPlacement = $derived(isBottomSheet ? "bottom" : "right");
  const drawerSnapPoints = $derived(isBottomSheet ? ["100%"] : null);

  function handleClose() {
    debug.log("handleClose called, current isOpen:", quickFeedbackState.isOpen);
    quickFeedbackState.close();
    debug.log("After close(), isOpen:", quickFeedbackState.isOpen);
    // Reset the toast flag when panel closes
    hasShownSuccessToast = false;
    // Don't reset form state - drafts should persist!
  }

  function syncResponsiveSettings() {
    try {
      responsiveSettings = deviceDetector?.getResponsiveSettings() ?? null;
    } catch (error) {
      console.warn(
        "QuickFeedbackPanel: failed to read responsive settings",
        error
      );
    }
  }

  onMount(() => {
    syncResponsiveSettings();

    const cleanup = deviceDetector.onCapabilitiesChanged(() => {
      syncResponsiveSettings();
    });

    return () => {
      cleanup();
    };
  });

  // Watch for successful submission to show toast and auto-close
  $effect(() => {
    if (formState.submitStatus === "success" && !hasShownSuccessToast) {
      // Mark as shown to prevent infinite loop
      hasShownSuccessToast = true;

      // Close panel immediately and show toast simultaneously
      handleClose();
      toast.success(
        "Feedback submitted! Thank you for helping improve TKA Scribe.",
        3000
      );

      // Reset the shared state after panel is closed
      resetSharedFeedbackSubmitState();
    }
  });
</script>

<Drawer
  isOpen={quickFeedbackState.isOpen}
  placement={drawerPlacement}
  onclose={handleClose}
  onbackdropclick={(e) => {
    handleClose();
    return true;
  }}
  closeOnBackdrop={true}
  closeOnEscape={true}
  ariaLabel="Quick Feedback"
  showHandle={isBottomSheet}
  dismissible={true}
  class={`quick-feedback-drawer ${isBottomSheet ? "bottom-sheet" : ""}`}
  snapPoints={drawerSnapPoints}
  bind:activeSnapPoint
>
  <div class="quick-feedback-panel" class:bottom-sheet={isBottomSheet}>
    <!-- Left edge drag handle for swipe-to-dismiss -->
    <div class="swipe-edge" class:hidden={isBottomSheet} aria-hidden="true">
      <div class="swipe-indicator"></div>
    </div>

    <!-- Main content column -->
    <div class="panel-content">
      <header class="panel-header">
        <div class="header-title">
          <i class="fas fa-comment-dots" aria-hidden="true"></i>
          <h2>Quick Feedback</h2>
        </div>
        <button
          class="close-btn"
          onclick={handleClose}
          aria-label="Close panel"
          type="button"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </header>

      <div
        class="keyboard-hint"
        class:hidden={isBottomSheet}
        aria-hidden="true"
      >
        <kbd>f</kbd>
        <span>or</span>
        <kbd>Esc</kbd>
        <span>to close</span>
      </div>

      <main class="panel-body">
        <FeedbackForm {formState} hideSuccessState={true} />
      </main>
    </div>
  </div>
</Drawer>

<style>
  /* ═══════════════════════════════════════════════════════════════════════════
     QUICK FEEDBACK PANEL - Container Query Based Layout
     ═══════════════════════════════════════════════════════════════════════════ */
  .quick-feedback-panel {
    /* Establish container for queries */
    container-type: inline-size;
    container-name: quick-feedback;

    /* Layout - row to accommodate swipe edge */
    display: flex;
    flex-direction: row;
    height: 100%;
    overflow: hidden;
    position: relative;

    /* Fluid spacing based on container width */
    --panel-padding: clamp(16px, 5cqi, 24px);
    --panel-gap: clamp(12px, 4cqi, 20px);

    /* Colors */
    --accent: var(--theme-accent-strong);
    --text-primary: var(--theme-text);
    --text-secondary: var(--theme-text-dim);
    --text-muted: color-mix(in srgb, var(--theme-text-dim) 80%, transparent);
    --border-subtle: var(--theme-stroke, var(--theme-stroke));
    --bg-subtle: var(--theme-card-bg);
    --bg-hover: var(--theme-card-hover-bg);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     SWIPE EDGE - Left edge for drag-to-dismiss
     ═══════════════════════════════════════════════════════════════════════════ */
  .swipe-edge {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: ew-resize;
    z-index: 10;
    touch-action: pan-x;
  }

  .swipe-edge:hover .swipe-indicator {
    opacity: 0.6;
    height: 60px;
  }

  .swipe-indicator {
    width: 4px;
    height: 40px;
    background: var(--accent);
    border-radius: 2px;
    opacity: 0.3;
    transition: all var(--duration-normal) ease;
  }

  .hidden {
    display: none;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     PANEL CONTENT - Main content wrapper
     ═══════════════════════════════════════════════════════════════════════════ */
  .panel-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    margin-left: 20px; /* Space for swipe edge */
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     HEADER - Fixed at top
     ═══════════════════════════════════════════════════════════════════════════ */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--panel-gap);
    padding: var(--panel-padding);
    padding-bottom: clamp(12px, 3cqi, 16px);
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2.5cqi, 12px);
  }

  .header-title i {
    font-size: clamp(1rem, 5cqi, 1.25rem);
    color: var(--accent);
  }

  .header-title h2 {
    margin: 0;
    /* Minimum 16px for accessibility, scales with container */
    font-size: clamp(1rem, 5cqi, 1.25rem);
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  /* Close button - 48px minimum touch target */
  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    width: clamp(48px, 12cqi, 48px);
    height: clamp(48px, 12cqi, 48px);
    background: var(--bg-subtle);
    border: 1px solid var(--border-subtle);
    border-radius: clamp(8px, 2cqi, 12px);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    border-color: var(--theme-stroke-strong, var(--theme-stroke-strong));
    color: var(--text-primary);
  }

  .close-btn:active {
    transform: scale(0.96);
  }

  .close-btn i {
    font-size: clamp(0.875rem, 4cqi, 1rem);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     KEYBOARD HINT
     ═══════════════════════════════════════════════════════════════════════════ */
  .keyboard-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1.5cqi, 8px);
    padding: clamp(8px, 2cqi, 12px) var(--panel-padding);
    /* Minimum 14px for readability */
    font-size: clamp(0.875rem, 3.5cqi, 0.9375rem);
    color: var(--text-muted);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--accent) 8%, transparent) 0%,
      transparent 100%
    );
    flex-shrink: 0;
  }

  .keyboard-hint kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: clamp(24px, 6cqi, 28px);
    min-height: clamp(24px, 6cqi, 28px);
    padding: clamp(2px, 0.5cqi, 4px) clamp(6px, 2cqi, 10px);
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: clamp(4px, 1cqi, 6px);
    font-family: inherit;
    /* Minimum 12px */
    font-size: clamp(0.75rem, 3cqi, 0.8125rem);
    font-weight: 600;
    color: color-mix(in srgb, var(--accent) 90%, white);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     PANEL BODY - Scrollable content area, vertically centered
     ═══════════════════════════════════════════════════════════════════════════ */
  .panel-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--panel-padding);

    /* Smooth scrolling */
    scroll-behavior: smooth;
    overscroll-behavior: contain;

    /* Custom scrollbar */
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .panel-body::-webkit-scrollbar {
    width: 6px;
  }

  .panel-body::-webkit-scrollbar-track {
    background: transparent;
  }

  .panel-body::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;
  }

  .panel-body::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     CONTAINER QUERIES - Responsive adjustments
     ═══════════════════════════════════════════════════════════════════════════ */

  /* Narrow panel (< 320px) - tighter spacing */
  @container quick-feedback (max-width: 320px) {
    .panel-header {
      flex-wrap: wrap;
    }

    .keyboard-hint {
      flex-wrap: wrap;
    }
  }

  /* Wide panel (> 400px) - more breathing room */
  @container quick-feedback (min-width: 400px) {
    .panel-header {
      padding: clamp(20px, 6cqi, 28px);
      padding-bottom: clamp(16px, 4cqi, 20px);
    }

    .panel-body {
      padding: clamp(20px, 6cqi, 28px);
      padding-top: clamp(16px, 4cqi, 20px);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     GLOBAL DRAWER OVERRIDES
     ═══════════════════════════════════════════════════════════════════════════ */
  :global(.quick-feedback-drawer) {
    /* Responsive width with min/max bounds */
    width: clamp(320px, 30vw, 420px);
    max-width: 90vw;
    /* Uses default solid background from Drawer.css */
  }

  :global(.quick-feedback-drawer.bottom-sheet) {
    width: 100%;
    max-width: none;
    height: 100vh;
  }

  .quick-feedback-panel.bottom-sheet {
    flex-direction: column;
    height: 100vh;
    max-height: none;
    padding-top: max(12px, env(safe-area-inset-top));
    padding-bottom: max(12px, env(safe-area-inset-bottom));
  }

  .quick-feedback-panel.bottom-sheet .panel-content {
    margin-left: 0;
    height: 100%;
  }

  .quick-feedback-panel.bottom-sheet .panel-body {
    padding-bottom: clamp(12px, 4cqi, 18px);
    flex: 1;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .close-btn {
      transition: none;
    }

    .panel-body {
      scroll-behavior: auto;
    }
  }
</style>
