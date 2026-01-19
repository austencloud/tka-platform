<!-- StepGrid.svelte - Responsive step grid with display animations -->
<script lang="ts">
  import type { StepData } from "../../../domain/models/StepData";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
  import type { StartPositionData } from "../../../domain/models/StartPositionData";
  import type { TimeSignatureKey } from "$lib/shared/foundation/domain/models/TimeSignature";
  import { createStepData } from "../../../domain/factories/createStepData";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import {
    createStepGridDisplayState,
    isPendingGenerationAnimation,
    setPendingGenerationAnimation,
  } from "$lib/features/create/shared/workspace-panel/sequence-display/state/step-grid-display-state.svelte";
  import { createScrollState } from "$lib/features/create/shared/workspace-panel/sequence-display/state/scroll-state.svelte";
  import {
    calculateBeatPosition,
    calculateGridLayout,
    calculateTimelineRows,
    calculateTimelineUnitSize,
    calculateTimelinePadding,
    getTimelineWidthMultiplier,
    type TimelineRow,
  } from "../utils/grid-calculations";
  import StepCell from "./StepCell.svelte";
  import { formatDurationCompact } from "../../../domain/models/DurationPatternData";

  // Services
  const hapticService = container.items.hapticFeedback;
  const deviceDetector = container.items.deviceDetector;

  let {
    steps,
    startPosition = null,
    onStepClick,
    onStartClick,
    onStepDelete,
    onStepLongPress,
    selectedStepNumber = null, // 0=start, 1=first beat, 2=second beat, etc.
    removingStepIndex = null,
    removingStepIndices = new Set<number>(),
    isClearing = false,
    practiceStepNumber = null, // 0=start, 1=first beat, 2=second beat, etc.
    isSideBySideLayout = false,
    shouldOrbitAroundCenter = false,
    activeMode = null,
    // Spotlight mode: maximize cell size to fill viewport
    isSpotlightMode = false,
    // Timeline mode: cell width proportional to step duration
    isTimelineMode = false,
    // Manual column override (null = auto)
    manualColumnCount = null,
    // Highlighted steps for multi-select/section highlighting
    highlightedSteps = null,
    // Height sizing threshold: grids with this many rows or fewer will consider height when sizing
    // Default 4 (workspace mode), use higher values (e.g., 20) for fixed-height containers
    heightSizingRowThreshold = undefined,
    // Multi-select support
    selectedStepNumbers = new Set<number>(),
    isMultiSelectMode = false,
    onStartLongPress,
    // Time signature for musical position calculation
    timeSignature = undefined,
  } = $props<{
    steps: ReadonlyArray<StepData> | StepData[];
    startPosition?: StartPositionData | StepData | null;
    onStepClick?: (stepNumber: number) => void;
    onStartClick?: () => void;
    onStepDelete?: (stepNumber: number) => void;
    onStepLongPress?: (stepNumber: number) => void;
    selectedStepNumber?: number | null; // 0=start, 1=first beat, 2=second beat, etc.
    removingStepIndex?: number | null;
    removingStepIndices?: Set<number>;
    isClearing?: boolean;
    practiceStepNumber?: number | null; // 0=start, 1=first beat, 2=second beat, etc.
    isSideBySideLayout?: boolean;
    shouldOrbitAroundCenter?: boolean;
    activeMode?: BuildModeId | null;
    // Spotlight mode: maximize cell size to fill viewport (no max constraint)
    isSpotlightMode?: boolean;
    // Timeline mode: cell width proportional to step duration
    isTimelineMode?: boolean;
    // Manual column override (null = auto)
    manualColumnCount?: number | null;
    // Highlighted steps for multi-select/section highlighting (stepNumber -> style)
    highlightedSteps?: Map<number, { bg: string; border: string }> | null;
    // Height sizing threshold: grids with this many rows or fewer will consider height when sizing
    // Default 4 (workspace mode), use higher values (e.g., 20) for fixed-height containers
    heightSizingRowThreshold?: number;
    // Multi-select support
    selectedStepNumbers?: Set<number>;
    isMultiSelectMode?: boolean;
    onStartLongPress?: () => void;
    // Time signature for musical position calculation (e.g., "4/4", "6/8")
    timeSignature?: TimeSignatureKey;
  }>();

  const placeholderStep = createStepData({
    stepNumber: 0,
    isBlank: true,
  });

  // State management - isolated concerns
  const displayState = createStepGridDisplayState();
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
      steps.length,
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

  // Timeline mode: calculate row assignments based on duration capacity
  // Returns empty array when not in timeline mode
  // Note: Uses fixed capacity of 4 duration units per row (not grid layout columns)
  // This ensures consistent timeline behavior regardless of container width
  // Start position is rendered in its own column (like grid mode), not consuming row capacity
  const TIMELINE_ROW_CAPACITY = 4;
  const timelineRows = $derived(() => {
    if (!isTimelineMode) return [];
    // Don't pass hasStartPosition - start position gets its own column like grid mode
    return calculateTimelineRows(steps, TIMELINE_ROW_CAPACITY, false);
  });

  // Timeline mode: calculate unit size based on FULL row capacity (5 columns)
  // This keeps pictograph size consistent as you add beats - no jarring size changes
  // The timeline-container will center itself using CSS margin: auto as content grows
  const timelineUnitSize = $derived(() => {
    if (!isTimelineMode) return 0;
    const hasStart = startPosition && !startPosition.isBlank;
    // Always size for full capacity: start column (if present) + row capacity
    // This ensures cells stay the same size whether you have 1 beat or 5 beats
    const totalUnits = hasStart ? TIMELINE_ROW_CAPACITY + 1 : TIMELINE_ROW_CAPACITY;
    return calculateTimelineUnitSize(containerWidth, totalUnits);
  });

  // Timeline mode: calculate responsive padding based on container width
  const timelinePadding = $derived(() => {
    return calculateTimelinePadding(containerWidth);
  });

  // Track previous beat state for change detection
  // IMPORTANT: Initialize to 0/empty to detect first mount WITH steps (from Generate)
  // This ensures we trigger animation when component is mounted with pre-populated steps
  let previousStepCount = 0;
  let previousStepsRef: ReadonlyArray<StepData> | StepData[] = [];
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
      await displayState.triggerSequentialAnimation(steps, dispatchEvent);
    } else {
      displayState.triggerAllAtOnceAnimation();
    }
  }

  // Handle beat changes and trigger appropriate animations
  $effect(() => {
    const currentStepCount = steps.length;
    const beatsArrayChanged = steps !== previousStepsRef;

    // Handle first render with pre-populated steps (component mounted after Generate clicked)
    // In this case, the prepare event was fired before component existed, so we need to
    // manually prepare and trigger the animation.
    // IMPORTANT: Only animate if pendingGenerationAnimation flag is true (set by Generate flow).
    // This prevents animation when loading saved sequences on app startup.
    if (isFirstRender && currentStepCount > 0) {
      isFirstRender = false;

      // Only animate if this is from a Generate action, not a loaded sequence
      if (isPendingGenerationAnimation()) {
        // Clear the flag immediately to prevent re-triggering
        setPendingGenerationAnimation(false);

        // Manually prepare for animation since we missed the event
        displayState.prepareSequenceAnimation(currentStepCount, "sequential");

        // Small delay to let state settle, then trigger animation
        setTimeout(() => {
          triggerFullAnimation();
        }, 10);
      }

      previousStepCount = currentStepCount;
      previousStepsRef = steps;
      return;
    }

    isFirstRender = false;

    if (beatsArrayChanged && currentStepCount > 0) {
      const beatCountDiff = currentStepCount - previousStepCount;

      if (beatCountDiff === 1) {
        // Single beat added - handles both first beat (previousStepCount = 0) and subsequent steps
        if (previousStepCount === 0) {
          // First beat added (e.g., Assembly mode starting fresh)
          displayState.handleSingleBeatAddition(currentStepCount - 1);
        } else if (activeMode === "assembler") {
          // Assembly mode: always animate new beat
          // Assembly regenerates all steps with new IDs on each update, so ID comparison won't work
          displayState.handleSingleBeatAddition(currentStepCount - 1);
        } else {
          // 🚀 PERFORMANCE: Check only the last beat ID instead of iterating through all steps
          // This is O(1) instead of O(n), eliminating the 60-70ms setTimeout violations
          const lastPreviousBeat = previousStepsRef[previousStepCount - 1];
          const lastCurrentBeat = steps[previousStepCount - 1];
          const previousBeatsUnchanged =
            lastPreviousBeat &&
            lastCurrentBeat &&
            lastPreviousBeat.id === lastCurrentBeat.id;

          if (previousBeatsUnchanged) {
            // Single beat added (Construct mode)
            displayState.handleSingleBeatAddition(currentStepCount - 1);
          } else {
            // Steps replaced - trigger full animation with delay
            // Delay ensures StepCell onMount callbacks complete before animation starts,
            // preventing the HMR guard from incorrectly blocking animations
            setTimeout(() => {
              triggerFullAnimation();
            }, 10);
          }
        }
      } else if (beatCountDiff === 0) {
        // Same number of steps - check if IDs are preserved
        // This happens during sequence transformations (mirror, rotate, color swap)
        // 🚀 PERFORMANCE: Quick check - compare first and last beat IDs
        const firstBeatIdMatch = previousStepsRef[0]?.id === steps[0]?.id;
        const lastBeatIdMatch =
          previousStepsRef[currentStepCount - 1]?.id ===
          steps[currentStepCount - 1]?.id;

        if (firstBeatIdMatch && lastBeatIdMatch && currentStepCount > 0) {
          // Beat IDs preserved - this is a data update (transform), not a replacement
          // NO animation needed - steps will update in place
        } else {
          // Beat IDs changed - full sequence replacement (Generate mode)
          // Delay ensures StepCell onMount callbacks complete before animation starts,
          // preventing the HMR guard from incorrectly blocking animations
          setTimeout(() => {
            triggerFullAnimation();
          }, 10);
        }
      } else {
        // Full sequence replacement (Generate mode)
        // Delay ensures StepCell onMount callbacks complete before animation starts,
        // preventing the HMR guard from incorrectly blocking animations
        setTimeout(() => {
          triggerFullAnimation();
        }, 10);
      }
    } else if (currentStepCount > previousStepCount) {
      const stepsAdded = currentStepCount - previousStepCount;
      if (stepsAdded === 1) {
        // Single beat added
        displayState.handleSingleBeatAddition(currentStepCount - 1);
      }
    }

    // Auto-scroll to bottom when steps added
    if (currentStepCount > previousStepCount) {
      scrollState.scrollToBottom();
    }

    previousStepCount = currentStepCount;
    previousStepsRef = steps;
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
      customEvent.detail.stepCount,
      customEvent.detail.isSequential ? "sequential" : "all-at-once"
    );
  };

  // Initialize event listeners on mount
  // IMPORTANT: Event listeners must be set up in onMount (not $effect) to ensure
  // they're ready synchronously before any events are dispatched on first generation
  onMount(() => {
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

  function handleStepClick(stepNumber: number) {
    hapticService?.trigger("selection");
    onStepClick?.(stepNumber);
  }

  function handleStartClick() {
    hapticService?.trigger("selection");
    onStartClick?.();
  }

  // Composite key guard to avoid Svelte each_key_duplicate when legacy steps reuse ids
  const getBeatKey = (beat: StepData, index: number) =>
    `${beat.id ?? "no-id"}-${beat.stepNumber ?? index}-${index}`;

  // Helper to get duration display for a step
  // Returns the formatted duration string (e.g., "1×", "50%", "2×")
  function getDurationDisplay(stepIndex: number): string {
    const beat = steps[stepIndex];
    const duration = beat?.duration ?? 1.0;
    return formatDurationCompact(duration);
  }
</script>

<div
  class="step-grid-container"
  class:spotlight-mode={isSpotlightMode}
  bind:this={containerRef}
>
  {#if steps.length === 0 && (!startPosition || startPosition.isBlank)}
    <!-- Empty grid state -->
    <div class="empty-grid-message">
      <span class="empty-icon">📋</span>
      <span class="empty-text">No sequence loaded</span>
    </div>
  {:else if isSpotlightMode}
    <!-- Spotlight mode: render grid directly without scroll wrapper -->
    <div
      class="step-grid spotlight-static"
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
            if (e.key === "Enter") {
              e.preventDefault();
              handleStartClick();
            } else if (e.key === " ") {
              // Prevent browser default click, let global shortcuts handle Space
              e.preventDefault();
            }
          }}
          aria-label="Start Position"
        >
          <StepCell
            beat={startPosition}
            index={-1}
            shouldAnimate={displayState.shouldAnimateStartPosition}
            isSelected={selectedStepNumber === 0}
            isPracticeStep={practiceStepNumber === 0}
            {activeMode}
            onLongPress={onStepLongPress}
            onDelete={() => onStepDelete?.(0)}
            animationEpoch={displayState.animationEpoch}
          />
        </div>
      {/if}

      <!-- Step Grid -->
      {#each steps as beat, index (getBeatKey(beat, index))}
        {@const position = calculateBeatPosition(index, gridLayout().columns)}
        {@const gridRow = position.row}
        {@const gridCol = position.column}
        {@const isDeleting = removingStepIndices.has(index)}
        {@const shouldSlide =
          removingStepIndex !== null &&
          !isDeleting &&
          index > removingStepIndex}
        {@const musicalPosition = getDurationDisplay(index)}
        <div
          class="beat-container"
          class:deleting={isDeleting}
          class:sliding={shouldSlide}
          class:hidden-for-sequential={displayState.shouldBeatBeHidden(index)}
          style:grid-row={gridRow}
          style:grid-column={gridCol}
          style:animation-delay={shouldSlide
            ? `${Math.min(index - removingStepIndex - 1, 5) * 50}ms`
            : "0ms"}
        >
          <StepCell
            {beat}
            {index}
            onClick={() => handleStepClick(beat.stepNumber)}
            onDelete={() => onStepDelete?.(beat.stepNumber)}
            onLongPress={onStepLongPress}
            shouldAnimate={displayState.shouldBeatAnimate(index)}
            isSelected={selectedStepNumber === beat.stepNumber}
            isPracticeStep={practiceStepNumber === beat.stepNumber}
            {activeMode}
            highlightStyle={highlightedSteps?.get(beat.stepNumber) ?? null}
            {musicalPosition}
            animationEpoch={displayState.animationEpoch}
          />
        </div>
      {/each}
    </div>
  {:else if isTimelineMode}
    <!-- Timeline mode: start position in own column (like grid mode), rows with duration-proportional widths -->
    <div
      class="step-grid-scroll timeline-scroll"
      class:has-scrollbar={scrollState.hasVerticalScrollbar}
      bind:this={scrollContainerRef}
    >
      <div
        class="timeline-container"
        class:clearing={isClearing || displayState.isClearingForGeneration}
        style:--cell-size="{timelineUnitSize()}px"
        style:--timeline-padding="{timelinePadding()}px"
      >
        <!-- Start Position Column (matches grid mode layout) -->
        {#if startPosition && !startPosition.isBlank}
          <div class="timeline-start-column">
            <div
              class="timeline-cell start-tile"
              class:timeline-selected={selectedStepNumber === 0}
              class:timeline-practice={practiceStepNumber === 0}
              style:--duration-multiplier={1}
              title="Start Position"
              role="button"
              tabindex="0"
              onclick={handleStartClick}
              onkeydown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleStartClick();
                } else if (e.key === " ") {
                  e.preventDefault();
                }
              }}
              aria-label="Start Position"
            >
              <StepCell
                beat={startPosition}
                index={-1}
                shouldAnimate={displayState.shouldAnimateStartPosition}
                isSelected={selectedStepNumber === 0}
                isPracticeStep={practiceStepNumber === 0}
                {activeMode}
                onLongPress={onStepLongPress}
                onDelete={() => onStepDelete?.(0)}
                isTimelineMode={true}
                animationEpoch={displayState.animationEpoch}
              />
            </div>
          </div>
        {/if}

        <!-- Timeline Rows (full capacity, not reduced by start position) -->
        <div class="timeline-rows">
          {#each timelineRows() as row, rowIndex (rowIndex)}
            <div class="timeline-row">
              {#each row.steps as { stepIndex, duration } (getBeatKey(steps[stepIndex], stepIndex))}
                {@const beat = steps[stepIndex]}
                {@const isDeleting = removingStepIndices.has(stepIndex)}
                {@const shouldSlide =
                  removingStepIndex !== null &&
                  !isDeleting &&
                  stepIndex > removingStepIndex}
                {@const musicalPosition = getDurationDisplay(stepIndex)}
                <div
                  class="timeline-cell beat-container"
                  class:deleting={isDeleting}
                  class:sliding={shouldSlide}
                  class:hidden-for-sequential={displayState.shouldBeatBeHidden(stepIndex)}
                  class:timeline-selected={selectedStepNumber === beat.stepNumber}
                  class:timeline-practice={practiceStepNumber === beat.stepNumber}
                  style:--duration-multiplier={getTimelineWidthMultiplier(duration)}
                  style:animation-delay={shouldSlide
                    ? `${Math.min(stepIndex - removingStepIndex - 1, 5) * 50}ms`
                    : "0ms"}
                >
                  <StepCell
                    {beat}
                    index={stepIndex}
                    onClick={() => handleStepClick(beat.stepNumber)}
                    onDelete={() => onStepDelete?.(beat.stepNumber)}
                    onLongPress={onStepLongPress}
                    shouldAnimate={displayState.shouldBeatAnimate(stepIndex)}
                    isSelected={selectedStepNumber === beat.stepNumber}
                    isPracticeStep={practiceStepNumber === beat.stepNumber}
                    {activeMode}
                    highlightStyle={highlightedSteps?.get(beat.stepNumber) ?? null}
                    {musicalPosition}
                    isTimelineMode={true}
                    widthMultiplier={duration}
                    animationEpoch={displayState.animationEpoch}
                  />
                </div>
              {/each}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <!-- Grid mode: render standard grid inside scroll wrapper -->
    <div
      class="step-grid-scroll"
      class:has-scrollbar={scrollState.hasVerticalScrollbar}
      bind:this={scrollContainerRef}
    >
      <div
        class="step-grid"
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
              if (e.key === "Enter") {
                e.preventDefault();
                handleStartClick();
              } else if (e.key === " ") {
                // Prevent browser default click, let global shortcuts handle Space
                e.preventDefault();
              }
            }}
            aria-label="Start Position"
          >
            <StepCell
              beat={startPosition}
              index={-1}
              shouldAnimate={displayState.shouldAnimateStartPosition}
              isSelected={selectedStepNumber === 0}
              isPracticeStep={practiceStepNumber === 0}
              {activeMode}
              onLongPress={onStepLongPress}
              onDelete={() => onStepDelete?.(0)}
              animationEpoch={displayState.animationEpoch}
            />
          </div>
        {/if}

        <!-- Step Grid -->
        {#each steps as beat, index (getBeatKey(beat, index))}
          {@const position = calculateBeatPosition(index, gridLayout().columns)}
          {@const gridRow = position.row}
          {@const gridCol = position.column}
          {@const isDeleting = removingStepIndices.has(index)}
          {@const shouldSlide =
            removingStepIndex !== null &&
            !isDeleting &&
            index > removingStepIndex}
          {@const musicalPosition = getDurationDisplay(index)}
          <div
            class="beat-container"
            class:deleting={isDeleting}
            class:sliding={shouldSlide}
            class:hidden-for-sequential={displayState.shouldBeatBeHidden(index)}
            style:grid-row={gridRow}
            style:grid-column={gridCol}
            style:animation-delay={shouldSlide
              ? `${Math.min(index - removingStepIndex - 1, 5) * 50}ms`
              : "0ms"}
          >
            <StepCell
              {beat}
              {index}
              onClick={() => handleStepClick(beat.stepNumber)}
              onDelete={() => onStepDelete?.(beat.stepNumber)}
              onLongPress={onStepLongPress}
              shouldAnimate={displayState.shouldBeatAnimate(index)}
              isSelected={selectedStepNumber === beat.stepNumber}
              isPracticeStep={practiceStepNumber === beat.stepNumber}
              {activeMode}
              highlightStyle={highlightedSteps?.get(beat.stepNumber) ?? null}
              {musicalPosition}
              animationEpoch={displayState.animationEpoch}
            />
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .step-grid-container {
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
  .step-grid-container.spotlight-mode {
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

  .step-grid-scroll {
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
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  /* Webkit scrollbar styling (Chrome, Safari, Edge) */
  .step-grid-scroll::-webkit-scrollbar {
    width: 8px;
  }

  .step-grid-scroll::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
    border-radius: 4px;
  }

  .step-grid-scroll::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }

  .step-grid-scroll::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  /* Mobile: make scrollbar more visible */
  @media (max-width: 768px) {
    .step-grid-scroll {
      scrollbar-width: auto;
      scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
    }

    .step-grid-scroll::-webkit-scrollbar {
      width: 10px;
    }

    .step-grid-scroll::-webkit-scrollbar-thumb {
      background: var(--scrollbar-thumb);
    }
  }

  /* When scrollbar is present, add right padding to prevent content clipping */
  .step-grid-scroll.has-scrollbar {
    padding-right: 12px;
  }

  /* ============================================
     TIMELINE MODE STYLES
     Column layout: start position on left, timeline rows on right
     Matches grid mode's treatment of start position
     ============================================ */

  /* Timeline scroll container */
  .step-grid-scroll.timeline-scroll {
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* Timeline container - horizontal layout: start column + timeline rows */
  .timeline-container {
    display: flex;
    flex-direction: row;
    gap: 1px;
    /* Use fit-content so container only takes space it needs, then margin: auto centers it */
    width: fit-content;
    max-width: calc(100% - var(--timeline-padding, 16px)); /* Breathing room on each side */
    margin: auto;
    padding: 0;
    opacity: 1;
    transform: scale(1) translateY(0);
    transition:
      opacity 300ms ease-out,
      transform 300ms ease-out;
  }

  .timeline-container.clearing {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }

  /* Start position column - fixed width, aligns to top */
  .timeline-start-column {
    width: var(--cell-size);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    /* Don't stretch to fill height - keep start position at top */
    align-self: flex-start;
  }

  /* Start cell in column should be square, not stretch to full height */
  .timeline-start-column .timeline-cell {
    height: var(--cell-size);
  }

  /* Timeline rows container - fills remaining width */
  .timeline-rows {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0; /* Allow shrinking below content size */
  }

  /* Each row in the timeline */
  .timeline-row {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: var(--cell-size);
  }

  /* Individual cell in timeline row - pixel-based width from duration */
  .timeline-cell {
    /* Width = cell-size × duration-multiplier (duration=1 is square, duration=2 is 2x wide) */
    width: calc(var(--cell-size) * var(--duration-multiplier, 1));
    flex-shrink: 0;
    flex-grow: 0;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;

    /* Dark background fills entire cell (including extra width for duration > 1) */
    background: var(--dm-pictograph-bg, #0a0a0f);
    border-radius: 4px;
  }

  /* Selection in timeline mode - wraps entire cell */
  .timeline-cell.timeline-selected {
    z-index: 10;
    border: 3px solid transparent;
    /* Gradient border trick: solid dark bg for content, gold gradient for border */
    background:
      linear-gradient(var(--dm-pictograph-bg, #0a0a0f), var(--dm-pictograph-bg, #0a0a0f)) padding-box,
      linear-gradient(135deg, var(--semantic-warning), var(--semantic-warning), #d97706) border-box;
    border-radius: 8px;
    box-shadow:
      0 0 20px rgba(251, 191, 36, 0.5),
      0 8px 32px rgba(251, 191, 36, 0.3);
    transform: scale(1.03);
  }

  /* Practice step in timeline mode */
  .timeline-cell.timeline-practice {
    z-index: 10;
    border: 3px solid var(--semantic-warning);
    border-radius: 8px;
    box-shadow: 0 0 16px rgba(251, 191, 36, 0.5);
  }

  /* ============================================
     GRID MODE STYLES
     Standard CSS Grid with uniform cell sizes
     ============================================ */

  .step-grid {
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
  .step-grid.spotlight-static {
    /* Center in container */
    margin: auto;
    /* Ensure grid fits within available space */
    max-width: 100%;
    max-height: 100%;
  }

  .step-grid.clearing {
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

  /* Start tile inherits all styling from shared .beat-container, .start-tile rule above.
     No additional styling needed - keeps it visually consistent with beat cells. */

  /* Beat deletion animations */
  .beat-container.deleting {
    animation: fadeOutDisintegrate var(--duration-normal) ease-out forwards;
  }

  .beat-container.sliding {
    animation: slideIntoPlace var(--duration-normal) cubic-bezier(0.25, 0.46, 0.45, 0.94)
      forwards;
  }

  /* Hide steps waiting for sequential animation */
  .beat-container.hidden-for-sequential {
    opacity: 0;
    pointer-events: none;
  }

  /* Timeline mode: override width: 100% from .beat-container/.start-tile */
  /* Must come after those rules to win CSS cascade */
  .timeline-cell.beat-container,
  .timeline-cell.start-tile {
    width: calc(var(--cell-size) * var(--duration-multiplier, 1));
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

  /* ============================================
     EXPANDED CELL GLYPH OVERLAY
     Positions glyphs at corners of expanded timeline cells
     to visually communicate the cell's expanded duration
     ============================================ */

  .timeline-cell.timeline-expanded {
    position: relative;
  }

  .expanded-glyph-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
  }

  /* Step number - top-left corner */
  .expanded-step-number {
    position: absolute;
    top: 4px;
    left: 6px;
    font-family: Georgia, serif;
    font-weight: bold;
    font-size: clamp(14px, 3.5cqw, 20px);
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  /* TKA letter - bottom-left corner */
  .expanded-tka-letter {
    position: absolute;
    bottom: 4px;
    left: 6px;
    font-family: Georgia, serif;
    font-weight: bold;
    font-size: clamp(16px, 4cqw, 24px);
    color: #00b8b8;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  /* Duration indicator - top-right corner */
  .expanded-duration {
    position: absolute;
    top: 4px;
    right: 6px;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    font-weight: 600;
    font-size: clamp(12px, 3cqw, 16px);
    color: rgba(255, 255, 255, 0.7);
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 4px;
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .deleting {
      animation: none;
    }
    .sliding {
      animation: none;
    }
    /* Disable local keyframe animations */
    [style*="fadeOutDisintegrate"] {
      animation: none;
    }
    [style*="slideIntoPlace"] {
      animation: none;
    }
  }
</style>
