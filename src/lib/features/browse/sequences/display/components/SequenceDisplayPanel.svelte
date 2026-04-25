<script lang="ts">
  import type { SequenceSection } from "./../../../shared/domain/models/browse-models.ts";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";
  import type { BrowseFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
  import type { SequenceFilterType } from "../../../shared/state/sequence-controls-state.svelte";
  import type { ActiveFilter } from "../../../shared/domain/models/multi-filter-models";
  import type { VirtualGridApi } from "./VirtualizedSequenceGrid.svelte";
  import { getBrowseThumbnailProvider } from "../getBrowseThumbnailProvider";
  import { onMount, onDestroy } from "svelte";
  import { getSequenceOverlayState } from "$lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte";
  import { browseScrollState } from "../../../shared/state/BrowseScrollState.svelte";
  import type { IBrowseThumbnailProvider } from "../services/contracts/IBrowseThumbnailProvider";
  import { PinchZoomGridController } from "../services/implementations/PinchZoomGridController";
  import BrowseGrid from "./BrowseGrid.svelte";
  import SectionIndexSidebar from "../../navigation/components/SectionIndexSidebar.svelte";
  import BrowseThumbnailSkeleton from "./BrowseThumbnailSkeleton.svelte";
  import SequenceTopBarControls from "../../../shared/components/SequenceTopBarControls.svelte";
  import InlineFilterPanel from "../../filtering/components/inline-filter/InlineFilterPanel.svelte";
  import ActiveFilterBar from "../../filtering/components/inline-filter/ActiveFilterBar.svelte";
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
    activeGridMode = null,
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
    sequenceSections = [],
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
    activeGridMode?: string | null;
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
    sequenceSections?: SequenceSection[];
  }>();

  const isInlineFiltersOpen = $derived(sequencePanelManager.isInlineFiltersOpen);

  let activeSection = $state<string | undefined>(undefined);

  const showSidebar = $derived(sequenceSections.length > 1);

  // Track active section by observing which section headers are in view.
  // Uses the scroll container's scroll position + section element offsets.
  function updateActiveSection() {
    if (!displayContentEl || !sequenceSections.length) return;
    const scrollTop = displayContentEl.scrollTop;
    const sections = displayContentEl.querySelectorAll("[data-section]");
    let current: string | undefined;
    for (const el of sections) {
      const htmlEl = el as HTMLElement;
      if (htmlEl.offsetTop <= scrollTop + 100) {
        current = htmlEl.dataset.section;
      }
    }
    activeSection = current;
  }

  // Scroll to a section by finding its DOM element and scrolling
  // the display-content container (not the viewport) to its position.
  function scrollToSection(sectionTitle: string) {
    if (!displayContentEl) return;
    const el = displayContentEl.querySelector(`[data-section="${CSS.escape(sectionTitle)}"]`) as HTMLElement;
    if (!el) return;

    // Calculate target position from current scroll position using
    // getBoundingClientRect — works regardless of current scroll.
    const containerRect = displayContentEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetScroll = elRect.top - containerRect.top + displayContentEl.scrollTop;
    displayContentEl.scrollTo({ top: targetScroll, behavior: "instant" });
  }

  let thumbnailService: IBrowseThumbnailProvider | null = $state(null);
  let pinchController: PinchZoomGridController | null = null;
  let displayContentEl: HTMLElement | null = $state(null);
  const pinchColumns = $derived(gridZoomManager.columns);
  const isTransitioning = $derived(gridZoomManager.isTransitioning);
  const isInitializing = $derived(isLoading || !sectionsReady);
  const isEmpty = $derived(!isInitializing && !error && sequences.length === 0);
  const hasSequences = $derived(!isInitializing && !error && sequences.length > 0);
  let showSkeleton = $state(true);
  let skeletonFading = $state(false);

  $effect((): void | (() => void) => {
    if (isInitializing) { showSkeleton = true; skeletonFading = false; }
    else if (showSkeleton) {
      skeletonFading = true;
      const timer = setTimeout(() => { showSkeleton = false; skeletonFading = false; }, 300);
      return () => clearTimeout(timer);
    }
  });

  const hasActiveFilters = $derived(activeFilterList.length > 0);

  const emptyMessage = $derived(
    hasActiveFilters
      ? t('browse_no_sequences')
      : source === "my-library"
        ? t('browse_no_sequences_saved')
        : t('browse_no_sequences_found')
  );

  const emptyHint = $derived(
    hasActiveFilters ? t('browse_try_different_filters') : null
  );

  function handleSequenceAction(action: string, sequence: SequenceData, variations?: SequenceData[]) {
    onAction(action, sequence, variations);
  }

  onMount(async () => {
    thumbnailService = getBrowseThumbnailProvider();
    gridZoomManager.initFromSettings();
    pinchController = new PinchZoomGridController();
    if (displayContentEl) {
      pinchController.setColumnCount(gridZoomManager.columns);
      pinchController.setOnStateChange((state) => { gridZoomManager.setColumns(state.columns); });
      pinchController.attach(displayContentEl);
    }
  });

  onDestroy(() => { pinchController?.detach(); pinchController = null; });

  const overlayState = getSequenceOverlayState();
  let wasOverlayOpen = false;
  $effect(() => {
    const isOpen = overlayState.isOpen;
    if (wasOverlayOpen && !isOpen && displayContentEl) {
      const savedScrollY = browseScrollState.lastScrollY;
      if (savedScrollY > 0) {
        requestAnimationFrame(() => { displayContentEl?.scrollTo({ top: savedScrollY }); });
      }
    }
    wasOverlayOpen = isOpen;
  });

  function handleRetry() { onAction("retry", {} as SequenceData); }

  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    if (onScroll) {
      onScroll(new CustomEvent("scroll", { detail: { scrollTop: target.scrollTop } }));
    }
    updateActiveSection();
  }
</script>

<div class="sequence-display-panel">
  <div class="gallery-controls-container">
    <SequenceTopBarControls {activeLevel} {activeLetter} {activeLength} activeLoopType={activeLoopType} {activeGridMode} {isFavoritesActive} {hasActivePositions} {availableLengths} {loopTypeCounts} {onFilterChange} {onRemoveFilter} {onOpenLetterSheet} {onOpenOptionsSheet} {getFilteredCount} />
  </div>

  {#if onFilterChange && onRemoveFilter && onOpenLetterSheet && onOpenOptionsSheet}
    <InlineFilterPanel isOpen={isInlineFiltersOpen} {activeLevel} {activeLetter} {activeLength} {activeLoopType} {activeGridMode} {isFavoritesActive} {hasActivePositions} {availableLengths} {loopTypeCounts} {onFilterChange} {onRemoveFilter} {onOpenLetterSheet} {onOpenOptionsSheet} {getFilteredCount} />
  {/if}

  {#if activeFilterList.length > 0 && onRemoveFilter && onClearAllFilters}
    <div class="active-filter-container">
      <ActiveFilterBar filters={activeFilterList} onRemoveFilter={onRemoveFilter} onClearAll={onClearAllFilters} />
    </div>
  {/if}

  <div class="display-content" bind:this={displayContentEl} onscroll={handleScroll}>
    {#if error}
      <div class="error-state" role="alert" aria-live="assertive">
        <p class="error-message">{error}</p>
        <button onclick={handleRetry}>{t('browse_try_again')}</button>
      </div>
    {:else if isEmpty}
      <div class="empty-state" role="status" aria-live="polite">
        <i class="fas {hasActiveFilters ? 'fa-filter' : 'fa-inbox'} empty-icon" aria-hidden="true"></i>
        <p class="empty-message">{emptyMessage}</p>
        {#if emptyHint}
          <p class="empty-hint">{emptyHint}</p>
        {/if}
        {#if hasActiveFilters && onClearAllFilters}
          <button class="clear-filters-btn" onclick={onClearAllFilters} type="button">
            <i class="fas fa-times" aria-hidden="true"></i>
            Clear all filters
          </button>
        {/if}
      </div>
    {:else}
      <div class="grid-with-sidebar">
        {#if showSidebar}
          <SectionIndexSidebar sections={sequenceSections} onScrollToSection={scrollToSection} {activeSection} />
        {/if}
        {#if hasSequences}
          <div class="grid-area">
            <BrowseGrid {sequences} {sections} viewMode="grid" {showSections} {thumbnailService} onAction={handleSequenceAction} {isTransitioning} />
          </div>
        {/if}
      </div>
      {#if showSkeleton}
        <div class="skeleton-overlay" class:fading={skeletonFading}>
          <BrowseThumbnailSkeleton count={12} />
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .sequence-display-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; container-type: inline-size; container-name: gallery; }
  .gallery-controls-container { flex-shrink: 0; border-bottom: 1px solid var(--theme-stroke); }
  .active-filter-container { flex-shrink: 0; padding: 4px 16px; border-bottom: 1px solid var(--theme-stroke); }
  .display-content { position: relative; flex: 1; overflow-y: auto; container-type: inline-size; touch-action: pan-y; scrollbar-width: thin; scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track); }
  .grid-with-sidebar { display: flex; align-items: flex-start; gap: 0; }
  .grid-area { flex: 1; min-width: 0; padding: var(--spacing-lg); }
  .skeleton-overlay { position: absolute; inset: 0; padding: var(--spacing-lg); background: inherit; z-index: 1; opacity: 1; transition: opacity 300ms ease-out; }
  .skeleton-overlay.fading { opacity: 0; pointer-events: none; }
  .display-content::-webkit-scrollbar { width: 6px; }
  .display-content::-webkit-scrollbar-track { background: var(--scrollbar-track); }
  .display-content::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
  .display-content::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }
  .error-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; gap: var(--spacing-md); color: var(--semantic-error); }
  .error-message { margin: 0; text-align: center; }
  .error-state button { padding: var(--spacing-sm) var(--spacing-md); background: color-mix(in srgb, var(--semantic-error) 20%, transparent); border: 1px solid var(--semantic-error); border-radius: 6px; color: var(--semantic-error); cursor: pointer; transition: all var(--duration-normal); }
  .error-state button:hover { background: color-mix(in srgb, var(--semantic-error) 30%, transparent); }
  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--spacing-sm, 8px); padding: var(--spacing-xl, 24px); min-height: 200px; color: var(--theme-text-dim); }
  .empty-icon { font-size: 2rem; opacity: 0.5; margin-bottom: var(--spacing-sm, 8px); }
  .empty-message { margin: 0; font-size: var(--font-size-base, 16px); color: var(--theme-text, #ffffff); font-weight: 500; }
  .empty-hint { margin: 0; font-size: var(--font-size-sm, 14px); color: var(--theme-text-dim, rgba(255, 255, 255, 0.6)); }
  .clear-filters-btn { display: inline-flex; align-items: center; gap: var(--spacing-xs, 4px); margin-top: var(--spacing-sm, 8px); padding: var(--spacing-sm, 8px) var(--spacing-md, 12px); background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent); border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1)); border-radius: 6px; color: var(--theme-text, #ffffff); font-size: var(--font-size-sm, 14px); cursor: pointer; transition: border-color 0.15s ease; font: inherit; }
  .clear-filters-btn:hover { border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15)); }
  .clear-filters-btn:focus-visible { outline: 2px solid var(--theme-accent, #6366f1); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .clear-filters-btn { transition: none; } }
</style>
