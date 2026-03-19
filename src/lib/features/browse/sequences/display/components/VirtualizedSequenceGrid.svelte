<script lang="ts" module>
  /** API surface exposed via onReady callback for parent components */
  export interface VirtualGridApi {
    scrollToSequenceIndex: (index: number) => void;
    getFirstVisibleSequenceIndex: () => number;
    subscribeToScroll: (callback: () => void) => () => void;
  }
</script>

<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import {
    createVirtualizer,
    type VirtualItem,
  } from "@tanstack/svelte-virtual";
  import { onMount, onDestroy, untrack } from "svelte";
  import { get } from "svelte/store";
  import type { IBrowseThumbnailProvider } from "../services/contracts/IBrowseThumbnailProvider";
  import type { IVariationGrouper } from "../services/contracts/IVariationGrouper";
  import ChoreoCardThumbnail from "./ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { isCatDogMode } from "../utils/prop-mode-helpers";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { container } from "$lib/shared/di";
  import { cellPreWarmer } from "$lib/shared/sequence-viewer/services/implementations/CellPreWarmer";
  import { gridZoomManager } from "../../../shared/state/grid-zoom-state.svelte";

  /**
   * VirtualizedSequenceGrid - High-performance grid for large sequence lists
   *
   * Uses TanStack Virtual to render only visible items, dramatically improving
   * performance for lists with 100+ sequences.
   *
   * Key features:
   * - Dynamic column count based on container width
   * - Virtual rows with configurable overscan
   * - Smooth scrolling with estimated item size
   * - Prop-aware thumbnails (single-prop or cat-dog mode)
   */

  const {
    sequences = [],
    thumbnailService,
    onAction = () => {},
    pinchColumnOverride,
    onReady,
  } = $props<{
    sequences: SequenceData[];
    thumbnailService: IBrowseThumbnailProvider | null;
    onAction?: (action: string, sequence: SequenceData, variations?: SequenceData[]) => void;
    /** Pinch-to-zoom column override. Mobile: 2-3, Desktop: 2-5. Overrides responsive columns. */
    pinchColumnOverride?: number;
    /** Called once the virtualizer is ready, providing scroll control functions */
    onReady?: (api: VirtualGridApi) => void;
  }>();

  // Layout calculator for proper aspect ratio estimation
  const layoutCalculator = container.items.layoutCalculator;

  // Variation grouper service for identifying sequences with same word
  const variationGrouper = container.items.variationGrouper;

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
  const visibilityManager = getAnimationVisibilityManager();
  let lightMode = $state(!visibilityManager.isDarkMode());

  // Register observer to react to visibility changes (like "L" key toggle)
  function handleVisibilityChange() {
    lightMode = !visibilityManager.isDarkMode();
  }

  visibilityManager.registerObserver(handleVisibilityChange);

  onDestroy(() => {
    visibilityManager.unregisterObserver(handleVisibilityChange);
  });

  // Container and scroll element refs
  let scrollElement = $state<HTMLDivElement | null>(null);
  let containerWidth = $state(0);

  // Reactive state for virtualizer data
  let virtualRows = $state<VirtualItem[]>([]);
  let totalHeight = $state(0);

  // Persistent reference to the latest virtualizer instance, used by exported functions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let virtualizerRef: any = null;

  /**
   * Scroll to bring the sequence at the given flat array index into view.
   * Called by SectionIndexSidebar when a section marker is clicked.
   */
  export function scrollToSequenceIndex(sequenceIndex: number): void {
    const rowIndex = Math.floor(sequenceIndex / columnCount);
    if (virtualizerRef) {
      virtualizerRef.scrollToIndex(rowIndex, { align: "start" });
    }
  }

  /**
   * Get the flat array index of the first visible sequence.
   * Used for tracking which section is currently in view.
   */
  export function getFirstVisibleSequenceIndex(): number {
    if (!virtualizerRef) return 0;
    const items = virtualizerRef.getVirtualItems();
    if (items.length === 0) return 0;
    return items[0].index * columnCount;
  }

  // Dynamic column count based on container width.
  // Clamps pinchColumnOverride to per-breakpoint max so you can't
  // get 5 tiny columns on a phone screen.
  const columnCount = $derived.by(() => {
    if (containerWidth === 0) return 2;

    if (pinchColumnOverride !== undefined) {
      return Math.max(2, Math.min(gridZoomManager.maxColumns, pinchColumnOverride));
    }

    if (containerWidth >= 1600) return 5;
    if (containerWidth >= 1200) return 4;
    if (containerWidth >= 800) return 3;
    return 2;
  });

  // Calculate row count based on sequences and columns
  const rowCount = $derived(Math.ceil(sequences.length / columnCount));

  // Estimated row height based on actual gallery aspect ratio
  // Uses the median sequence length to calculate proper card height
  const estimatedRowHeight = $derived.by(() => {
    if (containerWidth === 0) return 200;
    const gap = 16;
    const cardWidth = (containerWidth - (columnCount - 1) * gap) / columnCount;

    // Sample representative step count from first sequence (filtered lists are usually uniform)
    const sampleSequence = sequences[0];
    const stepCount =
      sampleSequence?.steps?.length ||
      sampleSequence?.sequenceLength ||
      4;

    // Use LayoutCalculator for exact gallery aspect ratio (width/height)
    const aspectRatio =
      layoutCalculator.calculateGalleryAspectRatio(stepCount);

    // Card height = width / aspectRatio
    return cardWidth / aspectRatio + gap;
  });

  // Get sequences for a specific row
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

  // Initialize virtualizer and subscribe to updates
  onMount(() => {
    if (!scrollElement) return;

    // Create virtualizer store
    const virtualizerStore = createVirtualizer({
      count: rowCount,
      getScrollElement: () => scrollElement,
      estimateSize: () => estimatedRowHeight,
      overscan: 3, // Render 3 extra rows above/below viewport
    });

    // Subscribe to virtualizer updates
    const unsubscribe = virtualizerStore.subscribe((v) => {
      virtualizerRef = v;
      virtualRows = v.getVirtualItems();
      totalHeight = v.getTotalSize();
    });

    // ResizeObserver to track container width
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          containerWidth = width;
          gridZoomManager.updateContainerWidth(width);
          // Force virtualizer to recalculate
          const v = get(virtualizerStore);
          v.measure();
        }
      }
    });

    resizeObserver.observe(scrollElement);

    // Initial measurement
    requestAnimationFrame(() => {
      if (scrollElement) {
        const width = scrollElement.getBoundingClientRect().width;
        if (width > 0) {
          containerWidth = width;
          gridZoomManager.updateContainerWidth(width);
        }
      }
    });

    // Notify parent that the grid API is ready
    onReady?.({
      scrollToSequenceIndex,
      getFirstVisibleSequenceIndex,
      subscribeToScroll: (callback: () => void) => {
        scrollElement?.addEventListener("scroll", callback, { passive: true });
        return () => scrollElement?.removeEventListener("scroll", callback);
      },
    });

    return () => {
      unsubscribe();
      resizeObserver.disconnect();
    };
  });

  // Pre-warm pictograph cells for visible sequences at background priority.
  // Uses scheduler.postTask("background") internally — never competes with gallery rendering.
  $effect(() => {
    const rows = virtualRows;
    if (!rows.length) return;

    untrack(() => {
      for (const row of rows) {
        const rowSequences = getRowSequences(row.index);
        for (const seq of rowSequences) {
          cellPreWarmer.preWarmSequence(seq, "background");
        }
      }
    });
  });

  /**
   * Svelte action for dynamic row measurement.
   * TanStack Virtual's measureElement uses a ResizeObserver internally,
   * so if card content changes height (e.g. different beat counts per row),
   * the virtualizer automatically picks up the new size instead of relying
   * on the estimate which causes overlapping.
   */
  function measureRow(node: HTMLElement) {
    virtualizerRef?.measureElement?.(node);
    return {
      destroy() {
        virtualizerRef?.measureElement?.(node);
      },
    };
  }

  // Sequence data provider for hover prefetch
  const sequenceDataProvider = container.items.sequenceDataProvider;

  // Handle hover pre-warming — called by ChoreoCardThumbnail's onHover prop
  // Prefetches full sequence data from Firestore AND pre-warms cells
  function handleSequenceHover(seq: SequenceData) {
    cellPreWarmer.preWarmSequence(seq, "user-visible");
    sequenceDataProvider.prefetch(seq);
  }

  // Reconfigure virtualizer when rowCount or estimatedRowHeight changes
  $effect(() => {
    // Capture reactive dependencies
    const count = rowCount;
    const height = estimatedRowHeight;

    // Run update outside reactive tracking
    untrack(() => {
      if (!scrollElement) return;

      // Create new virtualizer with updated config
      const virtualizerStore = createVirtualizer({
        count,
        getScrollElement: () => scrollElement,
        estimateSize: () => height,
        overscan: 3,
      });

      // Subscribe to updates
      const unsubscribe = virtualizerStore.subscribe((v) => {
        virtualizerRef = v;
        virtualRows = v.getVirtualItems();
        totalHeight = v.getTotalSize();
      });

      // Cleanup previous subscription on next effect run
      return unsubscribe;
    });
  });
</script>

<div
  bind:this={scrollElement}
  class="virtual-scroll-container ph-no-capture"
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
    /* Smooth scrolling for virtual lists */
    scroll-behavior: smooth;
    /* Custom scrollbar styling */
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

  /* Focus styles for keyboard navigation (WCAG AAA) */
  .virtual-row [role="gridcell"]:focus-within {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
    border-radius: 8px;
  }

  .virtual-row {
    padding: 0 var(--spacing-sm, 4px);
    box-sizing: border-box;
  }

  /* Responsive gap adjustments matching original grid */
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
