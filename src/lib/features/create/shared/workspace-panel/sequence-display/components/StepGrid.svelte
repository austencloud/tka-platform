<!-- StepGrid.svelte - Responsive step grid with display animations -->
<script lang="ts">
  import { getDeviceDetector } from "$lib/shared/device/get-device-detector";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { DeviceDetector } from '$lib/shared/device/services/device-detector'
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { BuildModeId } from "$lib/shared/foundation/ui/ui-types";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
  import type { TimeSignatureKey } from "$lib/shared/foundation/domain/models/time-signature";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { createStepData } from "$lib/shared/create/factories/create-step-data";
  import { onMount } from "svelte";
  import {
    createStepGridDisplayState,
    isPendingGenerationAnimation,
    setPendingGenerationAnimation,
    consumeSuppressNextAnimation,
  } from "$lib/features/create/shared/workspace-panel/sequence-display/state/step-grid-display-state.svelte";
  import { createScrollState } from "$lib/features/create/shared/workspace-panel/sequence-display/state/scroll-state.svelte";
  import {
    calculateGridLayout,
    calculateTimelineRowsByBeatCount,
    calculateTimelineUnitSize,
    calculateTimelinePadding,
  } from "$lib/shared/create/utils/grid-calculations";
  import { formatDurationCompact } from "../../../domain/models/duration-pattern-data";
  import WorkspaceGrid from "./WorkspaceGrid.svelte";

  // Services
  const hapticService = getHapticFeedback();
  const deviceDetector = getDeviceDetector();

  let {
    steps,
    startPosition = null,
    onStepClick,
    onStartClick,
    onStepDelete,
    onStepLongPress,
    selectedStepNumber = null,
    removingStepIndex = null,
    removingStepIndices = new Set<number>(),
    isClearing = false,
    practiceStepNumber = null,
    isSideBySideLayout = false,
    shouldOrbitAroundCenter = false,
    activeMode = null,
    isTimelineMode = false,
    manualColumnCount = null,
    highlightedSteps = null,
    heightSizingRowThreshold = undefined,
    selectedStepNumbers = new Set<number>(),
    isMultiSelectMode = false,
    onStartLongPress,
    onDurationChange,
    timeSignature = undefined,
    bluePropTypeOverride = undefined,
    redPropTypeOverride = undefined,
    sequenceWord = "",
  } = $props<{
    steps: ReadonlyArray<StepData> | StepData[];
    startPosition?: StartPositionData | StepData | null;
    onStepClick?: (stepNumber: number) => void;
    onStartClick?: () => void;
    onStepDelete?: (stepNumber: number) => void;
    onStepLongPress?: (stepNumber: number) => void;
    selectedStepNumber?: number | null;
    removingStepIndex?: number | null;
    removingStepIndices?: Set<number>;
    isClearing?: boolean;
    practiceStepNumber?: number | null;
    isSideBySideLayout?: boolean;
    shouldOrbitAroundCenter?: boolean;
    activeMode?: BuildModeId | null;
    isTimelineMode?: boolean;
    manualColumnCount?: number | null;
    highlightedSteps?: Map<number, { bg: string; border: string }> | null;
    heightSizingRowThreshold?: number;
    selectedStepNumbers?: Set<number>;
    isMultiSelectMode?: boolean;
    onStartLongPress?: () => void;
    onDurationChange?: (stepNumber: number, newDuration: number) => void;
    timeSignature?: TimeSignatureKey;
    /** Override prop type for blue hand. Used by demos/previews to bypass global settings. */
    bluePropTypeOverride?: PropType;
    /** Override prop type for red hand. Used by demos/previews to bypass global settings. */
    redPropTypeOverride?: PropType;
    sequenceWord?: string;
  }>();

  // State management
  const displayState = createStepGridDisplayState();
  const scrollState = createScrollState();

  // Container dimensions for responsive sizing
  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let containerRef: HTMLElement | undefined = $state();
  let scrollContainerRef: HTMLElement | undefined = $state();

  // Breathing room (px, each side) reserved around the grid so a selected or
  // hovered cell's gold border + scale "pop" never reaches the hard clip on
  // .scroll-wrapper (overflow-x: hidden) / .step-grid-container (overflow:
  // hidden). MUST equal the .scroll-wrapper padding in WorkspaceGrid.svelte —
  // that padding is where the pop renders, and reserving it here keeps cells
  // sized to the wrapper's content box so they don't spill into it.
  const POP_RESERVE = 16;

  // Computed grid layout - must use $derived.by for reactive recalculation
  const gridLayout = $derived.by(() => {
    const layout = calculateGridLayout(
      steps.length,
      Math.max(0, containerWidth - 2 * POP_RESERVE),
      Math.max(0, containerHeight - 2 * POP_RESERVE),
      deviceDetector,
      {
        isSideBySideLayout,
        heightSizingRowThreshold,
        manualColumnCount,
      }
    );
    return layout;
  });

  // Timeline mode: beats per row matches the grid layout's column count so
  // swing/duration sequences show the same number of beats per row as uniform
  // sequences. Manual column count (from LOOP alignment) overrides.
  const timelineBeatsPerRow = $derived(
    manualColumnCount ?? gridLayout.columns
  );
  const timelineRows = $derived.by(() => {
    if (!isTimelineMode) return [];
    return calculateTimelineRowsByBeatCount(steps, timelineBeatsPerRow);
  });

  const timelineUnitSize = $derived.by(() => {
    if (!isTimelineMode) return 0;
    const hasStart = startPosition && !startPosition.isBlank;
    const actualCellCount = steps.length + (hasStart ? 1 : 0);

    // Find the widest row's duration to use as the sizing denominator.
    // Add 1 for start position if present.
    let maxRowDuration = 0;
    for (const row of timelineRows) {
      maxRowDuration = Math.max(maxRowDuration, row.totalDuration);
    }
    const fullRowUnits = maxRowDuration + (hasStart ? 1 : 0);

    // Mobile-adaptive: on narrow screens, size based on actual cell count
    const isNarrow = containerWidth > 0 && containerWidth < 650;
    const totalUnits = isNarrow
      ? Math.max(Math.min(actualCellCount, fullRowUnits), 2)
      : Math.max(fullRowUnits, 2);

    // Reserve the .scroll-wrapper padding (POP_RESERVE each side) so cells are
    // sized to the wrapper's CONTENT box, not its full width. This keeps edge
    // cells off the scroll-wrapper/step-grid-container clip boundary, leaving
    // that padding as guaranteed room for the selected/hovered cell's gold
    // border + pop to render without being cut (horizontal AND vertical).
    const sizingWidth = Math.max(0, containerWidth - 2 * POP_RESERVE);
    const widthBased = calculateTimelineUnitSize(sizingWidth, totalUnits);

    // Constrain by available height so all rows fit without scrolling
    if (containerHeight > 0 && timelineRows.length > 0) {
      const gaps = (timelineRows.length - 1) * 1;
      const padding = 8;
      const availableHeight =
        containerHeight - 2 * POP_RESERVE - gaps - padding;
      const heightBased = Math.floor(availableHeight / timelineRows.length);
      return Math.max(48, Math.min(widthBased, heightBased));
    }

    return widthBased;
  });

  const timelinePadding = $derived.by(() => {
    return calculateTimelinePadding(containerWidth);
  });

  // Track previous beat state for change detection
  let previousStepCount = 0;
  let previousStepsRef: ReadonlyArray<StepData> | StepData[] = [];
  let isFirstRender = true;

  // Helper to trigger animations
  async function triggerFullAnimation() {
    if (!containerRef) return;
    if (!displayState.isPreparingFullAnimation) return;

    const dispatchEvent = (event: CustomEvent) =>
      containerRef?.dispatchEvent(event);
    const mode = displayState.isSequentialMode ? "sequential" : "all-at-once";

    if (mode === "sequential") {
      await displayState.triggerSequentialAnimation(steps, dispatchEvent);
    } else {
      displayState.triggerAllAtOnceAnimation();
    }
  }

  // Helper to trigger cycle extension animation (only new beats)
  async function triggerCycleExtensionAnimation(startFromIndex: number) {
    if (!containerRef) return;

    const dispatchEvent = (event: CustomEvent) =>
      containerRef?.dispatchEvent(event);
    await displayState.triggerSequentialAnimation(
      steps,
      dispatchEvent,
      startFromIndex
    );
  }

  // Handle beat changes and trigger appropriate animations
  $effect(() => {
    const currentStepCount = steps.length;
    const beatsArrayChanged = steps !== previousStepsRef;

    // Undo/redo/jumpToState sets this flag before restoring.
    // Skip all entrance animations and just update tracking refs.
    if (beatsArrayChanged && consumeSuppressNextAnimation()) {
      displayState.cleanupAnimation();
      previousStepCount = currentStepCount;
      previousStepsRef = steps;
      return;
    }

    if (isFirstRender && currentStepCount > 0) {
      isFirstRender = false;

      if (isPendingGenerationAnimation()) {
        setPendingGenerationAnimation(false);
        displayState.prepareSequenceAnimation(currentStepCount, "sequential");
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
      const stepCountDiff = currentStepCount - previousStepCount;

      if (stepCountDiff === 1) {
        if (previousStepCount === 0) {
          displayState.handleSingleBeatAddition(currentStepCount - 1);
        } else {
          const lastPreviousBeat = previousStepsRef[previousStepCount - 1];
          const lastCurrentBeat = steps[previousStepCount - 1];
          const previousBeatsUnchanged =
            lastPreviousBeat &&
            lastCurrentBeat &&
            lastPreviousBeat.id === lastCurrentBeat.id;

          if (previousBeatsUnchanged) {
            displayState.handleSingleBeatAddition(currentStepCount - 1);
          } else {
            setTimeout(() => {
              triggerFullAnimation();
            }, 10);
          }
        }
      } else if (stepCountDiff === 0) {
        const firstStepIdMatch = previousStepsRef[0]?.id === steps[0]?.id;
        const lastStepIdMatch =
          previousStepsRef[currentStepCount - 1]?.id ===
          steps[currentStepCount - 1]?.id;

        if (!(firstStepIdMatch && lastStepIdMatch && currentStepCount > 0)) {
          setTimeout(() => {
            triggerFullAnimation();
          }, 10);
        }
      } else if (
        stepCountDiff > 1 &&
        displayState.isWaitingForSequentialAnimation &&
        !displayState.isPreparingFullAnimation
      ) {
        // Cycle extension: only animate the new beats
        const startFrom = previousStepCount;
        setTimeout(() => {
          triggerCycleExtensionAnimation(startFrom);
        }, 10);
      } else {
        setTimeout(() => {
          triggerFullAnimation();
        }, 10);
      }
    } else if (currentStepCount > previousStepCount) {
      const stepsAdded = currentStepCount - previousStepCount;
      if (stepsAdded === 1) {
        displayState.handleSingleBeatAddition(currentStepCount - 1);
      }
    }

    // Scroll behavior based on how steps were added
    if (currentStepCount > previousStepCount) {
      const stepsAdded = currentStepCount - previousStepCount;
      if (stepsAdded === 1) {
        // Single step added (constructor/assemble) - scroll to see the new step
        scrollState.scrollToBottom();
      } else if (
        displayState.isWaitingForSequentialAnimation &&
        !displayState.isPreparingFullAnimation
      ) {
        // Cycle extension - scroll to bottom to reveal new beats
        scrollState.scrollToBottom();
      } else {
        // Multiple steps added at once (generation) - scroll to top to see start position
        scrollState.scrollToTop();
      }
    }

    previousStepCount = currentStepCount;
    previousStepsRef = steps;
  });

  // Event handlers for animation events
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

  const handlePrepareCycleExtension = (event: Event) => {
    const customEvent = event as CustomEvent;
    displayState.prepareCycleExtensionAnimation(
      customEvent.detail.totalBeatCount,
      customEvent.detail.existingBeatCount
    );
  };

  onMount(() => {
    window.addEventListener("animation-mode-change", handleAnimationModeChange);
    window.addEventListener(
      "clear-sequence-animation",
      handleClearSequenceAnimation
    );
    window.addEventListener(
      "prepare-sequence-animation",
      handlePrepareSequenceAnimation
    );
    window.addEventListener(
      "prepare-cycle-extension",
      handlePrepareCycleExtension
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
      window.removeEventListener(
        "prepare-cycle-extension",
        handlePrepareCycleExtension
      );
    };
  });

  // Container resize tracking
  $effect(() => {
    if (!containerRef) return;

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

  // Scroll container setup
  $effect(() => {
    if (!scrollContainerRef) return;

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

  // Composite key guard to avoid Svelte each_key_duplicate
  const getStepKey = (beat: StepData, index: number) =>
    `${beat.id ?? "no-id"}-${beat.stepNumber ?? index}-${index}`;

  // Helper to get duration display for a step
  function getDurationDisplay(stepIndex: number): string {
    const beat = steps[stepIndex];
    const duration = beat?.duration ?? 1.0;
    return formatDurationCompact(duration);
  }
</script>

<div
  class="step-grid-container"
  bind:this={containerRef}
>
  {#if steps.length === 0 && (!startPosition || startPosition.isBlank)}
    <div class="empty-grid-message">
      <span class="empty-icon">📋</span>
      <span class="empty-text">No sequence loaded</span>
    </div>
  {:else}
    <WorkspaceGrid
      {steps}
      {startPosition}
      {isTimelineMode}
      {gridLayout}
      {timelineRows}
      {timelineUnitSize}
      {timelinePadding}
      {displayState}
      {scrollState}
      {selectedStepNumber}
      {practiceStepNumber}
      {activeMode}
      {removingStepIndex}
      {removingStepIndices}
      {isClearing}
      {highlightedSteps}
      onStepClick={handleStepClick}
      onStartClick={handleStartClick}
      {onStepDelete}
      {onStepLongPress}
      {onDurationChange}
      {getStepKey}
      {getDurationDisplay}
      {bluePropTypeOverride}
      {redPropTypeOverride}
      {sequenceWord}
      bind:scrollContainerRef
    />
  {/if}
</div>

<style>
  .step-grid-container {
    position: relative;
    background: transparent;
    border-radius: 12px;
    overflow: hidden;
    width: 100%;
    height: 100%;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
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
</style>
