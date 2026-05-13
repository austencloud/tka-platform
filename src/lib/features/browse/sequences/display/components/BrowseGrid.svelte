<script lang="ts">

import { getSequenceDataProvider } from "$lib/shared/sequence-viewer/getSequenceDataProvider";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { slide } from "svelte/transition";
  import { onMount, onDestroy } from "svelte";
  import type { BrowseThumbnailProvider } from "$lib/shared/browse/services/BrowseThumbnailProvider";
  import type { VariationGrouper } from "$lib/shared/browse/services/VariationGrouper";
  import ChoreoCardThumbnail from "$lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import SectionHeader from "$lib/shared/browse/components/SectionHeader.svelte";
  import VirtualizedSequenceGrid, {
    type VirtualGridApi,
  } from "$lib/shared/browse/components/VirtualizedSequenceGrid.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { isCatDogMode } from "$lib/shared/browse/utils/prop-mode-helpers";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { getVariationGrouper } from "$lib/shared/browse/getVariationGrouper";
  import { gridZoomManager } from "../../../shared/state/grid-zoom-state.svelte";

  /**
   * 🚀 PERFORMANCE: Virtualization threshold
   * Lists with more than this many items use virtual scrolling
   * to avoid rendering 100+ DOM nodes at once.
   * Below this threshold, we use simple CSS transitions for smooth animations.
   */
  const VIRTUALIZATION_THRESHOLD = 50;

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const {
    sequences = [],
    sections = [],
    viewMode = "grid",
    thumbnailService,
    showSections = false,
    onAction = () => {},
    pinchColumnOverride,
    isTransitioning = false,
    disableVirtualization = false,
    eager = false,
    onGridReady,
  } = $props<{
    sequences?: SequenceData[];
    sections?: SequenceData[];
    viewMode?: "grid" | "list";
    thumbnailService: BrowseThumbnailProvider | null;
    showSections?: boolean;
    onAction?: (action: string, sequence: SequenceData, variations?: SequenceData[]) => void;
    /** Pinch-to-zoom column override. Mobile: 2-3, Desktop: 2-5. */
    pinchColumnOverride?: number;
    /** True for ~200ms after column change (for CSS transition timing) */
    isTransitioning?: boolean;
    /** Force flat grid rendering (skip virtualization). Use in modals/pickers. */
    disableVirtualization?: boolean;
    /** Skip lazy loading - load thumbnails immediately (use in modals/pickers) */
    eager?: boolean;
    /** Callback when the virtualized grid is ready (exposes scroll API for sidebar) */
    onGridReady?: (api: VirtualGridApi) => void;
  }>();

  const useVirtualization = $derived(
    !disableVirtualization &&
      sequences.length > VIRTUALIZATION_THRESHOLD &&
      viewMode === "grid"
  );

  // Variation grouper service for identifying sequences with same word
  const variationGrouper = getVariationGrouper();

  // Build variation map when sequences change
  const variationMap = $derived.by(() => {
    return variationGrouper.buildVariationMap(sequences);
  });

  // Get variations for a specific sequence
  function getVariationsForSequence(sequence: SequenceData): SequenceData[] {
    const word = sequence.word || sequence.name;
    if (!word) return [sequence];
    return variationMap.get(word.trim()) ?? [sequence];
  }

  // Get user's prop settings for prop-aware thumbnails
  const propSettings = $derived({
    bluePropType: settingsService.settings.bluePropType,
    redPropType: settingsService.settings.redPropType,
    catDogMode: settingsService.settings.catDogMode,
  });

  // Determine if we're in cat-dog mode (different props per hand)
  const isCatDog = $derived(
    isCatDogMode(
      propSettings.bluePropType,
      propSettings.redPropType,
      propSettings.catDogMode
    )
  );

  // Get light mode from visibility state (inverse of darkMode)
  // darkMode= true means dark mode, lightMode = true means light background
  const visibilityManager = getAnimationVisibilityManager();

  // Use $state to track lightMode so UI updates when it changes
  let lightMode = $state(!visibilityManager.isDarkMode());

  // Register observer to react to visibility changes (like "L" key toggle)
  function handleVisibilityChange() {
    lightMode = !visibilityManager.isDarkMode();
  }

  visibilityManager.registerObserver(handleVisibilityChange);

  onDestroy(() => {
    visibilityManager.unregisterObserver(handleVisibilityChange);
  });

  // Grid element refs
  let sectionGridRefs = $state<HTMLElement[]>([]);
  let flatGridRef = $state<HTMLElement | undefined>(undefined);
  let containerRef = $state<HTMLElement | undefined>(undefined);

  // Track container width to control column count
  let containerWidth = $state(0);

  const columnCount = $derived.by(() => {
    // Default to 2 until we've measured the container
    if (containerWidth === 0) return 2;

    // When zoom override is active (pinch or stepper), use the override
    // directly — the caller already clamps to its own min/max range.
    // Only guard against absurdly small containers (< 480px → max 2).
    if (pinchColumnOverride !== undefined) {
      const localMax = containerWidth < 480 ? 2 : containerWidth < 800 ? 3 : 8;
      return Math.max(2, Math.min(localMax, pinchColumnOverride));
    }

    // Responsive defaults when no override is set
    if (containerWidth >= 1400) return 5;
    if (containerWidth >= 1000) return 4;
    if (containerWidth >= 600) return 3;
    return 2;
  });

  // Reactive ResizeObserver - re-creates when containerRef becomes available.
  // This solves the timing issue where onMount fires before bind:this populates the ref.
  $effect(() => {
    const target = containerRef;
    if (!target) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        if (newWidth > 0) {
          containerWidth = newWidth;
          gridZoomManager.updateContainerWidth(newWidth);
        }
      }
    });

    resizeObserver.observe(target);

    // Initial measurement
    requestAnimationFrame(() => {
      const width = target.getBoundingClientRect().width;
      if (width > 0) {
        containerWidth = width;
        gridZoomManager.updateContainerWidth(width);
      }
    });

    return () => resizeObserver.disconnect();
  });

  onMount(() => {
    // Window resize fallback
    const handleResize = () => {
      if (containerRef) {
        const width = containerRef.getBoundingClientRect().width;
        if (width > 0) {
          containerWidth = width;
        }
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  });

  // Handle sequence actions (pass variations for view-detail)
  function handleSequenceAction(
    action: string,
    sequence: SequenceData,
    variations?: SequenceData[]
  ) {
    onAction(action, sequence, variations);
  }

  // Hover prefetch for non-virtualized cards
  const sequenceDataProvider = getSequenceDataProvider();

  function handleSequenceHover(seq: SequenceData) {
    sequenceDataProvider.prefetch(seq);
  }

</script>

<div bind:this={containerRef}>
{#if useVirtualization}
  <!-- 🚀 VIRTUALIZED: Large flat list with 50+ items -->
  <VirtualizedSequenceGrid {sequences} {thumbnailService} {onAction} {pinchColumnOverride} {onGridReady} />
{:else if showSections && sections.length > 0}
  <!-- Section-based organization (desktop app style) -->
  <div class="sections-container">
    {#each sections as section, sectionIndex (section.id)}
      <div class="sequence-section" data-section={section.title}>
        <SectionHeader title={section.title} />

        {#if section.sequences.length > 0}
          <div
            bind:this={sectionGridRefs[sectionIndex]}
            class="sequences-grid"
            class:list-view={viewMode === "list"}
            class:grid-view={viewMode === "grid"}
            class:is-transitioning={isTransitioning}
            style:grid-template-columns={viewMode === "grid"
              ? `repeat(${Math.min(columnCount, section.sequences.length)}, 1fr)`
              : undefined}
            style:max-width={viewMode === "grid" && section.sequences.length < columnCount
              ? `${(section.sequences.length / columnCount) * 100}%`
              : undefined}
          >
            {#each section.sequences as sequence (sequence.id)}
              {@const seqVariations = getVariationsForSequence(sequence)}
              <ChoreoCardThumbnail
                {sequence}
                variations={seqVariations}
                onPrimaryAction={(seq) =>
                  handleSequenceAction("view-detail", seq, seqVariations)}
                onHover={handleSequenceHover}
                bluePropType={propSettings.bluePropType}
                redPropType={propSettings.redPropType}
                catDogModeEnabled={isCatDog}
                {lightMode}
                {eager}
              />
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{:else if sequences.length > 0}
  <!-- Flat organization (fallback) -->
  <div
    bind:this={flatGridRef}
    class="sequences-grid"
    class:list-view={viewMode === "list"}
    class:grid-view={viewMode === "grid"}
    class:is-transitioning={isTransitioning}
    style:grid-template-columns={viewMode === "grid"
      ? `repeat(${columnCount}, 1fr)`
      : undefined}
    transition:slide={{ duration: 300 }}
  >
    {#each sequences as sequence (sequence.id)}
      {@const seqVariations = getVariationsForSequence(sequence)}
      <ChoreoCardThumbnail
        {sequence}
        variations={seqVariations}
        onPrimaryAction={(seq) =>
          handleSequenceAction("view-detail", seq, seqVariations)}
        onHover={handleSequenceHover}
        bluePropType={propSettings.bluePropType}
        redPropType={propSettings.redPropType}
        catDogModeEnabled={isCatDog}
        {lightMode}
        {eager}
      />
    {/each}
  </div>
{/if}
</div>

<style>
  /* Sections container for organized display */
  .sections-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .sequence-section {
    display: flex;
    flex-direction: column;
  }

  /* Responsive grid that adapts to container width */
  /* Column count controlled via JavaScript for pinch-to-zoom support */
  .sequences-grid.grid-view {
    display: grid;
    /* grid-template-columns set via inline style */
    gap: var(--spacing-sm); /* Compact gap - pictures are the focus */
    /* Let cards determine their own height via aspect-ratio */
    align-items: start;
  }

  /* Smooth gap transition when columns change (iOS Photos style) */
  .sequences-grid.grid-view.is-transitioning {
    transition: gap 200ms ease-out;
  }

  .sequences-grid.list-view {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--spacing-sm);
  }
</style>
