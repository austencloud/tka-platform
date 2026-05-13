<!-- TimelineGrid.svelte - Duration-proportional timeline layout -->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
  import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
  import type { TimelineRow } from "$lib/shared/create/utils/grid-calculations";
  import type { StepGridDisplayState } from "../state/step-grid-display-state.svelte";
  import type { ScrollState } from "../state/scroll-state.svelte";
  import { getTimelineWidthMultiplier } from "$lib/shared/create/utils/grid-calculations";
  import {
    MIN_DURATION,
    MAX_DURATION,
    DURATION_STEP_FINE,
  } from "../../../services/implementations/step-operations/DurationHandler";
  import StepCell from "./StepCell.svelte";
  import StartTile from "./StartTile.svelte";
  import DurationResizeHandle from "./DurationResizeHandle.svelte";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";

  const MANDALA_CELL_SCALE = 0.78;

  const hapticService = getHapticFeedback();

  let {
    steps,
    startPosition = null,
    timelineRows,
    timelineUnitSize,
    timelinePadding,
    displayState,
    scrollState,
    selectedStepNumber = null,
    practiceStepNumber = null,
    activeMode = null,
    removingStepIndex = null,
    removingStepIndices = new Set<number>(),
    isClearing = false,
    highlightedSteps = null,
    onStepClick,
    onStartClick,
    onStepDelete,
    onStepLongPress,
    onDurationChange,
    getStepKey,
    getDurationDisplay,
    scrollContainerRef = $bindable(),
  } = $props<{
    steps: ReadonlyArray<StepData> | StepData[];
    startPosition?: StartPositionData | StepData | null;
    timelineRows: TimelineRow[];
    timelineUnitSize: number;
    timelinePadding: number;
    displayState: StepGridDisplayState;
    scrollState: ScrollState;
    selectedStepNumber?: number | null;
    practiceStepNumber?: number | null;
    activeMode?: BuildModeId | null;
    removingStepIndex?: number | null;
    removingStepIndices?: Set<number>;
    isClearing?: boolean;
    highlightedSteps?: Map<number, { bg: string; border: string }> | null;
    onStepClick?: (stepNumber: number) => void;
    onStartClick?: () => void;
    onStepDelete?: (stepNumber: number) => void;
    onStepLongPress?: (stepNumber: number) => void;
    onDurationChange?: (stepNumber: number, newDuration: number) => void;
    getStepKey: (beat: StepData, index: number) => string;
    getDurationDisplay: (stepIndex: number) => string;
    scrollContainerRef?: HTMLElement;
  }>();

  // --- Duration resize drag state ---
  const SNAP_INCREMENT = DURATION_STEP_FINE;

  let resizingStepIndex = $state<number | null>(null);
  let resizingPreviewDuration = $state<number | null>(null);
  let resizingInitialDuration = $state(0);
  let lastSnappedValue = $state(0);

  function handleResizeDragStart(stepIndex: number, currentDuration: number) {
    resizingStepIndex = stepIndex;
    resizingInitialDuration = currentDuration;
    resizingPreviewDuration = currentDuration;
    lastSnappedValue = Math.round(currentDuration / SNAP_INCREMENT) * SNAP_INCREMENT;
  }

  function handleResizeDrag(pixelDelta: number) {
    if (resizingStepIndex === null || timelineUnitSize <= 0) return;
    const raw = resizingInitialDuration + pixelDelta / timelineUnitSize;
    resizingPreviewDuration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, raw));

    // Haptic feedback at snap boundaries
    const currentSnapped =
      Math.round(resizingPreviewDuration / SNAP_INCREMENT) * SNAP_INCREMENT;
    if (currentSnapped !== lastSnappedValue) {
      lastSnappedValue = currentSnapped;
      hapticService?.trigger("selection");
    }
  }

  function handleResizeDragEnd() {
    if (resizingStepIndex === null || resizingPreviewDuration === null) return;
    const snapped =
      Math.round(resizingPreviewDuration / SNAP_INCREMENT) * SNAP_INCREMENT;
    const clampedSnapped = Math.max(MIN_DURATION, Math.min(MAX_DURATION, snapped));
    const step = steps[resizingStepIndex];
    onDurationChange?.(step.stepNumber, clampedSnapped);
    resizingStepIndex = null;
    resizingPreviewDuration = null;
  }

  function handleStepAdjust(stepIndex: number, newDuration: number) {
    const step = steps[stepIndex];
    hapticService?.trigger("selection");
    onDurationChange?.(step.stepNumber, newDuration);
  }

  function getEffectiveMultiplier(
    stepIndex: number,
    baseDuration: number
  ): number {
    if (stepIndex === resizingStepIndex && resizingPreviewDuration !== null) {
      return resizingPreviewDuration;
    }
    return getTimelineWidthMultiplier(baseDuration);
  }

  type MandalaShow = "blue" | "red" | "both";

  const startColumnMandalas = $derived.by(() => {
    const rowCount = timelineRows.length;
    if (rowCount < 2 || steps.length === 0) return [];

    const cells: Array<{ index: number; show: MandalaShow }> = [];
    for (let i = 1; i < rowCount; i++) {
      cells.push({ index: i, show: "both" });
    }

    if (cells.length === 2) {
      cells[0]!.show = "blue";
      cells[1]!.show = "red";
    } else if (cells.length >= 3) {
      cells[0]!.show = "blue";
      cells[cells.length - 1]!.show = "red";
    }

    return cells;
  });

  const mandalaSize = $derived(Math.round(timelineUnitSize * MANDALA_CELL_SCALE));
</script>

<div
  class="step-grid-scroll timeline-scroll"
  class:has-scrollbar={scrollState.hasVerticalScrollbar}
  bind:this={scrollContainerRef}
>
  <div
    class="timeline-container"
    class:clearing={isClearing || displayState.isClearingForGeneration}
    style:--cell-size="{timelineUnitSize}px"
    style:--timeline-padding="{timelinePadding}px"
  >
    <!-- Start Position Column -->
    {#if startPosition && !startPosition.isBlank}
      <div class="timeline-start-column">
        <div
          class="timeline-cell start-tile"
          class:timeline-selected={selectedStepNumber === 0}
          class:timeline-practice={practiceStepNumber === 0}
          style:--duration-multiplier={1}
        >
          <StartTile
            {startPosition}
            shouldAnimate={displayState.shouldAnimateStartPosition}
            isSelected={selectedStepNumber === 0}
            isPracticeStep={practiceStepNumber === 0}
            {activeMode}
            onStartClick={onStartClick}
            onLongPress={onStepLongPress}
            onDelete={onStepDelete}
            animationEpoch={displayState.animationEpoch}
            isTimelineMode={true}
          />
        </div>
        {#each startColumnMandalas as cell (cell.index)}
          <div class="timeline-cell mandala-cell" style:--duration-multiplier={1}>
            <SequenceMandala
              sequence={{ steps }}
              mode="card-back"
              style="stroke"
              show={cell.show}
              size={mandalaSize}
            />
          </div>
        {/each}
      </div>
    {/if}

    <!-- Timeline Rows -->
    <div class="timeline-rows">
      {#each timelineRows as row, rowIndex (rowIndex)}
        <div class="timeline-row">
          {#each row.steps as { stepIndex, duration } (getStepKey(steps[stepIndex], stepIndex))}
            {@const step = steps[stepIndex]}
            {@const isDeleting = removingStepIndices.has(stepIndex)}
            {@const shouldSlide =
              removingStepIndex !== null &&
              !isDeleting &&
              stepIndex > removingStepIndex}
            {@const musicalPosition = getDurationDisplay(stepIndex)}
            {@const effectiveDuration = getEffectiveMultiplier(stepIndex, duration)}
            <div
              class="timeline-cell step-container"
              class:deleting={isDeleting}
              class:sliding={shouldSlide}
              class:hidden-for-sequential={displayState.shouldBeatBeHidden(stepIndex)}
              class:timeline-selected={selectedStepNumber === step.stepNumber}
              class:timeline-practice={practiceStepNumber === step.stepNumber}
              style:--duration-multiplier={getEffectiveMultiplier(stepIndex, duration)}
              style:animation-delay={shouldSlide
                ? `${Math.min(stepIndex - removingStepIndex - 1, 5) * 50}ms`
                : "0ms"}
            >
              <StepCell
                {step}
                index={stepIndex}
                onClick={() => onStepClick?.(step.stepNumber)}
                onDelete={() => onStepDelete?.(step.stepNumber)}
                onLongPress={onStepLongPress}
                shouldAnimate={displayState.shouldBeatAnimate(stepIndex)}
                isSelected={selectedStepNumber === step.stepNumber}
                isPracticeStep={practiceStepNumber === step.stepNumber}
                {activeMode}
                highlightStyle={highlightedSteps?.get(step.stepNumber) ?? null}
                {musicalPosition}
                isTimelineMode={true}
                widthMultiplier={effectiveDuration}
                animationEpoch={displayState.animationEpoch}
              />
              {#if onDurationChange && selectedStepNumber === step.stepNumber}
                <DurationResizeHandle
                  currentDuration={duration}
                  onDragStart={() => handleResizeDragStart(stepIndex, duration)}
                  onDrag={(delta) => handleResizeDrag(delta)}
                  onDragEnd={() => handleResizeDragEnd()}
                  onStepAdjust={(newDur) => handleStepAdjust(stepIndex, newDur)}
                />
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .step-grid-scroll {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    padding: 4px;
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

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

  .step-grid-scroll.has-scrollbar {
    padding-right: 12px;
  }

  .timeline-container {
    display: flex;
    flex-direction: row;
    gap: 1px;
    width: fit-content;
    max-width: calc(100% - var(--timeline-padding, 16px));
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

  .timeline-start-column {
    width: var(--cell-size);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    align-self: flex-start;
  }

  .timeline-start-column .timeline-cell {
    height: var(--cell-size);
  }

  .timeline-rows {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .timeline-row {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: var(--cell-size);
  }

  .timeline-cell {
    width: calc(var(--cell-size) * var(--duration-multiplier, 1));
    flex-shrink: 0;
    flex-grow: 0;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--dm-pictograph-bg, #0a0a0f);
    border-radius: 4px;
  }

  .timeline-cell.timeline-selected {
    z-index: 10;
    border: 3px solid transparent;
    background:
      linear-gradient(var(--dm-pictograph-bg, #0a0a0f), var(--dm-pictograph-bg, #0a0a0f)) padding-box,
      linear-gradient(135deg, var(--semantic-warning), var(--semantic-warning), #d97706) border-box;
    border-radius: 8px;
    box-shadow:
      0 0 20px rgba(251, 191, 36, 0.5),
      0 8px 32px rgba(251, 191, 36, 0.3);
    transform: scale(1.03);
  }

  .timeline-cell.timeline-practice {
    z-index: 10;
    border: 3px solid var(--semantic-warning);
    border-radius: 8px;
    box-shadow: 0 0 16px rgba(251, 191, 36, 0.5);
  }

  .step-container {
    margin: 0;
    position: relative;
  }

  .step-container.deleting {
    animation: fadeOutDisintegrate var(--duration-normal) ease-out forwards;
  }

  .step-container.sliding {
    animation: slideIntoPlace var(--duration-normal) cubic-bezier(0.25, 0.46, 0.45, 0.94)
      forwards;
  }

  .step-container.hidden-for-sequential {
    opacity: 0;
    pointer-events: none;
  }

  /* Timeline mode: override width from .beat-container */
  .timeline-cell.step-container,
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

  .mandala-cell {
    pointer-events: none;
    background: transparent;
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

  @media (prefers-reduced-motion: reduce) {
    .step-container.deleting,
    .step-container.sliding {
      animation: none;
    }
  }
</style>
