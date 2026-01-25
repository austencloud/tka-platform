<!--
Browse Top Bar - Unified navigation bar for all Browse tabs

Structure:
┌─────────────────────────────────────────────────────────────┐
│ [← →]     │     {tab-specific controls}     │   [Actions]  │
│ nav btns  │     (sort chips, search, etc)   │   (filter)   │
└─────────────────────────────────────────────────────────────┘

- Left: Back/forward navigation buttons (always present)
- Center: Tab-specific controls passed via children snippet
- Right: Optional action buttons passed via actions snippet
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { browseNavigationState } from "../state/browse-navigation-state.svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
    import { onMount } from "svelte";

  interface Props {
    children?: Snippet;
    actions?: Snippet;
    onNavigate?: (location: {
      tab: string;
      view: string;
      contextId?: string;
    }) => void;
  }

  const { children, actions, onNavigate }: Props = $props();

  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Reactive state from navigation
  const canGoBack = $derived(browseNavigationState.canGoBack);
  const canGoForward = $derived(browseNavigationState.canGoForward);

  // Only show nav buttons if there's history to navigate
  const showNavButtons = $derived(canGoBack || canGoForward);

  function handleBack() {
    const location = browseNavigationState.goBack();
    if (location) {
      hapticService?.trigger("selection");
      onNavigate?.(location);
    }
  }

  function handleForward() {
    const location = browseNavigationState.goForward();
    if (location) {
      hapticService?.trigger("selection");
      onNavigate?.(location);
    }
  }
</script>

<div class="browse-topbar">
  <div class="topbar-content">
    <!-- Left: Navigation buttons -->
    <div class="nav-section">
      {#if showNavButtons}
        <div class="nav-buttons">
          <button
            class="nav-button"
            onclick={handleBack}
            disabled={!canGoBack}
            aria-label="Go back"
            title="Go back"
          >
            <i class="fas fa-chevron-left" aria-hidden="true"></i>
          </button>
          <button
            class="nav-button"
            onclick={handleForward}
            disabled={!canGoForward}
            aria-label="Go forward"
            title="Go forward"
          >
            <i class="fas fa-chevron-right" aria-hidden="true"></i>
          </button>
        </div>
      {/if}
    </div>

    <!-- Center: Tab-specific controls (passed via children) -->
    <div class="center-section">
      {#if children}
        {@render children()}
      {/if}
    </div>

    <!-- Right: Action buttons (passed via actions snippet) -->
    <div class="actions-section">
      {#if actions}
        {@render actions()}
      {/if}
    </div>
  </div>
</div>

<style>
  .browse-topbar {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    background: var(--theme-panel-bg);
    border-bottom: 1px solid var(--theme-stroke);
    width: 100%;
    flex-shrink: 0;
  }

  /* Three-section layout: left (nav) - center (controls) - right (actions) */
  .topbar-content {
    display: flex;
    align-items: center;
    width: 100%;
    position: relative;
    min-height: var(--min-touch-target);
  }

  /* Left section - nav buttons */
  .nav-section {
    flex: 1;
    display: flex;
    justify-content: flex-start;
    min-width: 104px; /* Space for 2 nav buttons (48+8+48) */
  }

  /* Center section - absolutely centered controls */
  .center-section {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  /* Right section - action buttons */
  .actions-section {
    flex: 1;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
  }

  /* Navigation buttons container */
  .nav-buttons {
    display: flex;
    gap: 8px;
  }

  /* Navigation button - 50px touch target */
  .nav-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .nav-button:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .nav-button:active:not(:disabled) {
    transform: scale(0.95);
  }

  .nav-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* Responsive adjustments */
  @media (max-width: 480px) {
    .browse-topbar {
      padding: 8px 12px;
    }

    .nav-section {
      min-width: 80px;
    }

    /* On very small screens, stack or hide nav if needed */
    .center-section {
      position: relative;
      left: auto;
      transform: none;
      flex: 1;
      justify-content: center;
    }

    .topbar-content {
      gap: 8px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .nav-button {
      transition: none;
    }

    .nav-button:active:not(:disabled) {
      transform: none;
    }
  }
</style>
