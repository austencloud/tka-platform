<!--
  SequencePickerModal.svelte - Sequence Selection Modal

  A focused modal for selecting sequences with modern inline filter chips,
  Greek letter search, and dismissible active filter indicators.
  Reuses BrowseGrid for rendering and browse filter components for UX parity.

  Props:
  - open: Control modal visibility
  - onClose: Callback when modal closes
  - onSelect: Callback when a sequence is selected (receives full sequence data)
  - requiredBeatCount: Lock to specific beat count (null = any length allowed)
  - title: Custom header title (default: "Select Sequence")
  - showSourceToggle: Show Community vs My Library toggle (default: true)
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IBrowseLoader } from "$lib/features/browse/sequences/display/services/contracts/IBrowseLoader";
  import type { IBrowseFilter } from "$lib/features/browse/sequences/display/services/contracts/IBrowseFilter";
  import type { IBrowseSorter } from "$lib/features/browse/sequences/display/services/contracts/IBrowseSorter";
  import type { IBrowseThumbnailProvider } from "$lib/features/browse/sequences/display/services/contracts/IBrowseThumbnailProvider";
  import { BrowseSortMethod } from "$lib/features/browse/shared/domain/enums/browse-enums";
  import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
  import type { ActiveFilter } from "$lib/features/browse/shared/domain/models/multi-filter-models";
  import { getBrowseLoader } from "$lib/features/browse/sequences/display/getBrowseLoader";
  import { getBrowseFilter } from "$lib/features/browse/sequences/display/getBrowseFilter";
  import { getBrowseSorter } from "$lib/features/browse/sequences/display/getBrowseSorter";
  import { getBrowseThumbnailProvider } from "$lib/features/browse/sequences/display/getBrowseThumbnailProvider";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import BrowseGrid from "$lib/features/browse/sequences/display/components/BrowseGrid.svelte";
  import PickerToolbar from "./PickerToolbar.svelte";
  import FilterChipRow from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipRow.svelte";
  import ActiveFilterBar from "$lib/features/browse/sequences/filtering/components/inline-filter/ActiveFilterBar.svelte";
  import LevelFilterChip from "$lib/features/browse/sequences/filtering/components/inline-filter/chips/LevelFilterChip.svelte";
  import FavoritesFilterChip from "$lib/features/browse/sequences/filtering/components/inline-filter/chips/FavoritesFilterChip.svelte";
  import LengthFilterChip from "$lib/features/browse/sequences/filtering/components/inline-filter/chips/LengthFilterChip.svelte";
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
  let lengthFilter = $state<number | null>(null);
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
    ev.preventDefault();

    cumulativeScrollDelta += ev.deltaY;

    if (cumulativeScrollDelta > SCROLL_THRESHOLD) {
      if (canZoomIn) columnCount++;
      cumulativeScrollDelta = 0;
    } else if (cumulativeScrollDelta < -SCROLL_THRESHOLD) {
      if (canZoomOut) columnCount--;
      cumulativeScrollDelta = 0;
    }
  }

  $effect(() => {
    const el = gridContainerRef;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  });

  // ===== Available Lengths (derived from loaded sequences) =====
  const availableLengths = $derived.by(() => {
    const lengths = new Set(
      sequences.map((s) => s.sequenceLength ?? s.steps?.length ?? 0)
    );
    return [...lengths].filter((l) => l > 0).sort((a, b) => a - b);
  });

  // ===== Filtering Pipeline =====
  const filteredSequences = $derived.by(() => {
    if (!filterService || !sorterService) return sequences;

    let result = sequences;

    // 1. Beat count (prop-locked, always first)
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

    // 4. Length filter (user-selected, only when not prop-locked)
    if (lengthFilter != null && requiredBeatCount == null) {
      result = filterService.applyFilter(
        result,
        BrowseFilterType.LENGTH,
        lengthFilter
      );
    }

    // 5. Search
    if (searchQuery.trim()) {
      result = filterService.applyFilter(
        result,
        BrowseFilterType.CONTAINS_LETTERS,
        searchQuery
      );
    }

    // 6. Sort
    return sorterService.sortSequences(result, currentSort);
  });

  // ===== Active Filter Tracking =====
  const activeFilterList = $derived.by(() => {
    const filters: ActiveFilter[] = [];
    if (levelFilter != null) {
      filters.push({
        type: BrowseFilterType.DIFFICULTY,
        value: levelFilter,
        label: `Level ${levelFilter}`,
        chipColor: "var(--semantic-info)",
      });
    }
    if (favoritesOnly) {
      filters.push({
        type: BrowseFilterType.FAVORITES,
        value: true,
        label: "Favorites",
        chipColor: "#ec4899",
      });
    }
    if (lengthFilter != null && requiredBeatCount == null) {
      filters.push({
        type: BrowseFilterType.LENGTH,
        value: lengthFilter,
        label: `${lengthFilter} beats`,
        chipColor: "#f59e0b",
      });
    }
    if (searchQuery.trim()) {
      filters.push({
        type: BrowseFilterType.CONTAINS_LETTERS,
        value: searchQuery,
        label: `"${searchQuery}"`,
        chipColor: "var(--theme-accent)",
      });
    }
    return filters;
  });

  const hasActiveFilters = $derived(activeFilterList.length > 0);

  // ===== Empty state detection =====
  const isEmptyDueToFilters = $derived(
    filteredSequences.length === 0 && sequences.length > 0 && hasActiveFilters
  );

  // ===== Service Initialization =====
  function initializeServices() {
    try {
      loaderService = getBrowseLoader() ?? null;
      filterService = getBrowseFilter() ?? null;
      sorterService = getBrowseSorter() ?? null;
      thumbnailService = getBrowseThumbnailProvider() ?? null;
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
    if (action !== "view-detail") return;

    if (!loaderService) {
      onSelect(sequence);
      onClose();
      return;
    }

    try {
      isSelectingSequence = true;

      const fullSequence = await loaderService.loadFullSequenceData(
        sequence.word || sequence.name || sequence.id
      );

      if (fullSequence) {
        onSelect(fullSequence);
      } else {
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

  // ===== Filter Handlers =====
  function handleSortChange(method: BrowseSortMethod) {
    currentSort = method;
  }

  function handleSearchChange(query: string) {
    searchQuery = query;
  }

  function handleLevelSelect(level: number | null) {
    levelFilter = level;
  }

  function handleFavoritesToggle(active: boolean) {
    favoritesOnly = active;
  }

  function handleLengthSelect(length: number | null) {
    lengthFilter = length;
  }

  function handleRemoveFilter(type: string) {
    if (type === BrowseFilterType.DIFFICULTY) levelFilter = null;
    else if (type === BrowseFilterType.FAVORITES) favoritesOnly = false;
    else if (type === BrowseFilterType.LENGTH) lengthFilter = null;
    else if (type === BrowseFilterType.CONTAINS_LETTERS) searchQuery = "";
  }

  function handleClearAllFilters() {
    levelFilter = null;
    favoritesOnly = false;
    lengthFilter = null;
    searchQuery = "";
  }

  // ===== Lifecycle =====
  onMount(() => {
    initializeServices();
    if (loaderService) {
      loadSequences();
    }
  });

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

    <!-- Toolbar: Sort, Search, Zoom -->
    <PickerToolbar
      {currentSort}
      {columnCount}
      {canZoomIn}
      {canZoomOut}
      searchQuery={searchQuery}
      resultCount={filteredSequences.length}
      onSearchChange={handleSearchChange}
      onSortChange={handleSortChange}
      onZoomIn={increaseColumns}
      onZoomOut={decreaseColumns}
    />

    <!-- Filter Chips -->
    <div class="filter-panel">
      <FilterChipRow>
        <LevelFilterChip
          activeLevel={levelFilter}
          onSelect={handleLevelSelect}
        />
        <FavoritesFilterChip
          active={favoritesOnly}
          onToggle={handleFavoritesToggle}
        />
        {#if requiredBeatCount != null}
          <!-- Locked length: show as disabled chip with the required count -->
          <LengthFilterChip
            activeLength={requiredBeatCount}
            {availableLengths}
            onSelect={() => {}}
            disabled
          />
        {:else}
          <LengthFilterChip
            activeLength={lengthFilter}
            {availableLengths}
            onSelect={handleLengthSelect}
          />
        {/if}
      </FilterChipRow>

      <ActiveFilterBar
        filters={activeFilterList}
        onRemoveFilter={handleRemoveFilter}
        onClearAll={handleClearAllFilters}
      />
    </div>

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
          <p>No sequences in your library. Create some first in the Create module.</p>
        </div>
      {:else if filteredSequences.length === 0}
        <div class="state-container empty">
          <i class="fas fa-search" aria-hidden="true"></i>
          <p>No sequences match your filters</p>
          {#if hasActiveFilters}
            <button onclick={handleClearAllFilters}>Clear Filters</button>
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
</BaseModal>

<style>
  /* ===== Modal Width Override ===== */
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
    transition: all var(--duration-fast, 150ms) ease;
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
    transition: all var(--duration-fast, 150ms) ease;
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

  /* ===== Filter Panel ===== */
  .filter-panel {
    container-type: inline-size;
    container-name: inline-filter;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
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
    transition: all var(--duration-fast, 150ms) ease;
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

  /* ===== Mobile Responsive ===== */
  @media (max-width: 520px) {
    .picker-header {
      padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    }

    .picker-header h2 {
      font-size: 1rem;
    }

    .source-toggle {
      display: none;
    }

    .grid-container {
      padding: var(--spacing-sm, 8px);
    }

    .filter-panel {
      padding: 6px 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .source-btn,
    .close-btn,
    .state-container button {
      transition: none;
    }
  }
</style>
