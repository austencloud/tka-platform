<!--
BrowseTab.svelte

Main container for the Browse tab - viewing saved animations.

Features:
- AnimationFilters at top
- AnimationGrid in main area
- AnimationDetailPanel as drawer (right on desktop, bottom on mobile)
- Responsive layout
- State management via browse-state
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { getBrowseState } from "./state/browse-state.svelte";
  import type { SavedAnimation } from "./state/browse-state.svelte";
  import { getComposeModuleState } from "$lib/features/compose/shared/state/compose-module-state.svelte";
  import AnimationFilters from "./components/AnimationFilters.svelte";
  import AnimationGrid from "./components/AnimationGrid.svelte";
  import AnimationDetailPanel from "./components/AnimationDetailPanel.svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";

  const debug = createComponentLogger("BrowseTab");

  let hapticService: IHapticFeedback | null = null;

  // Get singleton state
  const browseState = getBrowseState();
  const composeModuleState = getComposeModuleState();

  // Local state for drawer
  let isDetailPanelOpen = $state(false);
  let isMobile = $state(false);

  // Drawer width (desktop)
  const drawerWidth = "min(600px, 90vw)";

  onMount(() => {
    hapticService = container.items.hapticFeedback;

    // Load animations
    browseState.loadAnimations();

    // Detect mobile
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  });

  // Handlers
  function handleFilterChange(filter: any) {
    browseState.setFilter(filter);
  }

  function handleSortChange(method: any, direction: any) {
    browseState.setSort(method, direction);
  }

  function handleGridAction(action: string, animation: SavedAnimation) {
    hapticService?.trigger("selection");

    if (action === "view-detail") {
      browseState.selectAnimation(animation);
      isDetailPanelOpen = true;
    }
  }

  function handleDetailPanelAction(action: string, animation: SavedAnimation) {
    hapticService?.trigger("selection");

    switch (action) {
      case "play":
        // Set the animation mode and open playback overlay
        composeModuleState.setCurrentMode(animation.mode);
        composeModuleState.openPlayback("browse");
        isDetailPanelOpen = false;
        debug.log("Playing composition:", animation.name);
        break;

      case "edit":
        // TODO: Navigate to Arrange tab with composition loaded
        break;

      case "favorite":
        browseState.toggleFavorite(animation.id);
        break;

      case "duplicate":
        // TODO: Duplicate animation
        break;

      case "share":
        // TODO: Open share dialog
        break;

      case "delete":
        // TODO: Show confirmation dialog, then delete
        if (confirm(`Delete "${animation.name}"?`)) {
          browseState.deleteAnimation(animation.id);
          isDetailPanelOpen = false;
        }
        break;
    }
  }

  function handleCloseDetailPanel() {
    hapticService?.trigger("selection");
    isDetailPanelOpen = false;
    browseState.clearSelection();
  }
</script>

<div class="browse-tab">
  <!-- Filters -->
  <div class="filters-section">
    <AnimationFilters
      currentFilter={browseState.currentFilter}
      sortMethod={browseState.sortMethod}
      sortDirection={browseState.sortDirection}
      onFilterChange={handleFilterChange}
      onSortChange={handleSortChange}
    />
  </div>

  <!-- Grid -->
  <div class="grid-section">
    {#if browseState.error}
      <div class="error-state" role="alert" aria-live="assertive">
        <i class="fas fa-exclamation-triangle error-icon" aria-hidden="true"
        ></i>
        <p class="error-message">{browseState.error}</p>
        <button class="retry-btn" onclick={() => browseState.loadAnimations()}>
          <i class="fas fa-redo" aria-hidden="true"></i>
          Try Again
        </button>
      </div>
    {:else}
      <AnimationGrid
        animations={browseState.filteredAnimations}
        isLoading={browseState.isLoading}
        onAction={handleGridAction}
      />
    {/if}
  </div>

  <!-- Detail Panel Drawer -->
  <div style:--drawer-width={drawerWidth}>
    <Drawer
      bind:isOpen={isDetailPanelOpen}
      placement={isMobile ? "bottom" : "right"}
      class="detail-drawer"
      showHandle={false}
      closeOnBackdrop={false}
      backdropClass={!isMobile ? "transparent-backdrop" : ""}
      trapFocus={isMobile}
      setInertOnSiblings={isMobile}
      onOpenChange={(open) => {
        if (!open) {
          handleCloseDetailPanel();
        }
      }}
    >
      {#if browseState.selectedAnimation}
        <AnimationDetailPanel
          animation={browseState.selectedAnimation}
          onClose={handleCloseDetailPanel}
          onAction={handleDetailPanelAction}
        />
      {/if}
    </Drawer>
  </div>
</div>

<style>
  .browse-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* Filters Section */
  .filters-section {
    flex-shrink: 0;
    padding: var(--spacing-md);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  /* Grid Section */
  .grid-section {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
    container-type: inline-size;
  }

  /* Error State */
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    padding: var(--spacing-xl);
    text-align: center;
  }

  .error-icon {
    font-size: var(--font-size-3xl);
    color: rgba(239, 68, 68, 0.5);
    margin-bottom: var(--spacing-lg);
  }

  .error-message {
    font-size: var(--font-size-base);
    color: var(--theme-text-dim);
    margin: 0 0 var(--spacing-md) 0;
    max-width: 400px;
  }

  .retry-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);
    border-radius: 8px;
    color: var(--theme-accent, var(--semantic-info));
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
  }

  /* Detail Drawer Styling */
  :global(.detail-drawer.drawer-content[data-placement="right"]) {
    width: var(--drawer-width, min(600px, 90vw));
    transition:
      transform 350ms cubic-bezier(0.32, 0.72, 0, 1),
      opacity 350ms cubic-bezier(0.32, 0.72, 0, 1),
      width 300ms cubic-bezier(0.4, 0, 0.2, 1) !important;
    top: 64px !important;
    height: calc(100vh - 64px) !important;
    background: rgba(20, 20, 30, 0.7) !important;
    backdrop-filter: blur(20px) !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: -2px 0 16px rgba(0, 0, 0, 0.15) !important;
  }

  /* Subtle vertical grip indicator */
  :global(.detail-drawer.drawer-content[data-placement="right"]::before) {
    content: "";
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: var(--min-touch-target);
    background: linear-gradient(
      to bottom,
      transparent 0%,
      rgba(255, 255, 255, 0.2) 10%,
      rgba(255, 255, 255, 0.2) 90%,
      transparent 100%
    );
    border-radius: 2px;
    opacity: 0.6;
    transition: opacity 0.2s ease;
  }

  :global(.detail-drawer.drawer-content[data-placement="right"]:hover::before) {
    opacity: 1;
  }

  /* Transparent backdrop for desktop */
  :global(.drawer-overlay.transparent-backdrop) {
    background: transparent !important;
    backdrop-filter: none !important;
    pointer-events: none !important;
  }

  /* Mobile: Full-height bottom sheet */
  :global(.detail-drawer.drawer-content[data-placement="bottom"]) {
    max-height: 100vh !important;
    height: 100vh !important;
    border-top-left-radius: 16px !important;
    border-top-right-radius: 16px !important;
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .filters-section {
      padding: var(--spacing-sm);
    }

    .grid-section {
      padding: var(--spacing-md);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .retry-btn {
      transition: none;
    }
  }
</style>
