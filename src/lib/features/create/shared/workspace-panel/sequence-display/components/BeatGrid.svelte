<!-- BeatGrid.svelte - Responsive beat grid with display animations -->
<script lang="ts">
  import type { BeatData } from "../../../domain/models/BeatData";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
  import type { StartPositionData } from "../../../domain/models/StartPositionData";
  import { createBeatData } from "../../../domain/factories/createBeatData";
  import { resolve, TYPES } from "$lib/shared/inversify/di";
  import { onMount } from "svelte";
  import {
    createBeatGridDisplayState,
    isPendingGenerationAnimation,
    setPendingGenerationAnimation,
  } from "$lib/features/create/shared/workspace-panel/sequence-display/state/beat-grid-display-state.svelte";
  import { createScrollState } from "$lib/features/create/shared/workspace-panel/sequence-display/state/scroll-state.svelte";
  import {
    calculateBeatPosition,
    calculateGridLayout,
  } from "../utils/grid-calculations";
  import BeatCell from "./BeatCell.svelte";

  // Services
  let hapticService: IHapticFeedback;
  let deviceDetector: IDeviceDetector;

  let {
    beats,
    startPosition = null,
    onBeatClick,
    onStartClick,
    onBeatDelete,
    onBeatLongPress,
    selectedBeatNumber = null, // 0=start, 1=first beat, 2=second beat, etc.
    removingBeatIndex = null,
    removingBeatIndices = new Set<number>(),
    isClearing = false,
    practiceBeatNumber = null, // 0=start, 1=first beat, 2=second beat, etc.
    isSideBySideLayout = false,
    shouldOrbitAroundCenter = false,
    activeMode = null,
    // Spotlight mode: maximize cell size to fill viewport
    isSpotlightMode = false,
    // Manual column override (null = auto)
    manualColumnCount = null,
    // Highlighted beats for multi-select/section highlighting
    highlightedBeats = null,
    // Height sizing threshold: grids with this many rows or fewer will consider height when sizing
    // Default 4 (workspace mode), use higher values (e.g., 20) for fixed-height containers
    heightSizingRowThreshold = undefined,
    // Multi-select support
    selectedBeatNumbers = new Set<number>(),
    isMultiSelectMode = false,
    onStartLongPress,
  } = $props<{
    beats: ReadonlyArray<BeatData> | BeatData[];
    startPosition?: StartPositionData | BeatData | null;
    onBeatClick?: (beatNumber: number) => void;
    onStartClick?: () => void;
    onBeatDelete?: (beatNumber: number) => void;
    onBeatLongPress?: (beatNumber: number) => void;
    selectedBeatNumber?: number | null; // 0=start, 1=first beat, 2=second beat, etc.
    removingBeatIndex?: number | null;
    removingBeatIndices?: Set<number>;
    isClearing?: boolean;
    practiceBeatNumber?: number | null; // 0=start, 1=first beat, 2=second beat, etc.
    isSideBySideLayout?: boolean;
    shouldOrbitAroundCenter?: boolean;
    activeMode?: BuildModeId | null;
    // Spotlight mode: maximize cell size to fill viewport (no max constraint)
    isSpotlightMode?: boolean;
    // Manual column override (null = auto)
    manualColumnCount?: number | null;
    // Highlighted beats for multi-select/section highlighting (beatNumber -> style)
    highlightedBeats?: Map<number, { bg: string; border: string }> | null;
    // Height sizing threshold: grids with this many rows or fewer will consider height when sizing
    // Default 4 (workspace mode), use higher values (e.g., 20) for fixed-height containers
    heightSizingRowThreshold?: number;
    // Multi-select support
    selectedBeatNumbers?: Set<number>;
    isMultiSelectMode?: boolean;
    onStartLongPress?: () => void;
  }>();

  const placeholderBeat = createBeatData({
    beatNumber: 0,
    isBlank: true,
  });

  // State management - isolated concerns
  const displayState = createBeatGridDisplayState();
  const scrollState = createScrollState();

  // Container dimensions for responsive sizing (component-local reactive state)
  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let containerRef: HTMLElement | undefined = $state();
  let scrollContainerRef: HTMLElement | undefined = $state();

  // Computed grid layout - reactive derivation using pure utility function
  // This stays in component because it depends on component-local reactive state
  // Pass layout mode awareness for column calculation
  const gridLayout = $derived(() => {
    return calculateGridLayout(
      beats.length,
      containerWidth,
      containerHeight,
      deviceDetector,
      {
        isSideBySideLayout,
        // Spotlight mode: maximize space - padding already handled by parent container
        maxCellSize: isSpotlightMode ? 9999 : undefined,
        widthPaddingRatio: isSpotlightMode ? 1.0 : undefined,
        heightPaddingRatio: isSpotlightMode ? 1.0 : undefined,
        // Always consider height in spotlight mode to prevent vertical overflow
        heightSizingRowThreshold: isSpotlightMode
          ? 9999
          : heightSizingRowThreshold,
        // Manual column override
        manualColumnCount,
      }
    );
  });

  // Track previous beat state for change detection
  // IMPORTANT: Initialize to 0/empty to detect first mount WITH beats (from Generate)
  // This ensures we trigger animation when component is mounted with pre-populated beats
  let previousBeatCount = 0;
  let previousBeatsRef: ReadonlyArray<BeatData> | BeatData[] = [];
  let isFirstRender = true;

  // Helper to trigger animations
  async function triggerFullAnimation() {
    if (!containerRef) return;

    // Only trigger animation if we're prepared for it (i.e., from Generate, not Undo/Redo)
    // Generate dispatches "prepare-sequence-animation" event which sets isPreparingFullAnimation = true
    // Undo/Redo just updates the sequence directly without this flag
    if (!displayState.isPreparingFullAnimation) {
      return; // Skip animation for Undo/Redo operations
    }

    const dispatchEvent = (event: CustomEvent) =>
      containerRef?.dispatchEvent(event);
    const mode = displayState.isSequentialMode ? "sequential" : "all-at-once";

    if (mode === "sequential") {
      await displayState.triggerSequentialAnimation(beats, dispatchEvent);
    } else {
      displayState.triggerAllAtOnceAnimation();
    }
  }

  // Handle beat changes and trigger appropriate animations
  $effect(() => {
    const currentBeatCount = beats.length;
    const beatsArrayChanged = beats !== previousBeatsRef;

    // Handle first render with pre-populated beats (component mounted after Generate clicked)
    // In this case, the prepare event was fired before component existed, so we need to
    // manually prepare and trigger the animation.
    // IMPORTANT: Only animate if pendingGenerationAnimation flag is true (set by Generate flow).
    // This prevents animation when loading saved sequences on app startup.
    if (isFirstRender && currentBeatCount > 0) {
      isFirstRender = false;

      // Only animate if this is from a Generate action, not a loaded sequence
      if (isPendingGenerationAnimation()) {
        // Clear the flag immediately to prevent re-triggering
        setPendingGenerationAnimation(false);

        // Manually prepare for animation since we missed the event
        displayState.prepareSequenceAnimation(currentBeatCount, "sequential");

        // Small delay to let state settle, then trigger animation
        setTimeout(() => {
          triggerFullAnimation();
        }, 10);
      }

      previousBeatCount = currentBeatCount;
      previousBeatsRef = beats;
      return;
    }

    isFirstRender = false;

    if (beatsArrayChanged && currentBeatCount > 0) {
      const beatCountDiff = currentBeatCount - previousBeatCount;

      if (beatCountDiff === 1) {
        // Single beat added - handles both first beat (previousBeatCount = 0) and subsequent beats
        if (previousBeatCount === 0) {
          // First beat added (e.g., Assembly mode starting fresh)
          displayState.handleSingleBeatAddition(currentBeatCount - 1);
        } else if (activeMode === "assembler") {
          // Assembly mode: always animate new beat
          // Assembly regenerates all beats with new IDs on each update, so ID comparison won't work
          displayState.handleSingleBeatAddition(currentBeatCount - 1);
        } else {
          // 🚀 PERFORMANCE: Check only the last beat ID instead of iterating through all beats
          // This is O(1) instead of O(n), eliminating the 60-70ms setTimeout violations
          const lastPreviousBeat = previousBeatsRef[previousBeatCount - 1];
          const lastCurrentBeat = beats[previousBeatCount - 1];
          const previousBeatsUnchanged =
            lastPreviousBeat &&
            lastCurrentBeat &&
            lastPreviousBeat.id === lastCurrentBeat.id;

          if (previousBeatsUnchanged) {
            // Single beat added (Construct mode)
            displayState.handleSingleBeatAddition(currentBeatCount - 1);
          } else {
            // Beats replaced - trigger full animation
            triggerFullAnimation();
          }
        }
      } else if (beatCountDiff === 0) {
        // Same number of beats - check if IDs are preserved
        // This happens during sequence transformations (mirror, rotate, color swap)
        // 🚀 PERFORMANCE: Quick check - compare first and last beat IDs
        const firstBeatIdMatch = previousBeatsRef[0]?.id === beats[0]?.id;
        const lastBeatIdMatch =
          previousBeatsRef[currentBeatCount - 1]?.id ===
          beats[currentBeatCount - 1]?.id;

        if (firstBeatIdMatch && lastBeatIdMatch && currentBeatCount > 0) {
          // Beat IDs preserved - this is a data update (transform), not a replacement
          // NO animation needed - beats will update in place
        } else {
          // Beat IDs changed - full sequence replacement (Generate mode)
          triggerFullAnimation();
        }
      } else {
        // Full sequence replacement (Generate mode)
        triggerFullAnimation();
      }
    } else if (currentBeatCount > previousBeatCount) {
      const beatsAdded = currentBeatCount - previousBeatCount;
      if (beatsAdded === 1) {
        // Single beat added
        displayState.handleSingleBeatAddition(currentBeatCount - 1);
      }
    }

    // Auto-scroll to bottom when beats added
    if (currentBeatCount > previousBeatCount) {
      scrollState.scrollToBottom();
    }

    previousBeatCount = currentBeatCount;
    previousBeatsRef = beats;
  });

  // Event handlers for animation events (defined at module level for cleanup)
  const handleAnimationModeChange = (event: Event) => {
    const customEvent = event as CustomEvent;
    displayState.setAnimationMode(
      customEvent.detail.isSequential ? "sequential" : "all-at-once"
    );
  };

  const handleClearSequenceAnimation = () => {
    displayState.handleClearSequence();
  };

  const handlePrepareSequenceAnimation = (event: Event) => {
    const customEvent = event as CustomEvent;
    displayState.prepareSequenceAnimation(
      customEvent.detail.beatCount,
      customEvent.detail.isSequential ? "sequential" : "all-at-once"
    );
  };

  // Initialize services and event listeners on mount
  // IMPORTANT: Event listeners must be set up in onMount (not $effect) to ensure
  // they're ready synchronously before any events are dispatched on first generation
  onMount(() => {
    hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);
    deviceDetector = resolve<IDeviceDetector>(TYPES.IDeviceDetector);

    // Set up animation event listeners synchronously on mount
    window.addEventListener("animation-mode-change", handleAnimationModeChange);
    window.addEventListener(
      "clear-sequence-animation",
      handleClearSequenceAnimation
    );
    window.addEventListener(
      "prepare-sequence-animation",
      handlePrepareSequenceAnimation
    );

    return () => {
      window.removeEventListener(
        "animation-mode-change",
        handleAnimationModeChange
      );
      window.removeEventListener(
        "clear-sequence-animation",
        handleClearSequenceAnimation
      );
      window.removeEventListener(
        "prepare-sequence-animation",
        handlePrepareSequenceAnimation
      );
    };
  });

  // Effect: Container resize tracking for responsive grid layout
  $effect(() => {
    if (!containerRef) return;

    // Set initial dimensions
    const rect = containerRef.getBoundingClientRect();
    containerWidth = rect.width;
    containerHeight = rect.height;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        containerWidth = width;
        containerHeight = height;
      }
    });

    resizeObserver.observe(containerRef);

    return () => {
      resizeObserver.disconnect();
    };
  });

  // Effect: Scroll container setup and resize tracking
  $effect(() => {
    if (!scrollContainerRef) return;

    // Setup scroll state
    scrollState.setScrollContainer(scrollContainerRef);

    const scrollResizeObserver = new ResizeObserver(() => {
      scrollState.checkScrollbar();
    });

    scrollResizeObserver.observe(scrollContainerRef);

    return () => {
      scrollResizeObserver.disconnect();
    };
  });

  function handleBeatClick(beatNumber: number) {
    hapticService?.trigger("selection");
    onBeatClick?.(beatNumber);
  }

  function handleStartClick() {
    hapticService?.trigger("selection");
    onStartClick?.();
  }

  // Composite key guard to avoid Svelte each_key_duplicate when legacy beats reuse ids
  const getBeatKey = (beat: BeatData, index: number) =>
    `${beat.id ?? "no-id"}-${beat.beatNumber ?? index}-${index}`;
</script>

<div
  class="beat-grid-container"
  class:spotlight-mode={isSpotlightMode}
  bind:this={containerRef}
>
  {#if beats.length === 0 && (!startPosition || startPosition.isBlank)}
    <!-- Empty grid state -->
    <div class="empty-grid-message">
      <span class="empty-icon">📋</span>
      <span class="empty-text">No sequence loaded</span>
    </div>
  {:else if isSpotlightMode}
    <!-- Spotlight mode: render grid directly without scroll wrapper -->
    <div
      class="beat-grid spotlight-static"
      class:clearing={isClearing || displayState.isClearingForGeneration}
      style:--grid-rows={gridLayout().rows}
      style:--grid-cols={gridLayout().totalColumns}
      style:--cell-size="{gridLayout().cellSize}px"
    >
      <!-- Start Position - only show if it has content -->
      {#if startPosition && !startPosition.isBlank}
        <div
          class="start-tile"
          class:has-pictograph={true}
          title="Start Position"
          role="button"
          tabindex="0"
          style:grid-row="1"
          style:grid-column="1"
          onclick={handleStartClick}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleStartClick();
            }
          }}
          aria-label="Start Position"
        >
          <BeatCell
            beat={startPosition}
            index={-1}
            shouldAnimate={displayState.shouldAnimateStartPosition}
            isSelected={selectedBeatNumber === 0}
            isPracticeBeat={practiceBeatNumber === 0}
            {activeMode}
            onLongPress={onBeatLongPress}
            onDelete={() => onBeatDelete?.(0)}
          />
        </div>
      {/if}

      <!-- Beat Grid -->
      {#each beats as beat, index (getBeatKey(beat, index))}
        {@const position = calculateBeatPosition(index, gridLayout().columns)}
        {@const gridRow = position.row}
        {@const gridCol = position.column}
        {@const isDeleting = removingBeatIndices.has(index)}
        {@const shouldSlide =
          removingBeatIndex !== null &&
          !isDeleting &&
          index > removingBeatIndex}
        {@const shouldAnimateBeat = displayState.shouldBeatAnimate(index)}
        {@const shouldHideBeat = displayState.shouldBeatBeHidden(index)}
        <div
          class="beat-container"
          class:deleting={isDeleting}
          class:sliding={shouldSlide}
          class:hidden-for-sequential={shouldHideBeat}
          style:grid-row={gridRow}
          style:grid-column={gridCol}
          style:animation-delay={shouldSlide
            ? `${Math.min(index - removingBeatIndex - 1, 5) * 50}ms`
            : "0ms"}
        >
          <BeatCell
            {beat}
            {index}
            onClick={() => handleBeatClick(beat.beatNumber)}
            onDelete={() => onBeatDelete?.(beat.beatNumber)}
            onLongPress={onBeatLongPress}
            shouldAnimate={shouldAnimateBeat}
            isSelected={selectedBeatNumber === beat.beatNumber}
            isPracticeBeat={practiceBeatNumber === beat.beatNumber}
            {activeMode}
            highlightStyle={highlightedBeats?.get(beat.beatNumber) ?? null}
          />
        </div>
      {/each}
    </div>
  {:else}
    <!-- Workspace mode: render grid inside scroll wrapper -->
    <div
      class="beat-grid-scroll"
      class:has-scrollbar={scrollState.hasVerticalScrollbar}
      bind:this={scrollContainerRef}
    >
      <div
        class="beat-grid"
        class:clearing={isClearing || displayState.isClearingForGeneration}
        style:--grid-rows={gridLayout().rows}
        style:--grid-cols={gridLayout().totalColumns}
        style:--cell-size="{gridLayout().cellSize}px"
      >
        <!-- Start Position - only show if it has content -->
        {#if startPosition && !startPosition.isBlank}
          <div
            class="start-tile"
            class:has-pictograph={true}
            title="Start Position"
            role="button"
            tabindex="0"
            style:grid-row="1"
            style:grid-column="1"
            onclick={handleStartClick}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleStartClick();
              }
            }}
            aria-label="Start Position"
          >
            <BeatCell
              beat={startPosition}
              index={-1}
              shouldAnimate={displayState.shouldAnimateStartPosition}
              isSelected={selectedBeatNumber === 0}
              isPracticeBeat={practiceBeatNumber === 0}
              {activeMode}
              onLongPress={onBeatLongPress}
              onDelete={() => onBeatDelete?.(0)}
            />
          </div>
        {/if}

        <!-- Beat Grid -->
        {#each beats as beat, index (getBeatKey(beat, index))}
          {@const position = calculateBeatPosition(index, gridLayout().columns)}
          {@const gridRow = position.row}
          {@const gridCol = position.column}
          {@const isDeleting = removingBeatIndices.has(index)}
          {@const shouldSlide =
            removingBeatIndex !== null &&
            !isDeleting &&
            index > removingBeatIndex}
          {@const shouldAnimateBeat = displayState.shouldBeatAnimate(index)}
          {@const shouldHideBeat = displayState.shouldBeatBeHidden(index)}
          <div
            class="beat-container"
            class:deleting={isDeleting}
            class:sliding={shouldSlide}
            class:hidden-for-sequential={shouldHideBeat}
            style:grid-row={gridRow}
            style:grid-column={gridCol}
            style:animation-delay={shouldSlide
              ? `${Math.min(index - removingBeatIndex - 1, 5) * 50}ms`
              : "0ms"}
          >
            <BeatCell
              {beat}
              {index}
              onClick={() => handleBeatClick(beat.beatNumber)}
              onDelete={() => onBeatDelete?.(beat.beatNumber)}
              onLongPress={onBeatLongPress}
              shouldAnimate={shouldAnimateBeat}
              isSelected={selectedBeatNumber === beat.beatNumber}
              isPracticeBeat={practiceBeatNumber === beat.beatNumber}
              {activeMode}
              highlightStyle={highlightedBeats?.get(beat.beatNumber) ?? null}
            />
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .beat-grid-container {
    position: relative;
    background: transparent;
    border-radius: 12px;
    overflow: hidden; /* Clip for rounded corners - scroll happens in child */
    width: 100%;
    height: 100%;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* Spotlight mode: container becomes flexbox to center the grid */
  .beat-grid-container.spotlight-mode {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-grid-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 8px;
    color: var(--theme-text-dim);
    font-size: 0.9rem;
  }

  .empty-icon {
    font-size: 2rem;
    opacity: 0.6;
  }

  .empty-text {
    font-weight: 500;
  }

  .beat-grid-scroll {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    display: flex;
    flex-direction: column; /* Column for margin:auto vertical centering */
    flex: 1 1 auto;
    min-height: 0; /* Critical for flex overflow scrolling */
    padding: 4px;
    box-sizing: border-box;

    /* Always-visible thin scrollbar styling */
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.4) rgba(255, 255, 255, 0.1);
  }

  /* Webkit scrollbar styling (Chrome, Safari, Edge) */
  .beat-grid-scroll::-webkit-scrollbar {
    width: 8px;
  }

  .beat-grid-scroll::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  .beat-grid-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.4);
    border-radius: 4px;
    border: 1px solid var(--theme-stroke);
  }

  .beat-grid-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.6);
  }

  /* Mobile: make scrollbar more visible */
  @media (max-width: 768px) {
    .beat-grid-scroll {
      scrollbar-width: auto;
      scrollbar-color: var(--theme-text-dim) rgba(255, 255, 255, 0.15);
    }

    .beat-grid-scroll::-webkit-scrollbar {
      width: 10px;
    }

    .beat-grid-scroll::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.5);
    }
  }

  /* When scrollbar is present, add right padding to prevent content clipping */
  .beat-grid-scroll.has-scrollbar {
    padding-right: 12px;
  }

  .beat-grid {
    display: grid;
    grid-template-columns: repeat(var(--grid-cols), var(--cell-size));
    grid-auto-rows: var(--cell-size);
    gap: 1px; /* Subtle separator between pictographs - background shows through */
    max-width: 100%;
    /* margin:auto centers both horizontally and vertically in block container */
    margin: auto;
    padding: 0;
    box-sizing: border-box;
    opacity: 1;
    transform: scale(1) translateY(0);
    transition:
      opacity 300ms ease-out,
      transform 300ms ease-out;
  }

  /* Spotlight mode: static grid without scroll wrapper */
  .beat-grid.spotlight-static {
    /* Center in container */
    margin: auto;
    /* Ensure grid fits within available space */
    max-width: 100%;
    max-height: 100%;
  }

  .beat-grid.clearing {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }

  .beat-container,
  .start-tile {
    margin: 0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .start-tile {
    border-radius: 8px;
    font-weight: 700;
    letter-spacing: 0.5px;
    background: transparent;
    transition: all 0.2s ease;
  }

  /* Beat deletion animations */
  .beat-container.deleting {
    animation: fadeOutDisintegrate 250ms ease-out forwards;
  }

  .beat-container.sliding {
    animation: slideIntoPlace 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)
      forwards;
  }

  /* Hide beats waiting for sequential animation */
  .beat-container.hidden-for-sequential {
    opacity: 0;
    pointer-events: none;
  }

  @keyframes fadeOutDisintegrate {
    0% {
      opacity: 1;
      transform: scale(1) rotate(0deg);
      filter: blur(0px);
    }
    50% {
      opacity: 0.6;
      transform: scale(0.9) rotate(-2deg);
      filter: blur(1px);
    }
    100% {
      opacity: 0;
      transform: scale(0.7) rotate(-5deg);
      filter: blur(3px);
      pointer-events: none;
    }
  }

  @keyframes slideIntoPlace {
    0% {
      transform: translateX(0) translateY(0);
    }
    50% {
      transform: translateX(-10px) translateY(-5px);
    }
    100% {
      transform: translateX(0) translateY(0);
    }
  }
</style>
