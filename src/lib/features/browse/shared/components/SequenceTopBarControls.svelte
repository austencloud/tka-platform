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
  import { t } from "$lib/shared/i18n/i18n.svelte";

  interface Props {
    onSourceChange?: (source: SequenceSource) => void;
    // These props are accepted for compatibility but filters are in the collapsible panel now
    activeLevel?: number | null;
    activeLetter?: string | null;
    activeLength?: number | null;
    activeLoopType?: string | null;
    activeGridMode?: string | null;
    isFavoritesActive?: boolean;
    hasActivePositions?: boolean;
    availableLengths?: number[];
    loopTypeCounts?: Record<string, number>;
    onFilterChange?: unknown;
    onRemoveFilter?: unknown;
    onOpenLetterSheet?: unknown;
    onOpenOptionsSheet?: unknown;
    getFilteredCount?: unknown;
  }

  let {
    onSourceChange,
    // Destructure to prevent Svelte "unknown prop" warnings
    activeLevel: _activeLevel,
    activeLetter: _activeLetter,
    activeLength: _activeLength,
    activeLoopType: _activeLoopType,
    activeGridMode: _activeGridMode,
    isFavoritesActive: _isFavoritesActive,
    hasActivePositions: _hasActivePositions,
    availableLengths: _availableLengths,
    loopTypeCounts: _loopTypeCounts,
    onFilterChange: _onFilterChange,
    onRemoveFilter: _onRemoveFilter,
    onOpenLetterSheet: _onOpenLetterSheet,
    onOpenOptionsSheet: _onOpenOptionsSheet,
    getFilteredCount: _getFilteredCount,
  }: Props = $props();

  // Source state
  const currentSource = $derived(sequenceSourceManager.current);
  const canViewMyLibrary = $derived(sequenceSourceManager.canViewMyLibrary);

  // Sequence controls from global reactive state
  const sequenceControls = $derived(sequenceControlsManager.current);

  // Inline filter panel state
  const isInlineFiltersOpen = $derived(sequencePanelManager.isInlineFiltersOpen);

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
    if (filter.type === "favorites") return t('browse_filter_favorites');
    if (filter.type === "difficulty") return t('browse_filter_level', { level: String(filter.value) });
    if (filter.type === "startingLetter") return t('browse_filter_letter', { letter: String(filter.value) });
    if (filter.type === "length") return t('browse_filter_steps', { count: String(filter.value) });
    if (filter.type === "startingPosition") return filter.value;
    if (filter.type === "contains_letters") return `"${filter.value}"`;
    return filter.type;
  });

  // Track if search is the active filter
  const isSearchFilter = $derived(
    sequenceControls?.currentFilter?.type === "contains_letters"
  );

  // Screen reader announcement for filter changes
  const filterAnnouncement = $derived.by(() => {
    if (!sequenceControls?.currentFilter) return "";
    const filter = sequenceControls.currentFilter;
    if (filter.type === "all") return t('browse_announce_all');
    if (filter.type === "favorites") return t('browse_announce_favorites');
    if (filter.type === "difficulty") return t('browse_announce_level', { level: String(filter.value) });
    if (filter.type === "startingLetter") return t('browse_announce_letter', { letter: String(filter.value) });
    if (filter.type === "length") return t('browse_announce_steps', { count: String(filter.value) });
    if (filter.type === "startingPosition") return t('browse_announce_position', { position: String(filter.value) });
    if (filter.type === "contains_letters") return t('browse_announce_search', { query: String(filter.value) });
    return t('browse_announce_filter_active', { type: filter.type });
  });

  // Source toggle options for SegmentedControl
  const sourceOptions = $derived.by(() => {
    const opts: { value: SequenceSource; label: string }[] = [
      { value: "community", label: t('browse_source_community') },
    ];
    if (canViewMyLibrary) {
      opts.push({ value: "my-library", label: t('browse_source_my_library') });
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

  function handleToggleFilters() {
    hapticService?.trigger("selection");
    sequencePanelManager.toggleInlineFilters();
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
  <!-- Screen reader announcement for filter/sort changes -->
  <div class="sr-only" aria-live="polite" aria-atomic="true">
    {filterAnnouncement}
  </div>

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

      <!-- Right actions: Search + Filter Button -->
      <div class="actions-section">
        <ExpandableSearchBar
          onSearch={handleSearch}
          onClear={handleSearchClear}
          placeholder={t('browse_search_placeholder')}
        />

        <!-- Filter Toggle Button -->
        <button
          class="filter-button"
          class:has-active={hasActiveFilter}
          class:panel-open={isInlineFiltersOpen}
          onclick={handleToggleFilters}
          type="button"
          aria-label={isInlineFiltersOpen ? t('browse_close_filters') : t('browse_open_filters')}
          aria-expanded={isInlineFiltersOpen}
        >
          <i class="fas fa-sliders-h" aria-hidden="true"></i>
          {#if hasActiveFilter && !isInlineFiltersOpen}
            <span class="filter-badge">{1}</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Visually hidden but accessible to screen readers */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

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

  /* Source toggle section — auto-sizes to content */
  .source-section {
    flex-shrink: 0;
  }

  /* Override SegmentedControl's width:100% so it sizes to content here */
  .source-section :global(.segmented-control) {
    width: auto;
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

  /* Zoom Controls — hidden on mobile where pinch-to-zoom is the
     natural interaction. Stepper buttons on small screens let users
     create unreadably small cards (the problem we're fixing). */
  /* Zoom controls removed — responsive breakpoints handle column count
     automatically. Pinch-to-zoom (touch) and Shift+scroll (desktop)
     remain as hidden power-user overrides. */

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

  .filter-button.panel-open {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    color: var(--theme-accent);
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

  /* Mobile: compact padding */
  @container (max-width: 640px) {
    .sequence-topbar-controls {
      padding: 8px 12px;
    }
  }

  /* Fallback for browsers without container query support */
  @media (max-width: 640px) {
    .sequence-topbar-controls {
      padding: 8px 12px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .filter-button,
    .filter-badge {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
