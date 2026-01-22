<script lang="ts">
  import type { SequenceSection } from "./../../../shared/domain/models/discover-models.ts";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { container } from "$lib/shared/di";
  import { onMount, onDestroy } from "svelte";
  import type { IDiscoverThumbnailProvider } from "../services/contracts/IDiscoverThumbnailProvider";
  import { PinchZoomGridController } from "../services/implementations/PinchZoomGridController";
  import DiscoverGrid from "./DiscoverGrid.svelte";
  import DiscoverThumbnailSkeleton from "./DiscoverThumbnailSkeleton.svelte";
  import SequenceTopBarControls from "../../../shared/components/SequenceTopBarControls.svelte";
  import { gridZoomManager } from "../../../shared/state/grid-zoom-state.svelte";

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const {
    sequences = [],
    sections = [],
    isLoading = false,
    sectionsReady = true,
    error = null,
    showSections = false,
    source = "community",
    onAction = () => {},
    onScroll,
  } = $props<{
    sequences?: SequenceData[];
    sections?: SequenceSection[];
    isLoading?: boolean;
    sectionsReady?: boolean;
    error?: string | null;
    showSections?: boolean;
    source?: "community" | "my-library";
    onAction?: (action: string, sequence: SequenceData) => void;
    onScroll?: (event: CustomEvent<{ scrollTop: number }>) => void;
  }>();

  // ✅ RESOLVE SERVICES: Get services from DI container (lazy resolution)
  let thumbnailService: IDiscoverThumbnailProvider | null = $state(null);

  // Pinch-to-zoom state
  let pinchController: PinchZoomGridController | null = null;
  let displayContentEl: HTMLElement | null = $state(null);

  // Derive from shared grid zoom manager
  const pinchColumns = $derived(gridZoomManager.columns);
  const isTransitioning = $derived(gridZoomManager.isTransitioning);

  // ✅ DERIVED RUNES: UI state
  // Show skeleton until loading is done AND sections are ready
  // Note: Don't check sections.length - empty library is valid state, not "still loading"
  const isInitializing = $derived(isLoading || !sectionsReady);
  const isEmpty = $derived(!isInitializing && !error && sequences.length === 0);
  const hasSequences = $derived(!isInitializing && !error && sequences.length > 0);
  const emptyMessage = $derived(
    source === "my-library"
      ? "No sequences saved yet"
      : "No sequences found"
  );

  // Handle sequence actions
  function handleSequenceAction(action: string, sequence: SequenceData) {
    onAction(action, sequence);
  }

  onMount(async () => {
    thumbnailService = container.items.discoverThumbnailProvider as IDiscoverThumbnailProvider;

    // Initialize from settings
    gridZoomManager.initFromSettings();

    // Initialize pinch-to-zoom controller (touch devices only)
    pinchController = new PinchZoomGridController();

    if (pinchController.isTouchDevice() && displayContentEl) {
      // Sync controller with current state
      pinchController.setColumnCount(gridZoomManager.columns);

      // Handle state updates from pinch gestures - update shared manager
      pinchController.setOnStateChange((state) => {
        gridZoomManager.setColumns(state.columns);
      });

      pinchController.attach(displayContentEl);
    }
  });

  onDestroy(() => {
    pinchController?.detach();
    pinchController = null;
  });

  function handleRetry() {
    onAction("retry", {} as SequenceData);
  }

  // Handle scroll events and emit to parent
  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    if (onScroll) {
      onScroll(
        new CustomEvent("scroll", {
          detail: { scrollTop: target.scrollTop },
        })
      );
    }
  }
</script>

<div class="sequence-display-panel">
  <!-- Gallery controls (moved from TopBar) -->
  <div class="gallery-controls-container">
    <SequenceTopBarControls />
  </div>

  <!-- Content area -->
  <div class="display-content" bind:this={displayContentEl} onscroll={handleScroll}>
    {#if isInitializing}
      <!-- Show skeletons until sections are fully ready -->
      <DiscoverThumbnailSkeleton viewMode="grid" count={12} />
    {:else if error}
      <div class="error-state" role="alert" aria-live="assertive">
        <p class="error-message">{error}</p>
        <button onclick={handleRetry}> Try Again </button>
      </div>
    {:else if isEmpty}
      <div class="empty-state">
        <p>{emptyMessage}</p>
      </div>
    {:else if hasSequences}
      <DiscoverGrid
        {sequences}
        {sections}
        viewMode="grid"
        {showSections}
        {thumbnailService}
        onAction={handleSequenceAction}
        pinchColumnOverride={pinchColumns}
        {isTransitioning}
      />
    {/if}
  </div>
</div>

<style>
  .sequence-display-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* Gallery controls container - wraps the top bar controls */
  .gallery-controls-container {
    flex-shrink: 0;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .display-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
    container-type: inline-size; /* Enable container queries for responsive grid */
    /* Allow vertical scroll + pinch zoom, let JS handle custom pinch */
    touch-action: pan-y;
  }

  /* Modern scrollbar - thin and subtle */
  .display-content::-webkit-scrollbar {
    width: 6px;
  }

  .display-content::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .display-content::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;
  }

  .display-content::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  /* Firefox scrollbar */
  .display-content {
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  /* Error state */
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    gap: var(--spacing-md);
    color: var(--semantic-error);
  }

  .error-message {
    margin: 0;
    text-align: center;
  }

  .error-state button {
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    border: 1px solid var(--semantic-error);
    border-radius: 6px;
    color: var(--semantic-error);
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .error-state button:hover {
    background: color-mix(in srgb, var(--semantic-error) 30%, transparent);
  }

  /* Empty state */
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-base);
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    /* Responsive styles for mobile */
  }
</style>
