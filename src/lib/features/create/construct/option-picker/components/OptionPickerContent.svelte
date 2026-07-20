<!--
OptionPickerContent.svelte - Content layout for option picker

Single responsibility: Organize prepared options into sections and layout.
Uses organizer and sizer services for section grouping and sizing.
-->
<script lang="ts">
  import type { PreparedPictographData } from "$lib/shared/pictograph/option/prepared-pictograph-data";
  import type { OrganizedSection, SortMethod } from "../domain/option-picker-types";
  import type { DeviceAwareSizingParams, DeviceAwareSizingResult } from "../services/types";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  // CSS animations used instead of Svelte transitions to avoid carousel dimension issues
  import OptionSection from "./OptionSection.svelte";
  import Option456Row from "./Option456Row.svelte";
  import OptionGrid from "./OptionGrid.svelte";
  import OptionCard from "./OptionCard.svelte";
  import OptionViewerSwipeLayout from "../swipe-layout/components/OptionViewerSwipeLayout.svelte";
  import OptionViewerSection from "../swipe-layout/components/OptionViewerSection.svelte";
  import HorizontalSwipeContainer from "$lib/shared/foundation/ui/HorizontalSwipeContainer.svelte";
  import OptionPickerHeader from "./OptionPickerHeader.svelte";
  import type { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { identifyContinuation } from "../services/continuation-identifier";

  interface Props {
    options: PreparedPictographData[];
    organizerService: ((pictographs: PictographData[], sortMethod: SortMethod) => OrganizedSection[]) | null;
    sizerService: ((params: DeviceAwareSizingParams) => DeviceAwareSizingResult) | null;
    onSelect: (option: PreparedPictographData) => void;
    // Filter props
    isContinuousOnly?: boolean;
    onToggleContinuous?: (value: boolean) => void;
    isSideBySideLayout?: () => boolean;
    /** Hide the All/Continuous filter UI (simplified tutorial grid) */
    hideFilters?: boolean;
    // Sequence context for reversal detection
    currentSequence?: PictographData[];
    // Continuation reordering
    onSlotClicked?: (typeSection: string, slotIndex: number) => void;
    lastClickedSlot?: { typeSection: string; slotIndex: number } | null;
    // Pending turns bar
    blueTurns: number | "fl";
    redTurns: number | "fl";
    blueRotation: RotationDirection;
    redRotation: RotationDirection;
    onBlueTurnsChange: (delta: number) => void;
    onRedTurnsChange: (delta: number) => void;
    onBlueRotationChange: (dir: RotationDirection) => void;
    onRedRotationChange: (dir: RotationDirection) => void;
    onResetTurns: () => void;
  }

  const {
    options,
    organizerService,
    sizerService,
    onSelect,
    isContinuousOnly = false,
    onToggleContinuous,
    isSideBySideLayout = () => false,
    hideFilters = false,
    currentSequence = [],
    onSlotClicked,
    lastClickedSlot = null,
    blueTurns,
    redTurns,
    blueRotation,
    redRotation,
    onBlueTurnsChange,
    onRedTurnsChange,
    onBlueRotationChange,
    onRedRotationChange,
    onResetTurns,
  }: Props = $props();

  // Track container dimensions with simple resize observer
  let containerElement: HTMLDivElement | null = $state(null);
  let containerWidth = $state(800); // Default to desktop-size to avoid mobile flash
  let containerHeight = $state(600);
  let sizingStable = $state(false);

  // Content-area bounds for the continuous compact grid. Fed by the same
  // HorizontalSwipeContainer the sectioned (All) layout uses, so the continuous
  // grid sizes its tiles via the identical measured-viewport path → exact size
  // parity with the All-mode Type-1 grid (no fudge-factor divergence).
  let compactBounds = $state<{ left: number; right: number; width: number } | null>(null);
  function handleCompactBounds(bounds: { left: number; right: number; width: number }) {
    compactBounds = bounds;
  }

  // Layout thresholds
  // Wide layout (>= 750px): 8-column grouped vertical layout
  // Narrow layout (< 750px): Horizontal swipe layout between type sections
  const WIDE_LAYOUT_THRESHOLD = 750;
  const CORNER_FILTER_MAX_WIDTH = 500;
  const CORNER_FILTER_MAX_HEIGHT = 340;
  const shouldUseWideLayout = $derived(containerWidth >= WIDE_LAYOUT_THRESHOLD);

  // Column count: 8 for wide, 4 for narrow/swipe
  const columns = $derived(() => {
    return shouldUseWideLayout ? 8 : 4;
  });

  // Only show filter toggle when we have at least 2 steps (start position + 1 actual beat)
  // Without a previous beat, there's no rotation context to filter against
  const shouldShowFilterToggle = $derived(() => {
    return options.length > 0 && currentSequence.length >= 2;
  });

  // Organize options into sections
  const organizedSections = $derived(() => {
    if (!organizerService || options.length === 0) {
      return [];
    }
    return organizerService(options, "type");
  });

  // Apply continuation reordering when in continuous mode
  const continuationState = $derived(() => {
    const sections = organizedSections();
    if (
      !isContinuousOnly ||
      !lastClickedSlot ||
      currentSequence.length < 2
    ) {
      return { sections, continuationMap: new Map<string, number>() };
    }

    const referenceBeat = currentSequence[currentSequence.length - 1];
    if (!referenceBeat) {
      return { sections, continuationMap: new Map<string, number>() };
    }
    const continuationMap = new Map<string, number>();

    const reorderedSections = sections.map((section) => {
      if (section.title !== lastClickedSlot.typeSection) return section;

      const continuation = identifyContinuation(
        referenceBeat,
        section.pictographs
      );

      if (!continuation) return section;

      const contIdx = section.pictographs.findIndex(
        (p) => p.id === continuation.id
      );
      if (contIdx === -1) return section;

      // Clamp target slot to valid range
      const targetSlot = Math.min(
        lastClickedSlot.slotIndex,
        section.pictographs.length - 1
      );

      if (contIdx === targetSlot) {
        // Already in the right place
        continuationMap.set(section.title, targetSlot);
        return section;
      }

      // Swap continuation to the target slot
      const reordered = [...section.pictographs];
      const displaced = reordered[targetSlot]!;
      const cont = reordered[contIdx]!;
      reordered[targetSlot] = cont;
      reordered[contIdx] = displaced;

      continuationMap.set(section.title, targetSlot);

      return { ...section, pictographs: reordered };
    });

    return { sections: reorderedSections, continuationMap };
  });

  // Helper to get continuation index for a section
  function getContinuationIndex(sectionTitle: string): number | null {
    const map = continuationState().continuationMap;
    return map.has(sectionTitle) ? map.get(sectionTitle)! : null;
  }

  // Separate Types 1-3 (individual sections) from Types 4-6 (horizontal row)
  const types123Sections = $derived(() => {
    return continuationState().sections.filter(
      (s) => s.title === "Type1" || s.title === "Type2" || s.title === "Type3"
    );
  });

  const types456Sections = $derived(() => {
    return continuationState().sections.filter(
      (s) => s.title === "Type4" || s.title === "Type5" || s.title === "Type6"
    );
  });

  // ==================== LAYOUT MODE DETECTION ====================
  // Mobile stacked layout (workspace on top, tool panel on bottom) vs side-by-side desktop
  const isMobileStackedLayout = $derived(() => !isSideBySideLayout());

  // ==================== NARROW LAYOUT DECISIONS ====================
  // These are evaluated when container is narrow (< 750px) OR in mobile stacked layout

  // Use compact 4x4 grid for continuous mode when in mobile/narrow layout
  // Continuous options are typically 16 or fewer, fits nicely in 4x4
  const shouldUseCompact4x4 = $derived(() => {
    const isNarrowOrMobile = !shouldUseWideLayout || isMobileStackedLayout();
    return isNarrowOrMobile && isContinuousOnly && options.length <= 16;
  });

  // Use swipe layout when in mobile stacked layout OR narrow container
  const shouldUseSwipeLayout = $derived(() => {
    const sections = continuationState().sections;
    // Use swipe when:
    // - In mobile stacked layout (always use swipe for mobile)
    // - OR not using wide layout (container < 750px)
    // - AND not using compact 4x4 (continuous mode)
    // - AND have multiple sections to swipe between
    const shouldSwipe = isMobileStackedLayout() || !shouldUseWideLayout;
    return shouldSwipe && !shouldUseCompact4x4() && sections.length > 1;
  });

  // The unified header (filter + turns) replaces the standalone filter pill on the
  // wide desktop layout. It's pinned to the top of the picker; the grid scrolls
  // beneath it. Matches the wide-layout branch condition.
  const useUnifiedHeader = $derived(
    !shouldUseCompact4x4() &&
      !shouldUseSwipeLayout() &&
      shouldUseWideLayout &&
      !isMobileStackedLayout()
  );

  const showStandaloneFilter = $derived(() => {
    return shouldShowFilterToggle() && !hideFilters && !useUnifiedHeader;
  });

  // Narrow cover screens and short picker areas need the pictographs more than
  // they need a dedicated filter row. Both swipe variants reserve a 48px arrow
  // gutter, so the compact icon can sit there without covering an option.
  const shouldDockFilterInCorner = $derived(() => {
    const hasArrowGutter = shouldUseSwipeLayout() || shouldUseCompact4x4();
    const isSpaceConstrained =
      containerWidth <= CORNER_FILTER_MAX_WIDTH ||
      containerHeight <= CORNER_FILTER_MAX_HEIGHT;

    return showStandaloneFilter() && hasArrowGutter && isSpaceConstrained;
  });

  // For swipe layout: combine Types 4-6 into a single grouped panel
  const swipeSections = $derived(() => {
    const sections123 = types123Sections();
    const sections456 = types456Sections();

    // Combine all Types 4-6 pictographs into one grouped section
    const grouped456Pictographs = sections456.flatMap((s) => s.pictographs);

    if (grouped456Pictographs.length === 0) {
      return sections123;
    }

    return [
      ...sections123,
      {
        title: "Types 4-6",
        pictographs: grouped456Pictographs,
        type: "grouped" as const,
      },
    ];
  });

  // ==================== DESKTOP SIZING ====================
  // Desktop uses the sizer service to calculate appropriate card sizes

  const desktopSizing = $derived(() => {
    const cols = columns();
    // Use reasonable defaults until stable
    if (!sizingStable || !sizerService) {
      return { cardSize: 80, columns: cols, gap: "8px" };
    }

    try {
      const result = sizerService({
        count: options.length,
        containerWidth: containerWidth,
        containerHeight: containerHeight,
        columns: cols,
        isMobileDevice: false,
      });

      return {
        cardSize: Math.max(60, Math.min(120, result.pictographSize)),
        columns: cols,
        gap: result.gridGap,
      };
    } catch {
      return { cardSize: 80, columns: cols, gap: "8px" };
    }
  });

  // ==================== MOBILE LAYOUT CONFIGS ====================
  // Both configs use consistent values to prevent size "burst" when toggling

  // Heights to subtract when calculating available space for content
  // Filter header: ~32px on mobile (button height + margins)
  // Swipe dots: ~73px (margin-top 1.8rem + dot height ~44px)
  const FILTER_HEADER_HEIGHT = 32;
  const SWIPE_DOTS_HEIGHT = 73;

  // Calculate effective height for swipe layout accounting for UI chrome
  const effectiveSwipeHeight = $derived(() => {
    let height = containerHeight;
    // A centered filter owns a row. The corner version lives in the arrow
    // gutter, so reserving another 32px would keep the pictographs needlessly low.
    if (showStandaloneFilter() && !shouldDockFilterInCorner()) {
      height -= FILTER_HEADER_HEIGHT;
    }
    // Subtract swipe dots height (always present in swipe layout)
    if (shouldUseSwipeLayout()) {
      height -= SWIPE_DOTS_HEIGHT;
    }
    return Math.max(200, height); // Ensure minimum usable height
  });

  const mobileLayoutConfig = $derived(() => ({
    optionsPerRow: 4,
    pictographSize: 120, // Consistent max size hint
    spacing: 8,
    containerWidth: containerWidth,
    containerHeight: effectiveSwipeHeight(),
    gridColumns: `repeat(4, 1fr)`,
    gridGap: "8px",
  }));

  // Simple resize observer - only update after stable
  $effect(() => {
    if (!containerElement) return;

    let timeoutId: number;
    const observer = new ResizeObserver((entries) => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        const entry = entries[0];
        if (entry) {
          const w = entry.contentRect.width;
          const h = entry.contentRect.height;
          if (w > 100 && h > 100) {
            containerWidth = w;
            containerHeight = h;
            sizingStable = true;
          }
        }
      }, 100); // Debounce 100ms
    });

    observer.observe(containerElement);

    // Initial measurement
    const rect = containerElement.getBoundingClientRect();
    if (rect.width > 100 && rect.height > 100) {
      containerWidth = rect.width;
      containerHeight = rect.height;
      sizingStable = true;
    }

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  });
</script>

<div class="option-picker-content" data-testid="option-picker" bind:this={containerElement}>
  {#if sizingStable}
    <!-- Content stays mounted so pictographs transition in place instead of remounting -->
    <div class="animated-content">
      <!-- Unified header: pinned to the top of the picker (outside the scrolling
           grid) so its position is consistent. Desktop wide layout only. -->
      {#if useUnifiedHeader}
        <div class="picker-header-slot">
          <OptionPickerHeader
            showFilter={shouldShowFilterToggle() && !hideFilters}
            {isContinuousOnly}
            {onToggleContinuous}
            {blueTurns}
            {redTurns}
            {blueRotation}
            {redRotation}
            onBlueChange={onBlueTurnsChange}
            onRedChange={onRedTurnsChange}
            onBlueRotationChange={onBlueRotationChange}
            onRedRotationChange={onRedRotationChange}
            onReset={onResetTurns}
          />
        </div>
      {/if}

      <!-- Standalone filter pill: mobile/compact layouts only. -->
      {#if showStandaloneFilter()}
        <div
          class="filter-header"
          class:mobile={shouldUseSwipeLayout()}
          class:corner={shouldDockFilterInCorner()}
        >
          <button
            class="filter-toggle"
            class:mobile={shouldUseSwipeLayout()}
            class:corner={shouldDockFilterInCorner()}
            class:continuous={isContinuousOnly}
            onclick={() => onToggleContinuous?.(!isContinuousOnly)}
            aria-label={isContinuousOnly
              ? "Showing continuous only - click for all"
              : "Showing all - click for continuous only"}
            aria-pressed={isContinuousOnly}
          >
            <i
              class="fas"
              aria-hidden="true"
              class:fa-link={isContinuousOnly}
              class:fa-th={!isContinuousOnly}
            ></i>
            <span class="filter-label"
              >{isContinuousOnly ? "Continuous" : "All"}</span
            >
          </button>
        </div>
      {/if}

      {#if shouldUseCompact4x4()}
        <!-- ==================== COMPACT 4x4 LAYOUT ==================== -->
        <!-- Single continuous grid rendered inside the SAME swipe container the
             sectioned (All) layout uses. One panel: arrows reserve their gutter
             (so the content width matches the All-mode panels exactly) but never
             render. The section measures the real embla viewport for height, so
             the continuous tiles come out the same size as the All-mode Type-1
             grid instead of from a parallel fudge-factor formula. -->
        <div class="swipe-container">
          <HorizontalSwipeContainer
            showArrows={true}
            showIndicators={false}
            height="100%"
            width="100%"
            onContentAreaChange={handleCompactBounds}
          >
            <div class="compact-panel">
              <OptionViewerSection
                pictographs={options}
                onPictographSelected={(p) => onSelect(p as PreparedPictographData)}
                layoutConfig={mobileLayoutConfig()}
                showHeader={false}
                contentAreaBounds={compactBounds}
                {currentSequence}
                {onSlotClicked}
              />
            </div>
          </HorizontalSwipeContainer>
        </div>
      {:else if shouldUseSwipeLayout()}
        <!-- ==================== SWIPE LAYOUT ==================== -->
        <div class="swipe-container">
          <OptionViewerSwipeLayout
            organizedPictographs={swipeSections()}
            onPictographSelected={(p) => onSelect(p as PreparedPictographData)}
            layoutConfig={mobileLayoutConfig()}
            {currentSequence}
            {onSlotClicked}
            {getContinuationIndex}
          />
        </div>
      {:else if shouldUseWideLayout && !isMobileStackedLayout()}
        <!-- ==================== WIDE DESKTOP LAYOUT ==================== -->
        <div class="sections-container">
          <!-- Types 1-3: Individual vertical sections -->
          {#each types123Sections() as section (section.title)}
            <OptionSection
              letterType={section.title}
              options={section.pictographs}
              cardSize={desktopSizing().cardSize}
              columns={desktopSizing().columns}
              gap={desktopSizing().gap}
              showHeader={continuationState().sections.length > 1}
              {onSelect}
              {currentSequence}

              {onSlotClicked}
              continuationIndex={getContinuationIndex(section.title)}
            />
          {/each}

          <!-- Types 4-6: Horizontal row -->
          {#if types456Sections().length > 0}
            <Option456Row
              sections={types456Sections()}
              cardSize={desktopSizing().cardSize}
              columns={desktopSizing().columns}
              gap={desktopSizing().gap}
              {onSelect}
              {currentSequence}

              {onSlotClicked}
            />
          {/if}
        </div>
      {:else}
        <!-- ==================== FALLBACK: SINGLE SECTION ==================== -->
        <div class="swipe-container">
          <OptionViewerSection
            pictographs={options}
            onPictographSelected={(p) => onSelect(p as PreparedPictographData)}
            layoutConfig={mobileLayoutConfig()}
            fitToViewport={true}
            showHeader={false}
            {currentSequence}
          />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .option-picker-content {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    container-type: size;

    /* Dark mode cascade variables - child components inherit these.
       Uses theme system variables so they adapt to any background,
       with :root.dark overrides for pictograph dark mode toggle. */
    --option-header-bg: var(--theme-card-bg, rgba(255, 255, 255, 0.9));
    --option-header-border: var(--theme-stroke, rgba(0, 0, 0, 0.1));
    --option-header-shadow: rgba(0, 0, 0, 0.1);
    --option-header-text: var(--theme-text, #000000);
    --option-dark-transition: var(--duration-fast) ease-out;

    /* Shared option-card elevation recipe - consumed by OptionCard and
       OptionViewerSection so the shadow stacks live in one place. */
    --option-card-shadow:
      0 1px 2px rgba(0, 0, 0, 0.1),
      0 2px 4px rgba(0, 0, 0, 0.06);
    --option-card-shadow-hover:
      0 2px 4px rgba(0, 0, 0, 0.12),
      0 4px 8px rgba(0, 0, 0, 0.08),
      0 8px 16px rgba(0, 0, 0, 0.06);
  }

  :global(:root.dark) .option-picker-content {
    --option-header-bg: rgba(0, 0, 0, 0.75);
    --option-header-border: rgba(255, 255, 255, 0.15);
    --option-header-shadow: rgba(0, 0, 0, 0.3);
    --option-header-text: #ffffff;
  }

  .animated-content {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* Pinned header: stays at the top of the picker while the grid scrolls below. */
  .picker-header-slot {
    width: 100%;
    flex: 0 0 auto;
    position: sticky;
    top: 0;
    z-index: 5;
  }

  /* Filter header - inline, minimal */
  .filter-header {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    position: relative;
  }

  .filter-header.corner {
    position: absolute;
    top: 2px;
    left: 2px;
    width: auto;
    z-index: 5;
  }

  .filter-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--min-touch-target, 48px); /* WCAG AAA touch target */
    padding: 6px 14px;
    background: var(--theme-card-bg, rgba(0, 0, 0, 0.75));
    backdrop-filter: blur(8px) brightness(0.5);
    -webkit-backdrop-filter: blur(8px) brightness(0.5);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 16px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.85));
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    margin: 4px 0;
    transition: all var(--duration-normal) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .filter-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(139, 92, 246, 0.8));
    outline-offset: 2px;
  }

  .filter-toggle:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .filter-toggle:active {
    transform: scale(0.97);
  }

  /* Continuous state - highlighted */
  .filter-toggle.continuous {
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #3b82f6) 40%, transparent);
    color: color-mix(in srgb, var(--theme-accent, #3b82f6) 60%, white);
  }

  .filter-toggle.continuous:hover {
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #3b82f6) 50%, transparent);
  }

  .filter-toggle i {
    font-size: var(--font-size-compact);
  }

  /* Mobile: Keep 48px touch target */
  .filter-toggle.mobile {
    min-height: var(--min-touch-target, 48px); /* WCAG AAA touch target */
    padding: 4px 10px;
    font-size: var(--font-size-compact);
    margin: 2px 0;
    border-radius: 12px;
  }

  .filter-toggle.corner {
    min-width: var(--min-touch-target, 44px);
    padding: 0;
    gap: 0;
  }

  .filter-toggle.corner .filter-label {
    display: none;
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .filter-toggle {
      transition: none;
    }

    .filter-toggle:active {
      transform: none;
    }
  }

  .filter-toggle.mobile i {
    font-size: var(--font-size-compact);
  }

  .sections-container {
    flex: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 8px;
    overflow-y: auto;
    min-height: 0;
  }

  .swipe-container {
    flex: 1;
    width: 100%;
    min-height: 0;
  }

  /* Continuous compact grid panel inside the swipe container. Full height so
     OptionViewerSection measures the embla viewport and centers the grid. */
  .compact-panel {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 0;
  }

</style>
