<!--
  SequencePickerModal.svelte - Lightweight Sequence Selection Modal

  A focused modal for selecting sequences, optimized for speed and simplicity.
  Reuses BrowseGrid for rendering and BrowseFilter/BrowseSorter for filtering.

  Props:
  - open: Control modal visibility
  - onClose: Callback when modal closes
  - onSelect: Callback when a sequence is selected (receives full sequence data)
  - requiredBeatCount: Lock to specific beat count (null = any length allowed)
  - title: Custom header title (default: "Select Sequence")
  - showSourceToggle: Show Community vs My Library toggle (default: true)
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IBrowseLoader } from "$lib/features/browse/sequences/display/services/contracts/IBrowseLoader";
  import type { IBrowseFilter } from "$lib/features/browse/sequences/display/services/contracts/IBrowseFilter";
  import type { IBrowseSorter } from "$lib/features/browse/sequences/display/services/contracts/IBrowseSorter";
  import type { IBrowseThumbnailProvider } from "$lib/features/browse/sequences/display/services/contracts/IBrowseThumbnailProvider";
  import { BrowseSortMethod } from "$lib/features/browse/shared/domain/enums/browse-enums";
  import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
  import { container } from "$lib/shared/di";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import BrowseGrid from "$lib/features/browse/sequences/display/components/BrowseGrid.svelte";
  import PickerToolbar from "./PickerToolbar.svelte";
  import PickerFilterChips from "./PickerFilterChips.svelte";
  import PickerSidebar from "./PickerSidebar.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  // ===== Props =====
  interface Props {
    open: boolean;
    onClose: () => void;
    onSelect: (sequence: SequenceData) => void;
    requiredBeatCount?: number | null;
    title?: string;
    showSourceToggle?: boolean;
  }

  let {
    open = $bindable(false),
    onClose,
    onSelect,
    requiredBeatCount = null,
    title = "Select Sequence",
    showSourceToggle = true,
  }: Props = $props();

  // ===== Services =====
  let loaderService: IBrowseLoader | null = $state(null);
  let filterService: IBrowseFilter | null = $state(null);
  let sorterService: IBrowseSorter | null = $state(null);
  let thumbnailService: IBrowseThumbnailProvider | null = $state(null);

  // ===== Local State =====
  let sequences = $state<SequenceData[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state("");
  let currentSort = $state<BrowseSortMethod>(BrowseSortMethod.ALPHABETICAL);
  let levelFilter = $state<number | null>(null);
  let favoritesOnly = $state(false);
  let columnCount = $state(4);
  let source = $state<"community" | "my-library">("community");
  let isSelectingSequence = $state(false);
  let gridContainerRef: HTMLDivElement | undefined = $state(undefined);

  // ===== Column Count (2-8 range for 4K support) =====
  const MIN_COLUMNS = 2;
  const MAX_COLUMNS = 8;

  const canZoomIn = $derived(columnCount < MAX_COLUMNS);
  const canZoomOut = $derived(columnCount > MIN_COLUMNS);

  function increaseColumns() {
    if (canZoomIn) columnCount++;
  }

  function decreaseColumns() {
    if (canZoomOut) columnCount--;
  }

  // ===== Shift+Scroll zoom (matches Browse module behavior) =====
  const SCROLL_THRESHOLD = 50;
  let cumulativeScrollDelta = 0;

  function handleWheel(ev: WheelEvent) {
    if (!ev.shiftKey) return;

    // Prevent horizontal scroll that Shift+wheel normally triggers
    ev.preventDefault();

    cumulativeScrollDelta += ev.deltaY;

    if (cumulativeScrollDelta > SCROLL_THRESHOLD) {
      // Scroll down + Shift = more columns (zoom out)
      if (canZoomIn) columnCount++;
      cumulativeScrollDelta = 0;
    } else if (cumulativeScrollDelta < -SCROLL_THRESHOLD) {
      // Scroll up + Shift = fewer columns (zoom in)
      if (canZoomOut) columnCount--;
      cumulativeScrollDelta = 0;
    }
  }

  // Attach/detach wheel listener (needs { passive: false } for preventDefault)
  $effect(() => {
    const el = gridContainerRef;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  });

  // ===== Filtering Pipeline =====
  const filteredSequences = $derived.by(() => {
    if (!filterService || !sorterService) return sequences;

    let result = sequences;

    // 1. Beat count (always first, from prop)
    if (requiredBeatCount != null) {
      result = filterService.applyFilter(
        result,
        BrowseFilterType.LENGTH,
        requiredBeatCount
      );
    }

    // 2. Level filter
    if (levelFilter != null) {
      result = filterService.applyFilter(
        result,
        BrowseFilterType.DIFFICULTY,
        levelFilter
      );
    }

    // 3. Favorites
    if (favoritesOnly) {
      result = filterService.applyFilter(
        result,
        BrowseFilterType.FAVORITES,
        true
      );
    }

    // 4. Search
    if (searchQuery.trim()) {
      result = filterService.applyFilter(
        result,
        BrowseFilterType.CONTAINS_LETTERS,
        searchQuery
      );
    }

    // 5. Sort
    return sorterService.sortSequences(result, currentSort);
  });

  // ===== Check if any filters are active (excluding beat count) =====
  const hasActiveFilters = $derived(
    levelFilter != null || favoritesOnly || searchQuery.trim() !== ""
  );

  // ===== Empty state detection =====
  const isEmptyDueToFilters = $derived(
    filteredSequences.length === 0 && sequences.length > 0 && hasActiveFilters
  );

  // ===== Service Initialization =====
  function initializeServices() {
    try {
      loaderService = container.items.browseLoader ?? null;
      filterService = container.items.browseFilter ?? null;
      sorterService = container.items.browseSorter ?? null;
      thumbnailService = container.items.browseThumbnailProvider ?? null;
    } catch (err) {
      console.error("SequencePickerModal: Failed to initialize services:", err);
      error = "Failed to initialize services";
    }
  }

  // ===== Data Loading =====
  async function loadSequences() {
    if (!loaderService) {
      error = "Loader service not available";
      isLoading = false;
      return;
    }

    try {
      isLoading = true;
      error = null;
      const loaded = await loaderService.loadSequenceMetadata();
      sequences = loaded;
    } catch (err) {
      console.error("SequencePickerModal: Failed to load sequences:", err);
      error = err instanceof Error ? err.message : "Failed to load sequences";
    } finally {
      isLoading = false;
    }
  }

  // ===== Sequence Selection =====
  async function handleSequenceAction(action: string, sequence: SequenceData) {
    // Only handle primary action (view-detail triggers selection in this context)
    if (action !== "view-detail") return;

    if (!loaderService) {
      onSelect(sequence);
      onClose();
      return;
    }

    try {
      isSelectingSequence = true;

      // Load full sequence data including steps
      const fullSequence = await loaderService.loadFullSequenceData(
        sequence.word || sequence.name || sequence.id
      );

      if (fullSequence) {
        onSelect(fullSequence);
      } else {
        // Fallback to basic sequence if full load fails
        console.warn(
          `Could not load full data for ${sequence.word}, using metadata`
        );
        onSelect(sequence);
      }
      onClose();
    } catch (err) {
      console.error("Failed to load full sequence data:", err);
      onSelect(sequence);
      onClose();
    } finally {
      isSelectingSequence = false;
    }
  }

  // ===== Filter Management =====
  function handleSortChange(method: BrowseSortMethod) {
    currentSort = method;
  }

  function handleLevelChange(level: number | null) {
    levelFilter = level;
  }

  function handleFavoritesToggle() {
    favoritesOnly = !favoritesOnly;
  }

  function handleSearchChange(query: string) {
    searchQuery = query;
  }

  function handleClearFilters() {
    levelFilter = null;
    favoritesOnly = false;
    searchQuery = "";
  }

  // ===== Lifecycle =====
  onMount(() => {
    initializeServices();
    if (loaderService) {
      loadSequences();
    }
  });

  // ===== Modal close handler =====
  function handleModalClose() {
    onClose();
  }
</script>

<BaseModal
  bind:open
  onclose={handleModalClose}
  size="xl"
  class="sequence-picker-modal"
  labelledBy="sequence-picker-title"
>
  {#snippet header()}
    <div class="picker-header">
      <h2 id="sequence-picker-title">{title}</h2>
      {#if showSourceToggle}
        <div class="source-toggle">
          <button
            class="source-btn"
            class:active={source === "community"}
            onclick={() => (source = "community")}
          >
            Community
          </button>
          <button
            class="source-btn"
            class:active={source === "my-library"}
            onclick={() => (source = "my-library")}
          >
            My Library
          </button>
        </div>
      {/if}
      <button class="close-btn" onclick={handleModalClose} aria-label="Close">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  {/snippet}

  <div class="picker-content">
    <!-- Selection Overlay -->
    {#if isSelectingSequence}
      <div class="selecting-overlay" role="status" aria-live="polite">
        <ProgressRing percent={-1} size={32} strokeWidth={3} />
        <p>Loading sequence...</p>
      </div>
    {/if}

    <div class="picker-body">
      <!-- Desktop Sidebar -->
      <PickerSidebar
        {levelFilter}
        {favoritesOnly}
        {requiredBeatCount}
        {hasActiveFilters}
        resultCount={filteredSequences.length}
        onLevelChange={handleLevelChange}
        onFavoritesToggle={handleFavoritesToggle}
        onClearFilters={handleClearFilters}
      />

      <div class="main-area">
        <!-- Mobile-only Filter Chips -->
        <div class="mobile-filters">
          <PickerFilterChips
            {levelFilter}
            {favoritesOnly}
            {requiredBeatCount}
            {hasActiveFilters}
            onLevelChange={handleLevelChange}
            onFavoritesToggle={handleFavoritesToggle}
            onClearFilters={handleClearFilters}
          />
        </div>

        <!-- Toolbar: Search, Sort, Zoom -->
        <PickerToolbar
          {searchQuery}
          {currentSort}
          {columnCount}
          {canZoomIn}
          {canZoomOut}
          onSearchChange={handleSearchChange}
          onSortChange={handleSortChange}
          onZoomIn={increaseColumns}
          onZoomOut={decreaseColumns}
        />

        <!-- Content Area -->
        <div class="grid-container themed-scrollbar" class:disabled={isSelectingSequence} bind:this={gridContainerRef}>
          {#if isLoading}
            <div class="state-container loading">
              <ProgressRing percent={-1} size={32} strokeWidth={3} />
              <p>Loading sequences...</p>
            </div>
          {:else if error}
            <div class="state-container error" role="alert">
              <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
              <p>{error}</p>
              <button onclick={loadSequences}>Retry</button>
            </div>
          {:else if sequences.length === 0}
            <div class="state-container empty">
              <i class="fas fa-folder-open" aria-hidden="true"></i>
              <p>No sequences available</p>
            </div>
          {:else if filteredSequences.length === 0}
            <div class="state-container empty">
              <i class="fas fa-search" aria-hidden="true"></i>
              <p>No sequences match your filters</p>
              {#if hasActiveFilters}
                <button onclick={handleClearFilters}>Clear Filters</button>
              {/if}
            </div>
          {:else}
            <BrowseGrid
              sequences={filteredSequences}
              {thumbnailService}
              onAction={handleSequenceAction}
              pinchColumnOverride={columnCount}
              disableVirtualization
              eager
            />
          {/if}
        </div>
      </div>
    </div>
  </div>
</BaseModal>

<style>
  /* ===== Modal Width Override - use full viewport on large screens ===== */
  :global(dialog.sequence-picker-modal) {
    width: min(95vw, 2800px) !important;
  }

  /* ===== Header ===== */
  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .picker-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .source-toggle {
    display: flex;
    gap: 2px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--border-radius-md, 8px);
    padding: 2px;
  }

  .source-btn {
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    background: transparent;
    border: none;
    border-radius: var(--border-radius-sm, 4px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .source-btn:hover {
    color: var(--theme-text, white);
    background: rgba(255, 255, 255, 0.08);
  }

  .source-btn.active {
    background: var(--theme-accent, #8b5cf6);
    color: white;
  }

  .close-btn {
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, white);
    color: var(--theme-text, white);
  }

  /* ===== Content Area ===== */
  .picker-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    position: relative;
  }

  /* ===== Grid Container ===== */
  .grid-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--spacing-md, 12px);
  }

  .grid-container.disabled {
    pointer-events: none;
    opacity: 0.5;
  }

  /* ===== State Containers ===== */
  .state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    gap: var(--spacing-md, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .state-container i {
    font-size: 3rem;
    opacity: 0.3;
  }

  .state-container p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
  }

  .state-container button {
    padding: var(--spacing-sm, 8px) var(--spacing-lg, 16px);
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent);
    border-radius: var(--border-radius-md, 8px);
    color: white;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .state-container button:hover {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent);
  }

  /* ===== Selection Overlay ===== */
  .selecting-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--theme-panel-bg, rgba(18, 18, 28, 0.98)) 90%, transparent);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    z-index: 100;
    backdrop-filter: blur(4px);
  }

  .selecting-overlay p {
    color: white;
    font-size: var(--font-size-min, 14px);
    margin: 0;
  }

  /* ===== Sidebar + Main Layout ===== */
  .picker-body {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .mobile-filters {
    display: none;
  }

  @media (max-width: 767px) {
    .picker-body {
      flex-direction: column;
    }

    .mobile-filters {
      display: block;
    }
  }

  /* ===== Mobile Responsive ===== */
  @media (max-width: 520px) {
    .picker-header {
      padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    }

    .picker-header h2 {
      font-size: 1rem;
    }

    .source-toggle {
      display: none; /* Hide on mobile - too cramped */
    }

    .grid-container {
      padding: var(--spacing-sm, 8px);
    }
  }

</style>
