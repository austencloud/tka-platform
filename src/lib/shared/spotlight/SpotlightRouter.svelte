<script lang="ts">
  /**
   * SpotlightRouter
   * Domain: Spotlight Viewer Routing
   *
   * Responsibilities:
   * - Listen for URL-based spotlight route changes
   * - Manage spotlight viewer visibility
   * - Sync URL state with legacy spotlight state
   * - Render SpotlightViewer component
   */
  import { onMount } from "svelte";
  import SpotlightViewer from "../../features/discover/sequences/spotlight/components/SpotlightViewer.svelte";
  import {
    closeSpotlightViewer,
    getShowSpotlight,
    getSpotlightSequence,
    getSpotlightThumbnailService,
    getSpotlightDisplayMode,
  } from "../application/state/ui/ui-state.svelte";
  import type {
    ISheetRouter,
    RouteState,
  } from "../navigation/services/contracts/ISheetRouter";
  import { container } from "$lib/shared/di";

  // Legacy spotlight state (from global app state)
  let showSpotlight = $derived(getShowSpotlight());
  let spotlightSequence = $derived(getSpotlightSequence());
  let spotlightThumbnailService = $derived(getSpotlightThumbnailService());
  let spotlightDisplayMode = $derived(getSpotlightDisplayMode());

  // Route-based spotlight state
  let spotlightSequenceId = $state<string | null>(null);
  let sheetRouterService: ISheetRouter | null = null;

  onMount(() => {
    if (typeof window === "undefined") {
      return;
    }

    // Resolve sheet router service via ITI container
    try {
      sheetRouterService = container.items.sheetRouter;
    } catch (error) {
      console.error("Failed to resolve SheetRouter:", error);
      return;
    }

    const cleanupFns: Array<() => void> = [];

    // Listen for route changes (spotlight, etc.)
    const cleanupRouteListener = sheetRouterService.onRouteChange(
      (state: RouteState) => {
        spotlightSequenceId = state.spotlight || null;

        // Sync with legacy spotlight state if needed
        if (state.spotlight && !getShowSpotlight()) {
          // Route opened spotlight - SpotlightViewer will handle fetching
        } else if (!state.spotlight && getShowSpotlight()) {
          // Route closed spotlight
          closeSpotlightViewer();
        }
      }
    );
    cleanupFns.push(cleanupRouteListener);

    // Initialize spotlight from URL on mount
    const initialSpotlight = sheetRouterService.getCurrentSpotlight();
    if (initialSpotlight) {
      spotlightSequenceId = initialSpotlight;
    }

    return () => {
      cleanupFns.forEach((cleanup) => {
        try {
          cleanup();
        } catch (error) {
          console.warn("Failed to clean up spotlight router:", error);
        }
      });
    };
  });

  function handleClose() {
    closeSpotlightViewer();
    if (spotlightSequenceId) {
      sheetRouterService?.closeSpotlight();
    }
  }
</script>

<!-- Spotlight Viewer - rendered at root level for proper z-index -->
<!-- Route-aware: Opens via ?spotlight={id} or legacy showSpotlight state -->
<!-- Note: thumbnailService is optional - SpotlightViewer can work without it -->
{#if (showSpotlight && spotlightSequence) || spotlightSequenceId}
  <SpotlightViewer
    show={showSpotlight || !!spotlightSequenceId}
    displayMode={spotlightDisplayMode}
    {...spotlightSequence ? { sequence: spotlightSequence } : {}}
    {...spotlightThumbnailService
      ? { thumbnailService: spotlightThumbnailService }
      : {}}
    onClose={handleClose}
  />
{/if}
