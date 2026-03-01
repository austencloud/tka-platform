<!-- StandardGrid.svelte - Standard CSS Grid layout with uniform cell sizes -->
<script lang="ts">
  import type { StepData } from "../../../domain/models/StepData";
  import type { StartPositionData } from "../../../domain/models/StartPositionData";
  import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
  import type { GridLayout } from "../utils/grid-calculations";
  import type { StepGridDisplayState } from "../state/step-grid-display-state.svelte";
  import type { ScrollState } from "../state/scroll-state.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { calculateBeatPosition } from "../utils/grid-calculations";
  import StepCell from "./StepCell.svelte";
  import StartTile from "./StartTile.svelte";

  let {
    steps,
    startPosition = null,
    gridLayout,
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
    getBeatKey,
    getDurationDisplay,
    bluePropTypeOverride = undefined,
    redPropTypeOverride = undefined,
    orientationCycleCount = 1,
    scrollContainerRef = $bindable(),
  } = $props<{
    steps: ReadonlyArray<StepData> | StepData[];
    startPosition?: StartPositionData | StepData | null;
    gridLayout: GridLayout;
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
    getBeatKey: (beat: StepData, index: number) => string;
    getDurationDisplay: (stepIndex: number) => string;
    bluePropTypeOverride?: PropType;
    redPropTypeOverride?: PropType;
    /** Number of orientation cycle passes (1 = no extension, 2/4 = extended) */
    orientationCycleCount?: 1 | 2 | 4;
    scrollContainerRef?: HTMLElement;
  }>();

  // Note: StandardGrid is only rendered when timeline mode is disabled.
  // Timeline mode is currently always enabled (see timeline-mode.svelte.ts),
  // so TimelineGrid handles divider rendering in practice.

  const stepsPerPass = $derived.by(() => {
    if (orientationCycleCount <= 1) return 0;
    return Math.floor(steps.length / orientationCycleCount);
  });

  // Step indices where a new pass begins (0-indexed)
  const passBoundaryIndices = $derived.by(() => {
    if (stepsPerPass <= 0) return [];
    const boundaries: number[] = [];
    for (let pass = 1; pass < orientationCycleCount; pass++) {
      boundaries.push(pass * stepsPerPass);
    }
    return boundaries;
  });

  /**
   * Compute adjusted grid position accounting for divider rows.
   * Each pass boundary inserts a divider row that pushes subsequent beats down.
   */
  function getAdjustedPosition(stepIndex: number, columns: number) {
    const base = calculateBeatPosition(stepIndex, columns);
    if (passBoundaryIndices.length === 0) return base;

    // Count how many divider rows precede this step's base row.
    // A divider is inserted before the row containing the first step of each new pass.
    let dividerOffset = 0;
    for (const boundaryIdx of passBoundaryIndices) {
      const boundaryRow = calculateBeatPosition(boundaryIdx, columns).row;
      // The divider row goes before this row, so offset = boundaryRow + dividerOffset
      if (base.row >= boundaryRow + dividerOffset) {
        dividerOffset++;
      }
    }

    return { row: base.row + dividerOffset, column: base.column };
  }

  // Grid rows for the divider elements themselves
  const dividerGridRows = $derived.by(() => {
    if (passBoundaryIndices.length === 0) return [];
    const columns = gridLayout.columns;
    const rows: number[] = [];
    let cumulativeOffset = 0;
    for (const boundaryIdx of passBoundaryIndices) {
      const boundaryRow = calculateBeatPosition(boundaryIdx, columns).row;
      // Divider sits at the row where the boundary would be, offset by previous dividers
      rows.push(boundaryRow + cumulativeOffset);
      cumulativeOffset++;
    }
    return rows;
  });

  // Total extra rows from dividers (for grid-rows CSS var)
  const totalRows = $derived(gridLayout.rows + passBoundaryIndices.length);

  // Build explicit grid-template-rows when dividers are present.
  // Without this, grid-auto-rows gives divider rows full cell height.
  const gridTemplateRows = $derived.by(() => {
    if (dividerGridRows.length === 0) return "";
    const dividerSet = new Set(dividerGridRows);
    const parts: string[] = [];
    for (let r = 1; r <= totalRows; r++) {
      parts.push(dividerSet.has(r) ? "8px" : "var(--cell-size)");
    }
    return parts.join(" ");
  });
</script>

<div
  class="step-grid-scroll"
  class:has-scrollbar={scrollState.hasVerticalScrollbar}
  bind:this={scrollContainerRef}
>
  <div
    class="step-grid"
    class:clearing={isClearing || displayState.isClearingForGeneration}
    style:--grid-rows={totalRows}
    style:--grid-cols={gridLayout.totalColumns}
    style:--cell-size="{gridLayout.cellSize}px"
    style:grid-template-rows={gridTemplateRows || undefined}
  >
    <!-- Start Position -->
    {#if startPosition && !startPosition.isBlank}
      <div style:grid-row="1" style:grid-column="1">
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
        />
      </div>
    {/if}

    <!-- Step Grid -->
    <!-- Key by index to preserve component identity during regeneration, enabling CSS transitions -->
    {#each steps as step, index (index)}
      {@const position = getAdjustedPosition(index, gridLayout.columns)}
      {@const isDeleting = removingStepIndices.has(index)}
      {@const shouldSlide =
        removingStepIndex !== null && !isDeleting && index > removingStepIndex}
      {@const musicalPosition = getDurationDisplay(index)}
      <div
        class="step-container"
        class:deleting={isDeleting}
        class:sliding={shouldSlide}
        class:hidden-for-sequential={displayState.shouldBeatBeHidden(index)}
        style:grid-row={position.row}
        style:grid-column={position.column}
        style:animation-delay={shouldSlide
          ? `${Math.min(index - removingStepIndex - 1, 5) * 50}ms`
          : "0ms"}
      >
        <StepCell
          {step}
          {index}
          onClick={() => onStepClick?.(step.stepNumber)}
          onDelete={() => onStepDelete?.(step.stepNumber)}
          onLongPress={onStepLongPress}
          shouldAnimate={displayState.shouldBeatAnimate(index)}
          isSelected={selectedStepNumber === step.stepNumber}
          isPracticeStep={practiceStepNumber === step.stepNumber}
          {activeMode}
          highlightStyle={highlightedSteps?.get(step.stepNumber) ?? null}
          {musicalPosition}
          animationEpoch={displayState.animationEpoch}
          {bluePropTypeOverride}
          {redPropTypeOverride}
        />
      </div>
    {/each}

    <!-- Pass dividers for multi-pass orientation cycles -->
    {#each dividerGridRows as dividerRow (dividerRow)}
      <div
        class="pass-divider"
        style:grid-column="1 / -1"
        style:grid-row={dividerRow}
        aria-hidden="true"
      ></div>
    {/each}
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

  .step-grid {
    display: grid;
    grid-template-columns: repeat(var(--grid-cols), var(--cell-size));
    grid-auto-rows: var(--cell-size);
    gap: 1px;
    max-width: 100%;
    margin: auto;
    padding: 0;
    box-sizing: border-box;
    opacity: 1;
    transform: scale(1) translateY(0);
    transition:
      opacity 300ms ease-out,
      transform 300ms ease-out;
  }

  .step-grid.clearing {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }

  /* Pass divider for multi-pass orientation cycles */
  .pass-divider {
    height: 3px;
    background: linear-gradient(
      90deg,
      transparent 5%,
      var(--theme-accent, rgba(99, 102, 241, 0.3)) 20%,
      var(--theme-accent, rgba(99, 102, 241, 0.3)) 80%,
      transparent 95%
    );
    opacity: 0.4;
    align-self: center;
  }

  .step-container {
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

  @media (prefers-reduced-motion: reduce) {
    .step-container.deleting,
    .step-container.sliding {
      animation: none;
    }
  }
</style>
