<!-- SpotlightGrid.svelte - Maximized cell view for focused single-beat display -->
<script lang="ts">
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
  import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
  import type { GridLayout } from "$lib/shared/create/utils/grid-calculations";
  import type { StepGridDisplayState } from "../state/step-grid-display-state.svelte";
  import { calculateStepPosition } from "$lib/shared/create/utils/grid-calculations";
  import StepCell from "./StepCell.svelte";
  import StartTile from "./StartTile.svelte";

  let {
    steps,
    startPosition = null,
    gridLayout,
    displayState,
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
    getStepKey,
    getDurationDisplay,
  } = $props<{
    steps: ReadonlyArray<StepData> | StepData[];
    startPosition?: StartPositionData | StepData | null;
    gridLayout: GridLayout;
    displayState: StepGridDisplayState;
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
    getStepKey: (beat: StepData, index: number) => string;
    getDurationDisplay: (stepIndex: number) => string;
  }>();
</script>

<div
  class="step-grid spotlight-static"
  class:clearing={isClearing || displayState.isClearingForGeneration}
  style:--grid-rows={gridLayout.rows}
  style:--grid-cols={gridLayout.totalColumns}
  style:--cell-size="{gridLayout.cellSize}px"
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
  {#each steps as step, index (getStepKey(step, index))}
    {@const position = calculateStepPosition(index, gridLayout.columns)}
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
      />
    </div>
  {/each}
</div>

<style>
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

  .step-grid.spotlight-static {
    margin: auto;
    max-width: 100%;
    max-height: 100%;
  }

  .step-grid.clearing {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
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
