<!--
OptionPickerContent.svelte - Content layout for option picker

Single responsibility: Organize prepared options into sections and layout.
Uses organizer and sizer services for section grouping and sizing.
-->
<script lang="ts">
  import type { PreparedPictographData } from "$lib/shared/pictograph/option/PreparedPictographData";
  import type { IOptionOrganizer } from "../services/contracts/IOptionOrganizer";
  import type { IOptionGridFitCalculator } from "../services/contracts/IGridFitCalculator";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  // CSS animations used instead of Svelte transitions to avoid carousel dimension issues
  import OptionSection from "./OptionSection.svelte";
  import Option456Row from "./Option456Row.svelte";
  import OptionGrid from "./OptionGrid.svelte";
  import OptionCard from "./OptionCard.svelte";
  import OptionViewerSwipeLayout from "../swipe-layout/components/OptionViewerSwipeLayout.svelte";
  import OptionViewerSection from "../swipe-layout/components/OptionViewerSection.svelte";

  interface Props {
    options: PreparedPictographData[];
    organizerService: IOptionOrganizer | null;
    sizerService: IOptionGridFitCalculator | null;
    isFading?: boolean;
    onSelect: (option: PreparedPictographData) => void;
    // Filter props
    isContinuousOnly?: boolean;
    onToggleContinuous?: (value: boolean) => void;
    isSideBySideLayout?: () => boolean;
    // Sequence context for reversal detection
    currentSequence?: PictographData[];
  }

  const {
    options,
    organizerService,
    sizerService,
    isFading = false,
    onSelect,
    isContinuousOnly = false,
    onToggleContinuous,
    isSideBySideLayout = () => false,
    currentSequence = [],
  }: Props = $props();

  // Track container dimensions with simple resize observer
  let containerElement: HTMLDivElement | null = $state(null);
  let containerWidth = $state(800); // Default to desktop-size to avoid mobile flash
  let containerHeight = $state(600);
  let sizingStable = $state(false);

  // Layout thresholds
  // Wide layout (>= 750px): 8-column grouped vertical layout
  // Narrow layout (< 750px): Horizontal swipe layout between type sections
  const WIDE_LAYOUT_THRESHOLD = 750;
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
    return organizerService.organizePictographs(options, "type");
  });

  // Separate Types 1-3 (individual sections) from Types 4-6 (horizontal row)
  const types123Sections = $derived(() => {
    return organizedSections().filter(
      (s) => s.title === "Type1" || s.title === "Type2" || s.title === "Type3"
    );
  });

  const types456Sections = $derived(() => {
    return organizedSections().filter(
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
    const sections = organizedSections();
    // Use swipe when:
    // - In mobile stacked layout (always use swipe for mobile)
    // - OR not using wide layout (container < 750px)
    // - AND not using compact 4x4 (continuous mode)
    // - AND have multiple sections to swipe between
    const shouldSwipe = isMobileStackedLayout() || !shouldUseWideLayout;
    return shouldSwipe && !shouldUseCompact4x4() && sections.length > 1;
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
      const result = sizerService.calculateDeviceAwareSize({
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
    // Subtract filter header when visible
    if (shouldShowFilterToggle()) {
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

<div class="option-picker-content" bind:this={containerElement}>
  {#if sizingStable && options.length > 0}
    <!-- Animate in after sizing is stable -->
    <!-- Use CSS animation class based on layout to avoid scale affecting carousel dimensions -->
    <div
      class="animated-content"
      class:swipe-entrance={shouldUseSwipeLayout()}
      class:scale-entrance={!shouldUseSwipeLayout()}
    >
      <!-- Filter toggle chip - only show when we have rotation context -->
      {#if shouldShowFilterToggle()}
        <div class="filter-header" class:mobile={shouldUseSwipeLayout()}>
          <button
            class="filter-toggle"
            class:mobile={shouldUseSwipeLayout()}
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
        <div class="compact-4x4-container">
          <OptionViewerSection
            pictographs={options}
            onPictographSelected={(p) => onSelect(p as PreparedPictographData)}
            layoutConfig={mobileLayoutConfig()}
            fitToViewport={true}
            showHeader={false}
            isFadingOut={isFading}
            {currentSequence}
          />
        </div>
      {:else if shouldUseSwipeLayout()}
        <!-- ==================== SWIPE LAYOUT ==================== -->
        <div class="swipe-container">
          <OptionViewerSwipeLayout
            organizedPictographs={swipeSections()}
            onPictographSelected={(p) => onSelect(p as PreparedPictographData)}
            layoutConfig={mobileLayoutConfig()}
            isFadingOut={isFading}
            {currentSequence}
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
              showHeader={organizedSections().length > 1}
              {isFading}
              {onSelect}
              {currentSequence}
              enableFlip={true}
            />
          {/each}

          <!-- Types 4-6: Horizontal row -->
          {#if types456Sections().length > 0}
            <Option456Row
              sections={types456Sections()}
              cardSize={desktopSizing().cardSize}
              columns={desktopSizing().columns}
              gap={desktopSizing().gap}
              {isFading}
              {onSelect}
              {currentSequence}
              enableFlip={true}
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
            isFadingOut={isFading}
            {currentSequence}
          />
        </div>
      {/if}
    </div>
  {:else if options.length === 0 && sizingStable}
    <div class="empty-state">
      <p>No options available</p>
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

    /* Dark mode cascade variables - child components inherit these */
    --option-header-bg: rgba(255, 255, 255, 0.9);
    --option-header-border: rgba(0, 0, 0, 0.1);
    --option-header-shadow: rgba(0, 0, 0, 0.1);
    --option-header-text: #000000;
    --option-dark-transition: 150ms ease-out;
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

  /* Entrance animation for swipe layout - fade only (no scale to avoid carousel dimension issues) */
  .animated-content.swipe-entrance {
    animation: fade-in 200ms cubic-bezier(0.33, 1, 0.68, 1) both;
  }

  /* Entrance animation for desktop layout - scale + fade */
  .animated-content.scale-entrance {
    animation: scale-in 280ms cubic-bezier(0.33, 1, 0.68, 1) both;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scale-in {
    from {
      opacity: 0;
      transform: scale(0.94);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .animated-content.swipe-entrance,
    .animated-content.scale-entrance {
      animation: none;
    }
  }

  /* Disable prop/arrow transitions during initial entrance animation */
  .animated-content :global(.prop-svg),
  .animated-content :global(.arrow-svg) {
    transition: none !important;
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

  .filter-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 14px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 16px;
    color: rgba(255, 255, 255, 0.85);
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    margin: 4px 0;
    transition: all 0.2s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .filter-toggle:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .filter-toggle:active {
    transform: scale(0.97);
  }

  /* Continuous state - highlighted */
  .filter-toggle.continuous {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.4);
    color: rgba(147, 197, 253, 1);
  }

  .filter-toggle.continuous:hover {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.5);
  }

  .filter-toggle i {
    font-size: var(--font-size-compact);
  }

  /* Mobile: More compact */
  .filter-toggle.mobile {
    padding: 4px 10px;
    font-size: var(--font-size-compact);
    margin: 2px 0;
    border-radius: 12px;
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

  /* Compact 4x4 grid for continuous mode on mobile */
  .compact-4x4-container {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted, #888);
    font-size: var(--font-size-min);
  }
</style>
