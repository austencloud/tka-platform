<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getBrowseThumbnailProvider } from "$lib/shared/browse/get-browse-thumbnail-provider";
  import { PinchZoomGridController } from "$lib/shared/browse/services/pinch-zoom-grid-controller";
  import { getSequenceOverlayState } from "$lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte";
  import { browseScrollState } from "$lib/shared/browse/state/browse-scroll-state.svelte";
  import BrowseThumbnailSkeleton from "$lib/shared/browse/components/BrowseThumbnailSkeleton.svelte";
  import type { BrowseThumbnailProvider } from "$lib/shared/browse/services/browse-thumbnail-provider";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { BrowseEngine } from "../engine/types";
  import BrowseToolbar from "./BrowseToolbar.svelte";
  import BrowseFilterBar from "./BrowseFilterBar.svelte";
  import BrowseSidebar from "./BrowseSidebar.svelte";
  import BrowseGrid from "./BrowseGrid.svelte";
  import type { SectionedGridApi } from "./SectionedVirtualGrid.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  interface Props {
    engine: BrowseEngine;
    layout: "fullpage" | "compact" | "minimal";
    onSelect?: (sequence: SequenceData, variations?: SequenceData[]) => void;
    showSidebar?: boolean;
    showToolbar?: boolean;
    showFilterBar?: boolean;
    showSourceToggle?: boolean;
    eager?: boolean;
    title?: string;
    /** Leading back pill inside the toolbar (e.g. "← Start here"). */
    onBack?: () => void;
    backLabel?: string;
    /** Hide the toolbar search when the host provides its own entry point. */
    hideToolbarSearch?: boolean;
    /** Picker hosts: ids to render with the selected outline (e.g. sequences
     * already in the collection being built). */
    selectedIds?: ReadonlySet<string>;
    /** Bottom-sheet filter pattern: Filters pill in the toolbar, applied-only
     * chips in the filter bar. The host owns the sheet. */
    onOpenFilters?: () => void;
  }

  let {
    engine,
    layout,
    onSelect,
    showSidebar: sidebarOverride,
    showToolbar: toolbarOverride,
    showFilterBar: filterBarOverride,
    showSourceToggle: sourceToggleOverride,
    eager: eagerOverride,
    title,
    onBack,
    backLabel,
    hideToolbarSearch = false,
    selectedIds,
    onOpenFilters,
  }: Props = $props();

  const showToolbar = $derived(toolbarOverride ?? (layout !== "minimal"));
  const showFilterBar = $derived(filterBarOverride ?? (layout !== "minimal"));
  const showSidebar = $derived(sidebarOverride ?? (layout === "fullpage"));
  const showSourceToggle = $derived(sourceToggleOverride ?? false);
  const isEager = $derived(eagerOverride ?? (layout !== "fullpage"));
  const disableVirtualization = $derived(layout === "minimal");

  let thumbnailService: BrowseThumbnailProvider | null = $state(null);
  let pinchController: PinchZoomGridController | null = null;
  let contentEl: HTMLElement | null = $state(null);
  let containerEl: HTMLElement | null = $state(null);
  let activeSection = $state<string | undefined>(undefined);
  // Set once the sectioned virtual grid mounts. When present, it owns
  // section-jump + active-section (the DOM-offset scan can't see off-screen,
  // virtualized headers).
  let sectionApi = $state<SectionedGridApi | null>(null);

  let showSkeleton = $state(true);
  let skeletonFading = $state(false);

  const isInitializing = $derived(engine.isLoading);
  const isEmpty = $derived(!isInitializing && !engine.error && engine.sequences.length === 0);
  const hasSequences = $derived(!isInitializing && !engine.error && engine.sequences.length > 0);

  const emptyMessage = $derived(
    engine.hasActiveFilters
      ? t('browse_no_sequences')
      : engine.source === "my-library"
        ? t('browse_no_sequences_saved')
        : t('browse_no_sequences_found')
  );

  $effect((): void | (() => void) => {
    if (isInitializing) { showSkeleton = true; skeletonFading = false; }
    else if (showSkeleton) {
      skeletonFading = true;
      const timer = setTimeout(() => { showSkeleton = false; skeletonFading = false; }, 300);
      return () => clearTimeout(timer);
    }
  });

  $effect(() => {
    const el = containerEl;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) engine.updateContainerWidth(w);
      }
    });
    ro.observe(el);
    requestAnimationFrame(() => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) engine.updateContainerWidth(w);
    });
    return () => ro.disconnect();
  });

  const SCROLL_THRESHOLD = 50;
  let cumulativeScrollDelta = 0;

  function handleWheel(ev: WheelEvent) {
    if (!ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    cumulativeScrollDelta += ev.deltaY;
    if (cumulativeScrollDelta > SCROLL_THRESHOLD) {
      engine.zoomIn();
      cumulativeScrollDelta = 0;
    } else if (cumulativeScrollDelta < -SCROLL_THRESHOLD) {
      engine.zoomOut();
      cumulativeScrollDelta = 0;
    }
  }

  $effect(() => {
    const el = contentEl;
    if (!el || layout === "minimal") return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  });

  function updateActiveSection() {
    // The sectioned virtual grid reports active section via onActiveSectionChange
    // (off-screen headers aren't in the DOM). Only scan the DOM for non-virtual
    // section layouts.
    if (sectionApi) return;
    if (!contentEl || !engine.sections.length) return;
    const scrollTop = contentEl.scrollTop;
    const sections = contentEl.querySelectorAll("[data-section]");
    let current: string | undefined;
    for (const el of sections) {
      const htmlEl = el as HTMLElement;
      if (htmlEl.offsetTop <= scrollTop + 100) current = htmlEl.dataset.section;
    }
    activeSection = current;
  }

  function scrollToSection(sectionTitle: string) {
    // Virtualized: delegate to the grid (target header may be unmounted).
    if (sectionApi) {
      sectionApi.scrollToSectionTitle(sectionTitle);
      return;
    }
    if (!contentEl) return;
    const el = contentEl.querySelector(`[data-section="${CSS.escape(sectionTitle)}"]`) as HTMLElement;
    if (!el) return;
    const containerRect = contentEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetScroll = elRect.top - containerRect.top + contentEl.scrollTop;
    contentEl.scrollTo({ top: targetScroll, behavior: "instant" });
  }

  const overlayState = getSequenceOverlayState();
  let wasOverlayOpen = false;

  $effect(() => {
    if (layout !== "fullpage") return;
    const isOpen = overlayState.isOpen;
    if (wasOverlayOpen && !isOpen && contentEl) {
      const savedScrollY = browseScrollState.lastScrollY;
      if (savedScrollY > 0) {
        requestAnimationFrame(() => contentEl?.scrollTo({ top: savedScrollY }));
      }
    }
    wasOverlayOpen = isOpen;
  });

  function handleScroll() {
    if (!contentEl) return;
    browseScrollState.updateScrollPosition(contentEl.scrollTop);
    updateActiveSection();
  }

  function handleAction(action: string, sequence: SequenceData, variations?: SequenceData[]) {
    if (action === "view-detail" && onSelect) {
      onSelect(sequence, variations);
    }
  }

  onMount(() => {
    thumbnailService = getBrowseThumbnailProvider();

    if (layout === "fullpage" && contentEl) {
      pinchController = new PinchZoomGridController();
      pinchController.setColumnCount(engine.columnCount);
      pinchController.setOnStateChange((state) => engine.setColumns(state.columns));
      pinchController.attach(contentEl);
    }
  });

  onDestroy(() => {
    pinchController?.detach();
    pinchController = null;
  });
</script>

<div class="browse-panel" class:fullpage={layout === "fullpage"} class:compact={layout === "compact"} class:minimal={layout === "minimal"} bind:this={containerEl}>
  {#if title}
    <div class="panel-title">
      <h3>{title}</h3>
    </div>
  {/if}

  {#if showToolbar}
    <BrowseToolbar
      {engine}
      showSourceToggle={showSourceToggle}
      {onBack}
      {backLabel}
      hideSearch={hideToolbarSearch}
      {onOpenFilters}
    />
  {/if}

  {#if showFilterBar}
    <BrowseFilterBar {engine} chipsOnly={!!onOpenFilters} />
  {/if}

  <div class="panel-content" bind:this={contentEl} onscroll={handleScroll}>
    {#if engine.error}
      <div class="error-state" role="alert">
        <p>{engine.error}</p>
        <button onclick={() => engine.refresh()}>Try again</button>
      </div>
    {:else if isEmpty}
      <div class="empty-state" role="status">
        <i class="fas {engine.hasActiveFilters ? 'fa-filter' : 'fa-inbox'} empty-icon" aria-hidden="true"></i>
        <p class="empty-message">{emptyMessage}</p>
        {#if engine.hasActiveFilters}
          <button class="clear-filters-btn" onclick={() => engine.clearUserFilters()}>
            <i class="fas fa-times" aria-hidden="true"></i>
            Clear all filters
          </button>
        {/if}
      </div>
    {:else}
      <div class="grid-with-sidebar">
        {#if showSidebar}
          <BrowseSidebar {engine} {activeSection} onScrollToSection={scrollToSection} />
        {/if}
        {#if hasSequences}
          <div class="grid-area">
            <BrowseGrid
              {engine}
              {thumbnailService}
              onAction={handleAction}
              {disableVirtualization}
              eager={isEager}
              {selectedIds}
              scrollElement={contentEl}
              onSectionGridReady={(api) => (sectionApi = api)}
              onActiveSectionChange={(title) => (activeSection = title)}
            />
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
  .browse-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    container-type: inline-size;
    container-name: gallery;
  }

  .panel-title {
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .panel-title h3 {
    margin: 0;
    font-size: var(--font-size-base, 16px);
    color: var(--theme-text, white);
  }

  .panel-content {
    position: relative;
    flex: 1;
    overflow-y: auto;
    container-type: inline-size;
    touch-action: pan-y;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .panel-content::-webkit-scrollbar { width: 6px; }
  .panel-content::-webkit-scrollbar-track { background: var(--scrollbar-track); }
  .panel-content::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }

  .grid-with-sidebar {
    display: flex;
    align-items: flex-start;
    gap: 0;
  }

  .grid-area {
    flex: 1;
    min-width: 0;
    padding: var(--spacing-lg);
  }

  .browse-panel.minimal .grid-area {
    padding: var(--spacing-sm);
  }

  /* Narrow containers: cards get the width, not the gutters. */
  @container gallery (max-width: 640px) {
    .grid-area {
      padding: var(--spacing-sm, 8px);
    }
  }

  .skeleton-overlay {
    position: absolute;
    inset: 0;
    padding: var(--spacing-lg);
    background: inherit;
    z-index: 1;
    opacity: 1;
    transition: opacity 300ms ease-out;
  }

  .skeleton-overlay.fading {
    opacity: 0;
    pointer-events: none;
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    gap: var(--spacing-md);
    color: var(--semantic-error);
  }

  .error-state p { margin: 0; text-align: center; }

  .error-state button {
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    border: 1px solid var(--semantic-error);
    border-radius: 6px;
    color: var(--semantic-error);
    cursor: pointer;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-xl, 24px);
    min-height: 200px;
    color: var(--theme-text-dim);
  }

  .empty-icon { font-size: 2rem; opacity: 0.5; margin-bottom: var(--spacing-sm, 8px); }
  .empty-message { margin: 0; font-size: var(--font-size-base, 16px); color: var(--theme-text, #ffffff); font-weight: 500; }

  .clear-filters-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    margin-top: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    font: inherit;
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-overlay, .clear-filters-btn { transition: none; }
  }
</style>
