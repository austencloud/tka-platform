<script lang="ts">
  import type { SequenceSection } from "./../../../shared/domain/models/browse-models.ts";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";
  import type { BrowseFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
  import type { SequenceFilterType } from "../../../shared/state/sequence-controls-state.svelte";
  import type { ActiveFilter } from "../../../shared/domain/models/multi-filter-models";
  import { container } from "$lib/shared/di";
  import { onMount, onDestroy } from "svelte";
  import type { IBrowseThumbnailProvider } from "../services/contracts/IBrowseThumbnailProvider";
  import { PinchZoomGridController } from "../services/implementations/PinchZoomGridController";
  import BrowseGrid from "./BrowseGrid.svelte";
  import BrowseThumbnailSkeleton from "./BrowseThumbnailSkeleton.svelte";
  import SequenceTopBarControls from "../../../shared/components/SequenceTopBarControls.svelte";
  import InlineFilterPanel from "../../filtering/components/inline-filter/InlineFilterPanel.svelte";
  import { gridZoomManager } from "../../../shared/state/grid-zoom-state.svelte";
  import { sequencePanelManager } from "../../../shared/state/sequence-panel-state.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  const {
    sequences = [],
    sections = [],
    isLoading = false,
    sectionsReady = true,
    error = null,
    showSections = false,
    source = "community",
    activeFilterList = [],
    activeLevel = null,
    activeLetter = null,
    activeLength = null,
    activeLoopType = null,
    isFavoritesActive = false,
    hasActivePositions = false,
    availableLengths = [],
    loopTypeCounts = {},
    onAction = () => {},
    onScroll,
    onFilterChange,
    onRemoveFilter,
    onClearAllFilters,
    onOpenLetterSheet,
    onOpenOptionsSheet,
    getFilteredCount,
  } = $props<{
    sequences?: SequenceData[];
    sections?: SequenceSection[];
    isLoading?: boolean;
    sectionsReady?: boolean;
    error?: string | null;
    showSections?: boolean;
    source?: "community" | "my-library";
    activeFilterList?: ActiveFilter[];
    activeLevel?: number | null;
    activeLetter?: string | null;
    activeLength?: number | null;
    activeLoopType?: string | null;
    isFavoritesActive?: boolean;
    hasActivePositions?: boolean;
    availableLengths?: number[];
    loopTypeCounts?: Record<string, number>;
    onAction?: (action: string, sequence: SequenceData, variations?: SequenceData[]) => void;
    onScroll?: (event: CustomEvent<{ scrollTop: number }>) => void;
    onFilterChange?: (type: SequenceFilterType, value?: BrowseFilterValue) => void;
    onRemoveFilter?: (type: string) => void;
    onClearAllFilters?: () => void;
    onOpenLetterSheet?: () => void;
    onOpenOptionsSheet?: () => void;
    getFilteredCount?: (candidateType: BrowseFilterType, candidateValue: BrowseFilterValue) => number;
  }>();

  const isInlineFiltersOpen = $derived(sequencePanelManager.isInlineFiltersOpen);

  // ✅ RESOLVE SERVICES: Get services from DI container (lazy resolution)
  let thumbnailService: IBrowseThumbnailProvider | null = $state(null);

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
      ? t('browse_no_sequences_saved')
      : t('browse_no_sequences_found')
  );

  // Handle sequence actions (pass variations through for view-detail)
  function handleSequenceAction(action: string, sequence: SequenceData, variations?: SequenceData[]) {
    onAction(action, sequence, variations);
  }

  onMount(async () => {
    thumbnailService = container.items.browseThumbnailProvider;

    // Initialize from settings
    gridZoomManager.initFromSettings();

    // Initialize zoom controller (handles both pinch on touch and Shift+scroll on desktop)
    pinchController = new PinchZoomGridController();

    if (displayContentEl) {
      // Sync controller with current state
      pinchController.setColumnCount(gridZoomManager.columns);

      // Handle state updates from gestures - update shared manager
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
  <!-- Gallery controls -->
  <div class="gallery-controls-container">
    <SequenceTopBarControls />
  </div>

  <!-- Inline filter panel (collapsible) -->
  {#if onFilterChange && onRemoveFilter && onClearAllFilters && onOpenLetterSheet && onOpenOptionsSheet}
    <InlineFilterPanel
      isOpen={isInlineFiltersOpen}
      {activeFilterList}
      {activeLevel}
      {activeLetter}
      {activeLength}
      {activeLoopType}
      {isFavoritesActive}
      {hasActivePositions}
      {availableLengths}
      {loopTypeCounts}
      {onFilterChange}
      {onRemoveFilter}
      onClearAllFilters={onClearAllFilters}
      {onOpenLetterSheet}
      {onOpenOptionsSheet}
      {getFilteredCount}
    />
  {/if}

  <!-- Content area -->
  <div class="display-content" bind:this={displayContentEl} onscroll={handleScroll}>
    {#if isInitializing}
      <!-- Show skeletons until sections are fully ready -->
      <BrowseThumbnailSkeleton viewMode="grid" count={12} />
    {:else if error}
      <div class="error-state" role="alert" aria-live="assertive">
        <p class="error-message">{error}</p>
        <button onclick={handleRetry}> {t('browse_try_again')} </button>
      </div>
    {:else if isEmpty}
      <div class="empty-state">
        <p>{emptyMessage}</p>
      </div>
    {:else if hasSequences}
      <BrowseGrid
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
