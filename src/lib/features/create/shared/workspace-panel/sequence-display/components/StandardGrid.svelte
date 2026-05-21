<!-- StandardGrid.svelte - Standard CSS Grid layout with uniform cell sizes -->
<script lang="ts">
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
  import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
  import type { GridLayout } from "$lib/shared/create/utils/grid-calculations";
  import type { StepGridDisplayState } from "../state/step-grid-display-state.svelte";
  import type { ScrollState } from "../state/scroll-state.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { calculateStepPosition } from "$lib/shared/create/utils/grid-calculations";
  import StepCell from "./StepCell.svelte";
  import StartTile from "./StartTile.svelte";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuEntry, ContextMenuState } from "$lib/shared/components/context-menu/context-menu-types";
  import { mandalaCollectionState } from "$lib/features/mandala-collection/state/mandala-collection-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  const MANDALA_CELL_SCALE = 0.78;

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
    getStepKey,
    getDurationDisplay,
    bluePropTypeOverride = undefined,
    redPropTypeOverride = undefined,
    sequenceWord = "",
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
    getStepKey: (beat: StepData, index: number) => string;
    getDurationDisplay: (stepIndex: number) => string;
    bluePropTypeOverride?: PropType;
    redPropTypeOverride?: PropType;
    sequenceWord?: string;
    scrollContainerRef?: HTMLElement;
  }>();

  type MandalaShow = "blue" | "red" | "both";

  const emptyCells = $derived.by(() => {
    if (steps.length === 0) return [];

    const cells: Array<{ row: number; column: number; show: MandalaShow }> = [];

    // Start-column empties (column 1, rows 2+)
    for (let r = 2; r <= gridLayout.rows; r++) {
      cells.push({ row: r, column: 1, show: "both" });
    }

    // Last-row trailing empties
    const stepsInLastRow = steps.length % gridLayout.columns;
    if (stepsInLastRow > 0) {
      for (let c = stepsInLastRow + 2; c <= gridLayout.totalColumns; c++) {
        cells.push({ row: gridLayout.rows, column: c, show: "both" });
      }
    }

    // Variant cycling: blue (first), full (middle), red (last)
    if (cells.length === 2) {
      cells[0]!.show = "blue";
      cells[1]!.show = "red";
    } else if (cells.length >= 3) {
      cells[0]!.show = "blue";
      cells[cells.length - 1]!.show = "red";
    }

    return cells;
  });

  const mandalaSize = $derived(Math.round(gridLayout.cellSize * MANDALA_CELL_SCALE));
  const isLightBackground = $derived(settingsService.settings.backgroundType === BackgroundType.CELESTIAL);

  let mandalaMenuState = $state<ContextMenuState>({ open: false });
  let mandalaMenuVariant = $state<"blue" | "red" | "both">("both");

  function handleMandalaContextMenu(event: MouseEvent, variant: "blue" | "red" | "both") {
    event.preventDefault();
    mandalaMenuVariant = variant;
    mandalaMenuState = { open: true, x: event.clientX, y: event.clientY };
  }

  const mandalaMenuItems = $derived<ContextMenuEntry[]>([
    {
      id: "save-to-collection",
      label: "Save to Collection",
      icon: "fa-bookmark",
      action: () => {
        const name = sequenceWord || `Mandala #${mandalaCollectionState.count + 1}`;
        mandalaCollectionState.add({
          name,
          steps: [...steps],
          variant: mandalaMenuVariant,
          bluePropType: bluePropTypeOverride ?? settingsService.settings.bluePropType ?? "staff",
          redPropType: redPropTypeOverride ?? settingsService.settings.redPropType ?? "staff",
        });
        toast.success(`Saved "${name}" to collection`);
      },
    },
  ]);
</script>

<div
  class="step-grid-scroll"
  class:has-scrollbar={scrollState.hasVerticalScrollbar}
  bind:this={scrollContainerRef}
>
  <div
    class="step-grid"
    class:clearing={isClearing || displayState.isClearingForGeneration}
    style:--grid-rows={gridLayout.rows}
    style:--grid-cols={gridLayout.totalColumns}
    style:--cell-size="{gridLayout.cellSize}px"
  >
    <!-- Start Position -->
    {#if startPosition && !startPosition.isBlank}
      <div class="step-container" style:grid-row="1" style:grid-column="1">
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
          {bluePropTypeOverride}
          {redPropTypeOverride}
        />
      </div>
    {/each}

    <!-- Mandala fill cells -->
    {#each emptyCells as cell (cell.row + "-" + cell.column)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="mandala-cell-wrapper"
        class:light-bg={isLightBackground}
        style:grid-row={cell.row}
        style:grid-column={cell.column}

        oncontextmenu={(e) => handleMandalaContextMenu(e, cell.show)}
      >
        <SequenceMandala
          sequence={{ steps }}
          mode="card-back"
          style="stroke"
          show={cell.show}
          size={mandalaSize}
          bluePropType={bluePropTypeOverride}
          redPropType={redPropTypeOverride}
        />
      </div>
    {/each}

  </div>
  <ContextMenu
    menuState={mandalaMenuState}
    items={mandalaMenuItems}
    onClose={() => (mandalaMenuState = { open: false })}
  />
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
    /* Use minmax so columns shrink to fit container instead of overflowing.
       This prevents the grid from spilling off-screen when the calculated
       cell size is larger than what fits (e.g., initial render before
       container width is measured). */
    grid-template-columns: repeat(var(--grid-cols), minmax(0, var(--cell-size)));
    grid-auto-rows: var(--cell-size);
    gap: 0;
    max-width: 100%;
    margin: auto;
    padding: 0;
    box-sizing: border-box;
    background: var(--dm-pictograph-bg, #0a0a0f);
    border-radius: 6px;
    overflow: hidden;
  }

  .step-grid.clearing {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
    transition:
      opacity 300ms ease-out,
      transform 300ms ease-out;
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
    background: var(--dm-pictograph-bg, #0a0a0f);
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

  .step-grid :global(.pictograph-renderer) {
    border: none !important;
  }

  .step-grid :global(.step-cell) {
    transform: none;
  }

  .step-grid :global(.step-cell:hover) {
    transform: scale(1.02);
  }

  .mandala-cell-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: context-menu;
    background: color-mix(in srgb, var(--dm-pictograph-bg, #0a0a0f) 50%, transparent);
    border-radius: 4px;
    transition: background 350ms ease;
  }

  .mandala-cell-wrapper.light-bg {
    background: color-mix(in srgb, var(--dm-pictograph-bg, #0a0a0f) 75%, transparent);
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
