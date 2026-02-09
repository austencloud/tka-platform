<!--
  Sequence Top Bar Controls - 2026 Modern Design
  - Source toggle via SegmentedControl (sliding indicator)
  - Sort popover (compact chip, spring-animated dropdown)
  - Expandable search bar
  - Zoom controls (desktop only, mobile via filter drawer)
  - Filter button with active badge
  - Micro-interactions: hover lift, active press, spring animations
-->
<script lang="ts">
  import { sequenceControlsManager } from "../state/sequence-controls-state.svelte";
  import { sequencePanelManager } from "../state/sequence-panel-state.svelte";
  import { sequenceSourceManager, type SequenceSource } from "../state/sequence-source-state.svelte";
  import { gridZoomManager } from "../state/grid-zoom-state.svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { BrowseSortMethod } from "../domain/enums/browse-enums";
  import ExpandableSearchBar from "./ExpandableSearchBar.svelte";
  import SortPopover from "./SortPopover.svelte";
  import SegmentedControl from "$lib/shared/3d-animation/components/controls/SegmentedControl.svelte";

  interface Props {
    onSourceChange?: (source: SequenceSource) => void;
  }

  let { onSourceChange }: Props = $props();

  // Source state
  const currentSource = $derived(sequenceSourceManager.current);
  const canViewMyLibrary = $derived(sequenceSourceManager.canViewMyLibrary);

  // Sequence controls from global reactive state
  const sequenceControls = $derived(sequenceControlsManager.current);

  // Filter panel state
  const isFilterPanelOpen = $derived(sequencePanelManager.isFiltersOpen);

  // Grid zoom state (desktop only)
  const currentColumns = $derived(gridZoomManager.columns);
  const canZoomIn = $derived(gridZoomManager.canZoomIn);
  const canZoomOut = $derived(gridZoomManager.canZoomOut);

  // Services
  let hapticService: IHapticFeedback | null = null;

  // Active filter detection
  const hasActiveFilter = $derived(
    sequenceControls?.currentFilter?.type !== "all"
  );

  // Active filter label
  const activeFilterLabel = $derived.by(() => {
    if (!sequenceControls?.currentFilter) return null;
    const filter = sequenceControls.currentFilter;
    if (filter.type === "all") return null;
    if (filter.type === "favorites") return "Favorites";
    if (filter.type === "difficulty") return `Level ${filter.value}`;
    if (filter.type === "startingLetter") return `Letter ${filter.value}`;
    if (filter.type === "length") return `${filter.value} steps`;
    if (filter.type === "startingPosition") return filter.value;
    if (filter.type === "contains_letters") return `"${filter.value}"`;
    return filter.type;
  });

  // Track if search is the active filter
  const isSearchFilter = $derived(
    sequenceControls?.currentFilter?.type === "contains_letters"
  );

  // Source toggle options for SegmentedControl
  const sourceOptions = $derived.by(() => {
    const opts: { value: SequenceSource; label: string }[] = [
      { value: "community", label: "Community" },
    ];
    if (canViewMyLibrary) {
      opts.push({ value: "my-library", label: "My Library" });
    }
    return opts;
  });

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  function handleSourceChange(source: SequenceSource) {
    hapticService?.trigger("selection");
    sequenceSourceManager.setSource(source);
    onSourceChange?.(source);
  }

  function handleSortChange(method: BrowseSortMethod) {
    hapticService?.trigger("selection");
    if (sequenceControls) {
      sequenceControls.onSortMethodChange(method);
    }
  }

  function handleOpenFilters() {
    hapticService?.trigger("selection");
    sequencePanelManager.openFilters();
  }

  function handleClearFilter() {
    hapticService?.trigger("selection");
    if (sequenceControls) {
      sequenceControls.onFilterChange({ type: "all", value: null });
    }
  }

  function handleZoomIn() {
    hapticService?.trigger("selection");
    gridZoomManager.zoomIn();
  }

  function handleZoomOut() {
    hapticService?.trigger("selection");
    gridZoomManager.zoomOut();
  }

  function handleSearch(query: string) {
    if (!sequenceControls) return;
    if (query.trim()) {
      sequenceControls.onFilterChange({
        type: "contains_letters",
        value: query.trim(),
      });
    } else {
      sequenceControls.onFilterChange({ type: "all", value: null });
    }
  }

  function handleSearchClear() {
    hapticService?.trigger("selection");
    if (sequenceControls) {
      sequenceControls.onFilterChange({ type: "all", value: null });
    }
  }
</script>

{#if sequenceControls}
  <div class="sequence-topbar-controls">
    <div class="controls-row">
      <!-- Source toggle: SegmentedControl with sliding indicator -->
      <div class="source-section">
        <SegmentedControl
          options={sourceOptions}
          value={currentSource}
          onchange={handleSourceChange}
          color="accent"
          size="sm"
        />
      </div>

      <!-- Sort: compact popover chip -->
      <SortPopover
        currentMethod={sequenceControls.currentSortMethod}
        onSortChange={handleSortChange}
      />

      <!-- Right actions: Search + Zoom + Active Filter + Filter Button -->
      <div class="actions-section">
        <ExpandableSearchBar
          onSearch={handleSearch}
          onClear={handleSearchClear}
          placeholder="Search sequences..."
        />

        <!-- Grid Zoom Controls (desktop only) -->
        <div class="zoom-controls">
          <button
            class="zoom-button"
            onclick={handleZoomOut}
            disabled={!canZoomOut}
            type="button"
            aria-label="Zoom out (larger cards)"
            title="Larger cards"
          >
            <i class="fas fa-minus" aria-hidden="true"></i>
          </button>
          <span class="zoom-indicator">{currentColumns}</span>
          <button
            class="zoom-button"
            onclick={handleZoomIn}
            disabled={!canZoomIn}
            type="button"
            aria-label="Zoom in (smaller cards)"
            title="Smaller cards"
          >
            <i class="fas fa-plus" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Active Filter chip (not shown for search filters) -->
        {#if hasActiveFilter && activeFilterLabel && !isSearchFilter}
          <button class="active-filter-chip" onclick={handleClearFilter}>
            <span>{activeFilterLabel}</span>
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        {/if}

        <!-- Filter Button (hidden when panel is open) -->
        {#if !isFilterPanelOpen}
          <button
            class="filter-button"
            class:has-active={hasActiveFilter}
            onclick={handleOpenFilters}
            type="button"
            aria-label="Open filters"
          >
            <i class="fas fa-sliders-h" aria-hidden="true"></i>
            {#if hasActiveFilter}
              <span class="filter-badge">1</span>
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .sequence-topbar-controls {
    --control-height: var(--min-touch-target, 48px);

    display: flex;
    align-items: center;
    padding: 10px 16px;
    background: var(--theme-panel-bg);
    width: 100%;
    min-height: calc(var(--control-height) + 20px);
  }

  /* Single-row flexbox layout — no absolute centering */
  .controls-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  /* Source toggle section — constrained width */
  .source-section {
    flex-shrink: 0;
    width: clamp(120px, 22vw, 220px);
  }

  /* Right actions — search, zoom, filter */
  .actions-section {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  /* Zoom Controls */
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    padding: 2px;
    flex-shrink: 0;
  }

  .zoom-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
  }

  .zoom-button:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .zoom-button:active:not(:disabled) {
    transform: scale(0.92);
  }

  .zoom-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .zoom-indicator {
    min-width: 20px;
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim);
    font-variant-numeric: tabular-nums;
  }

  /* Active Filter Chip */
  .active-filter-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px 0 16px;
    min-height: var(--control-height);
    background: color-mix(in srgb, var(--semantic-info) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-info) 30%, transparent);
    border-radius: 100px;
    color: var(--semantic-info);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .active-filter-chip:hover {
    background: color-mix(in srgb, var(--semantic-info) 25%, transparent);
  }

  .active-filter-chip:active {
    transform: scale(0.97);
  }

  .active-filter-chip i {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.8;
  }

  /* Filter Button */
  .filter-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--control-height);
    height: var(--control-height);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-base, 16px);
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
    flex-shrink: 0;
  }

  .filter-button:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
    border-color: var(--theme-stroke-strong);
  }

  .filter-button:active {
    transform: scale(0.95);
  }

  .filter-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .filter-button.has-active {
    background: color-mix(in srgb, var(--semantic-info) 15%, transparent);
    border-color: color-mix(in srgb, var(--semantic-info) 30%, transparent);
    color: var(--semantic-info);
  }

  .filter-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--semantic-info);
    border-radius: 50%;
    color: var(--theme-text);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    animation: badgePop 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes badgePop {
    0% {
      transform: scale(0);
    }
    60% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
    }
  }

  /* Mobile: hide zoom controls (available in filter drawer) */
  @container (max-width: 640px) {
    .zoom-controls {
      display: none;
    }

    .sequence-topbar-controls {
      padding: 8px 12px;
    }

    .source-section {
      width: clamp(100px, 30vw, 180px);
    }
  }

  /* Fallback for browsers without container query support */
  @media (max-width: 640px) {
    .zoom-controls {
      display: none;
    }

    .sequence-topbar-controls {
      padding: 8px 12px;
    }

    .source-section {
      width: clamp(100px, 30vw, 180px);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .filter-button,
    .filter-badge,
    .active-filter-chip,
    .zoom-button {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
