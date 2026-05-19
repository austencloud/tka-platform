<script lang="ts">

import { getSequenceDataProvider } from "$lib/shared/sequence-viewer/getSequenceDataProvider";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import {
    createVirtualizer,
    type VirtualItem,
    type SvelteVirtualizer,
  } from "@tanstack/svelte-virtual";
  import type { Readable } from "svelte/store";
  import { onMount, onDestroy, untrack } from "svelte";
  import type { BrowseThumbnailProvider } from "$lib/shared/browse/services/BrowseThumbnailProvider";
  import ChoreoCardThumbnail from "$lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { isCatDogMode } from "$lib/shared/browse/utils/prop-mode-helpers";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { getVariationGrouper } from "$lib/shared/browse/getVariationGrouper";
  import { calculateGalleryAspectRatio } from "$lib/shared/render/services/layout-calculator";
  import { cellPreWarmer } from "$lib/shared/sequence-viewer/services/implementations/CellPreWarmer";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";


  /**
   * The virtualizer needs to know each row's height before it renders.
   * The old code sampled ONE sequence and assumed all rows were the same height.
   * Cards with different beat counts have different aspect ratios, so that
   * caused overlap. Now we estimate per-row using the tallest card in the row,
   * then correct with measureElement after the DOM renders.
   */

  export interface VirtualGridApi {
    scrollToSequenceIndex: (index: number) => void;
    subscribeToScroll: (callback: () => void) => () => void;
    getFirstVisibleSequenceIndex: () => number;
  }

  const {
    sequences = [],
    thumbnailService,
    onAction = () => {},
    pinchColumnOverride,
    onGridReady,
    handPathMode = false,
    showBlueMotion = true,
    showRedMotion = true,
    addWord,
    addDifficultyLevel,
  } = $props<{
    sequences: SequenceData[];
    thumbnailService: BrowseThumbnailProvider | null;
    onAction?: (action: string, sequence: SequenceData, variations?: SequenceData[]) => void;
    pinchColumnOverride?: number;
    onGridReady?: (api: VirtualGridApi) => void;
    handPathMode?: boolean;
    /** Show blue motion (prop + arrow) in thumbnails. Default: true */
    showBlueMotion?: boolean;
    /** Show red motion (prop + arrow) in thumbnails. Default: true */
    showRedMotion?: boolean;
    addWord?: boolean;
    addDifficultyLevel?: boolean;
  }>();

  const variationGrouper = getVariationGrouper();
  const sequenceDataProvider = getSequenceDataProvider();
  const compositionManager = getImageCompositionManager();

  const variationMap = $derived.by(() => {
    return variationGrouper.buildVariationMap(sequences);
  });

  function getVariationsForSequence(sequence: SequenceData): SequenceData[] {
    const word = sequence.word || sequence.name;
    if (!word) return [sequence];
    return variationMap.get(word.trim()) ?? [sequence];
  }

  const propSettings = $derived({
    bluePropType: settingsService.settings.bluePropType,
    redPropType: settingsService.settings.redPropType,
    catDogMode: settingsService.settings.catDogMode,
  });

  const isCatDog = $derived(
    isCatDogMode(
      propSettings.bluePropType,
      propSettings.redPropType,
      propSettings.catDogMode
    )
  );

  const visibilityManager = getAnimationVisibilityManager();
  let lightMode = $state(!visibilityManager.isDarkMode());

  function handleVisibilityChange() {
    lightMode = !visibilityManager.isDarkMode();
  }

  visibilityManager.registerObserver(handleVisibilityChange);

  onDestroy(() => {
    visibilityManager.unregisterObserver(handleVisibilityChange);
  });

  let scrollElement = $state<HTMLDivElement | null>(null);
  let containerWidth = $state(0);

  let virtualRows = $state<VirtualItem[]>([]);
  let totalHeight = $state(0);

  const columnCount = $derived.by(() => {
    if (containerWidth === 0) return 2;

    if (pinchColumnOverride !== undefined) {
      const maxForWidth = containerWidth < 480 ? 2 : containerWidth < 800 ? 3 : containerWidth < 1200 ? 4 : 5;
      return Math.max(2, Math.min(maxForWidth, pinchColumnOverride));
    }

    if (containerWidth >= 1400) return 5;
    if (containerWidth >= 1000) return 4;
    if (containerWidth >= 600) return 3;
    return 2;
  });

  const rowCount = $derived(Math.ceil(sequences.length / columnCount));

  // Per-row height estimation: use the tallest card in each row.
  // This is the key fix for the overlap bug - the old code used a single
  // sample which broke when rows had mixed beat counts.
  // Row height = tallest card in the row. The virtualizer's `gap: 16` option
  // adds spacing between rows separately, so we don't add it here.
  function estimateRowHeight(rowIndex: number): number {
    if (containerWidth === 0) return 200;
    const colGap = 16;
    const cardWidth = (containerWidth - (columnCount - 1) * colGap) / columnCount;

    const startIdx = rowIndex * columnCount;
    const endIdx = Math.min(startIdx + columnCount, sequences.length);
    let maxSteps = 4;
    for (let i = startIdx; i < endIdx; i++) {
      const seq = sequences[i];
      const steps = seq?.steps?.length || seq?.sequenceLength || 4;
      if (steps > maxSteps) maxSteps = steps;
    }

    const aspectRatio = calculateGalleryAspectRatio(maxSteps, compositionManager.startPositionLayout);
    return cardWidth / aspectRatio;
  }

  function getRowSequences(rowIndex: number): SequenceData[] {
    const startIndex = rowIndex * columnCount;
    const endIndex = Math.min(startIndex + columnCount, sequences.length);
    return sequences.slice(startIndex, endIndex);
  }

  function handleSequenceAction(
    action: string,
    sequence: SequenceData,
    variations?: SequenceData[]
  ) {
    onAction(action, sequence, variations);
  }

  function handleSequenceHover(seq: SequenceData) {
    cellPreWarmer.preWarmSequence(seq, "user-visible");
    sequenceDataProvider.prefetch(seq);
  }

  // Single virtualizer instance - created once, recreated when deps change.
  // Uses per-row estimateSize for accurate initial layout, plus measureElement
  // for pixel-perfect correction after render.
  type VirtualizerInstance = SvelteVirtualizer<HTMLDivElement, Element>;
  type VirtualizerStore = Readable<VirtualizerInstance>;

  let currentVirtualizer: VirtualizerInstance | null = null;
  let virtualizerStore: VirtualizerStore | null = null;
  let storeUnsub: (() => void) | null = null;

  function createAndSubscribe(count: number) {
    // Clean up previous
    storeUnsub?.();

    if (!scrollElement) return;

    virtualizerStore = createVirtualizer({
      count,
      getScrollElement: () => scrollElement,
      estimateSize: estimateRowHeight,
      overscan: 3,
      gap: 16,
    });

    storeUnsub = virtualizerStore.subscribe((v) => {
      currentVirtualizer = v;
      virtualRows = v.getVirtualItems();
      totalHeight = v.getTotalSize();
    });
  }

  // Svelte action: measures each row's actual DOM height after render.
  // TanStack Virtual reads data-index from the element to know which row it is.
  function measureRow(node: HTMLElement) {
    if (currentVirtualizer) {
      currentVirtualizer.measureElement(node);
    }
  }

  // Scroll event listeners for the sidebar
  let scrollListeners = new Set<() => void>();
  let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;

  function handleScrollEvent() {
    // Cancel background pre-warming during active scroll to free main thread
    cellPreWarmer.cancelAll();
    if (preWarmTimer) {
      clearTimeout(preWarmTimer);
      preWarmTimer = null;
    }

    // Restart pre-warming after scroll settles
    if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
    scrollIdleTimer = setTimeout(() => {
      scrollIdleTimer = null;
      const rows = virtualRows;
      for (const row of rows) {
        const rowSequences = getRowSequences(row.index);
        for (const seq of rowSequences) {
          cellPreWarmer.preWarmSequence(seq, "background");
        }
      }
    }, 200);

    for (const cb of scrollListeners) cb();
  }

  onMount(() => {
    if (!scrollElement) return;

    createAndSubscribe(rowCount);

    // ResizeObserver for responsive column count — debounced to prevent
    // cascading remeasurements on iOS (address bar show/hide triggers
    // rapid resize events that freeze mobile devices).
    let resizeRaf: number | null = null;
    const resizeObserver = new ResizeObserver((entries) => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        for (const entry of entries) {
          const width = entry.contentRect.width;
          if (width > 0 && Math.abs(width - containerWidth) > 1) {
            containerWidth = width;
            gridZoomManager.updateContainerWidth(width);
            if (currentVirtualizer) currentVirtualizer.measure();
          }
        }
      });
    });

    resizeObserver.observe(scrollElement);

    // Initial measurement
    requestAnimationFrame(() => {
      if (scrollElement) {
        const width = scrollElement.getBoundingClientRect().width;
        if (width > 0) {
          containerWidth = width;
        }
      }
    });

    // Listen for scroll events (for sidebar active tracking)
    scrollElement.addEventListener("scroll", handleScrollEvent, { passive: true });

    // Expose API for sidebar scroll control
    if (onGridReady) {
      onGridReady({
        scrollToSequenceIndex: (index: number) => {
          const rowIndex = Math.floor(index / columnCount);
          if (currentVirtualizer) {
            currentVirtualizer.scrollToIndex(rowIndex, { align: "start", behavior: "smooth" });
          }
        },
        subscribeToScroll: (callback: () => void) => {
          scrollListeners.add(callback);
          return () => scrollListeners.delete(callback);
        },
        getFirstVisibleSequenceIndex: () => {
          const first = virtualRows[0];
          if (!first) return 0;
          return first.index * columnCount;
        },
      });
    }

    return () => {
      storeUnsub?.();
      resizeObserver.disconnect();
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      if (preWarmTimer) clearTimeout(preWarmTimer);
      if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
      scrollElement?.removeEventListener("scroll", handleScrollEvent);
      scrollListeners.clear();
    };
  });

  // Recreate virtualizer when row count, column count, or layout changes
  $effect(() => {
    const count = rowCount;
    const _cols = columnCount;
    const _layout = compositionManager.startPositionLayout;

    untrack(() => {
      if (scrollElement) {
        createAndSubscribe(count);
      }
    });
  });

  // Pre-warm pictograph cells for visible sequences — debounced to avoid
  // firing on every scroll frame. Waits 150ms after scroll settles before
  // queuing background work, preventing mobile freeze from effect thrashing.
  let preWarmTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const rows = virtualRows;
    if (!rows.length) return;

    untrack(() => {
      if (preWarmTimer) clearTimeout(preWarmTimer);
      preWarmTimer = setTimeout(() => {
        preWarmTimer = null;
        for (const row of rows) {
          const rowSequences = getRowSequences(row.index);
          for (const seq of rowSequences) {
            cellPreWarmer.preWarmSequence(seq, "background");
          }
        }
      }, 150);
    });
  });
</script>

<div
  bind:this={scrollElement}
  class="virtual-scroll-container ph-no-capture themed-scrollbar"
  role="grid"
  aria-rowcount={rowCount}
>
  <div class="virtual-content" style:height="{totalHeight}px">
    {#each virtualRows as virtualRow (virtualRow.key)}
      <div
        class="virtual-row"
        data-index={virtualRow.index}
        use:measureRow
        style:position="absolute"
        style:top="{virtualRow.start}px"
        style:width="100%"
        style:display="grid"
        style:grid-template-columns="repeat({columnCount}, 1fr)"
        style:align-items="start"
        style:gap="var(--spacing-lg, 16px)"
        role="row"
        aria-rowindex={virtualRow.index + 1}
      >
        {#each getRowSequences(virtualRow.index) as sequence, colIndex (sequence.id)}
          {@const seqVariations = getVariationsForSequence(sequence)}
          <div role="gridcell" aria-colindex={colIndex + 1}>
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
              {handPathMode}
              {showBlueMotion}
              {showRedMotion}
              {addWord}
              {addDifficultyLevel}
            />
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .virtual-scroll-container {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-accent) var(--scrollbar-track);
  }

  .virtual-scroll-container::-webkit-scrollbar {
    width: 8px;
  }

  .virtual-scroll-container::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .virtual-scroll-container::-webkit-scrollbar-thumb {
    background: var(--scrollbar-accent);
    border-radius: 4px;
  }

  .virtual-content {
    position: relative;
    width: 100%;
  }

  .virtual-row [role="gridcell"]:focus-within {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
    border-radius: 8px;
  }

  .virtual-row {
    padding: 0 var(--spacing-sm, 4px);
    box-sizing: border-box;
  }

  @container (max-width: 480px) {
    .virtual-row {
      gap: 8px !important;
    }
  }

  @container (min-width: 481px) and (max-width: 1199px) {
    .virtual-row {
      gap: var(--spacing-md, 12px) !important;
    }
  }
</style>
