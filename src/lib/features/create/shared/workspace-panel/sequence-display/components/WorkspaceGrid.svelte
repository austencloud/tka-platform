<!-- WorkspaceGrid.svelte - Unified workspace grid with standard and timeline layout modes -->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
  import type { BuildModeId } from "$lib/shared/foundation/ui/ui-types";
  import type { GridLayout, TimelineRow } from "$lib/shared/create/utils/grid-calculations";
  import type { StepGridDisplayState } from "../state/step-grid-display-state.svelte";
  import type { ScrollState } from "../state/scroll-state.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    calculateStepPosition,
    getTimelineWidthMultiplier,
  } from "$lib/shared/create/utils/grid-calculations";
  import {
    MIN_DURATION,
    MAX_DURATION,
    DURATION_STEP_FINE,
  } from "../../../services/step-operations/duration-handler";
  import StepCell from "./StepCell.svelte";
  import StartTile from "./StartTile.svelte";
  import DurationResizeHandle from "./DurationResizeHandle.svelte";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type {
    ContextMenuEntry,
    ContextMenuState,
  } from "$lib/shared/components/context-menu/context-menu-types";
  import { mandalaCollectionState } from "$lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { MandalaPathShape } from "$lib/shared/mandala/domain/mandala-types";

  const MANDALA_CELL_SCALE = 0.78;
  const hapticService = getHapticFeedback();

  let {
    steps,
    startPosition = null,
    isTimelineMode = false,
    gridLayout,
    timelineRows = [],
    timelineUnitSize = 0,
    timelinePadding = 0,
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
    bluePropTypeOverride = undefined,
    redPropTypeOverride = undefined,
    sequenceWord = "",
    scrollContainerRef = $bindable(),
  }: {
    steps: ReadonlyArray<StepData> | StepData[];
    startPosition?: StartPositionData | StepData | null;
    isTimelineMode?: boolean;
    gridLayout: GridLayout;
    timelineRows?: TimelineRow[];
    timelineUnitSize?: number;
    timelinePadding?: number;
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
    bluePropTypeOverride?: PropType;
    redPropTypeOverride?: PropType;
    sequenceWord?: string;
    scrollContainerRef?: HTMLElement;
  } = $props();

  const cellSize = $derived(isTimelineMode ? timelineUnitSize : gridLayout.cellSize);

  // Effective prop for the step-grid mandalas: an explicit override wins, else
  // the user's selected prop, else staff. The mandala derives its tip count
  // (single- vs dual-ended) from this, so passing the raw (often undefined)
  // override drew the dual-staff figure even for a club. Mirrors the
  // collection-save resolution below.
  const effectiveBluePropType = $derived(
    bluePropTypeOverride ?? settingsService.settings.bluePropType ?? "staff",
  );
  const effectiveRedPropType = $derived(
    redPropTypeOverride ?? settingsService.settings.redPropType ?? "staff",
  );

  // --- Duration resize (timeline only) ---
  const SNAP_INCREMENT = DURATION_STEP_FINE;
  let resizingStepIndex = $state<number | null>(null);
  let resizingPreviewDuration = $state<number | null>(null);
  let resizingInitialDuration = $state(0);
  let lastSnappedValue = $state(0);

  function handleResizeDragStart(stepIndex: number, currentDuration: number) {
    resizingStepIndex = stepIndex;
    resizingInitialDuration = currentDuration;
    resizingPreviewDuration = currentDuration;
    lastSnappedValue =
      Math.round(currentDuration / SNAP_INCREMENT) * SNAP_INCREMENT;
  }

  function handleResizeDrag(pixelDelta: number) {
    if (resizingStepIndex === null || timelineUnitSize <= 0) return;
    const raw = resizingInitialDuration + pixelDelta / timelineUnitSize;
    resizingPreviewDuration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, raw));
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
    const clamped = Math.max(MIN_DURATION, Math.min(MAX_DURATION, snapped));
    onDurationChange?.(steps[resizingStepIndex]!.stepNumber, clamped);
    resizingStepIndex = null;
    resizingPreviewDuration = null;
  }

  function handleStepAdjust(stepIndex: number, newDuration: number) {
    hapticService?.trigger("selection");
    onDurationChange?.(steps[stepIndex]!.stepNumber, newDuration);
  }

  function getEffectiveMultiplier(
    stepIndex: number,
    baseDuration: number,
  ): number {
    if (stepIndex === resizingStepIndex && resizingPreviewDuration !== null) {
      return resizingPreviewDuration;
    }
    return getTimelineWidthMultiplier(baseDuration);
  }

  // --- Mandala fill ---
  type MandalaShow = "blue" | "red" | "both";

  const isLightBackground = $derived(
    settingsService.settings.backgroundType === BackgroundType.CELESTIAL,
  );

  function applyVariantCycling(cells: Array<{ show: MandalaShow }>) {
    if (cells.length === 2) {
      cells[0]!.show = "blue";
      cells[1]!.show = "red";
    } else if (cells.length >= 3) {
      cells[0]!.show = "blue";
      cells[cells.length - 1]!.show = "red";
    }
  }

  const standardEmptyCells = $derived.by(() => {
    if (isTimelineMode || steps.length === 0) return [];
    const cells: Array<{ row: number; column: number; show: MandalaShow }> = [];
    // Only fill trailing empty cells in the last row — column 1 rows 2+
    // stay empty to avoid duplicate mandalas stacking vertically.
    const stepsInLastRow = steps.length % gridLayout.columns;
    if (stepsInLastRow > 0) {
      for (let c = stepsInLastRow + 2; c <= gridLayout.totalColumns; c++) {
        cells.push({ row: gridLayout.rows, column: c, show: "both" });
      }
    }
    applyVariantCycling(cells);
    return cells;
  });

  const timelineStartMandalas = $derived.by(() => {
    if (!isTimelineMode) return [];
    const rowCount = timelineRows.length;
    if (rowCount < 2 || steps.length === 0) return [];
    const cells: Array<{ index: number; show: MandalaShow }> = [];
    for (let i = 1; i < rowCount; i++) {
      cells.push({ index: i, show: "both" });
    }
    applyVariantCycling(cells);
    return cells;
  });

  const mandalaSize = $derived(Math.round(cellSize * MANDALA_CELL_SCALE));

  // --- Context menu ---
  let mandalaMenuState = $state<ContextMenuState>({ open: false });
  let mandalaMenuVariant = $state<MandalaShow>("both");
  let mandalaPathShape = $state<MandalaPathShape>("arc");

  function handleMandalaContextMenu(event: MouseEvent, variant: MandalaShow) {
    event.preventDefault();
    mandalaMenuVariant = variant;
    mandalaMenuState = { open: true, x: event.clientX, y: event.clientY };
  }

  const PATH_SHAPE_OPTIONS: { id: MandalaPathShape; label: string; icon: string }[] = [
    { id: "hybrid", label: "Hybrid", icon: "fa-shuffle" },
    { id: "arc", label: "Arc", icon: "fa-bezier-curve" },
    { id: "linear", label: "Linear", icon: "fa-arrows-alt-h" },
    { id: "concave", label: "Concave", icon: "fa-compress" },
  ];

  const mandalaMenuItems = $derived<ContextMenuEntry[]>([
    {
      id: "save-to-collection",
      label: "Save to Collection",
      icon: "fa-bookmark",
      action: () => {
        const name =
          sequenceWord || `Mandala #${mandalaCollectionState.count + 1}`;
        mandalaCollectionState.add({
          name,
          steps: [...steps],
          variant: mandalaMenuVariant,
          bluePropType: effectiveBluePropType,
          redPropType: effectiveRedPropType,
        });
        toast.success(`Saved "${name}" to collection`);
      },
    },
    { type: "separator" },
    {
      id: "path-shape",
      label: "Path Shape",
      icon: "fa-bezier-curve",
      children: PATH_SHAPE_OPTIONS.map((opt) => ({
        id: `path-${opt.id}`,
        label: opt.label,
        icon: opt.icon,
        checked: mandalaPathShape === opt.id,
        action: () => { mandalaPathShape = opt.id; },
      })),
    },
  ]);
</script>

<div
  class="scroll-wrapper"
  class:has-scrollbar={scrollState.hasVerticalScrollbar}
  bind:this={scrollContainerRef}
>
  <div
    class="grid-surface"
    class:standard={!isTimelineMode}
    class:timeline={isTimelineMode}
    class:clearing={isClearing || displayState.isClearingForGeneration}
    style:--cell-size="{cellSize}px"
    style:--grid-rows={gridLayout.rows}
    style:--grid-cols={gridLayout.totalColumns}
    style:--timeline-padding="{timelinePadding}px"
  >
    {#if isTimelineMode}
      <!-- ===== Timeline layout: start column + flexbox rows ===== -->
      {#if startPosition && !('isBlank' in startPosition && startPosition.isBlank)}
        <div class="timeline-start-column">
          <div
            class="timeline-cell"
            class:cell-selected={selectedStepNumber === 0}
            class:cell-practice={practiceStepNumber === 0}
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
          {#each timelineStartMandalas as cell (cell.index)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="timeline-cell mandala-cell"
              class:light-bg={isLightBackground}
              oncontextmenu={(e) => handleMandalaContextMenu(e, cell.show)}
            >
              <SequenceMandala
                sequence={{ steps }}
                mode="card-back"
                style="stroke"
                show={cell.show}
                size={mandalaSize}
                bluePropType={effectiveBluePropType}
                redPropType={effectiveRedPropType}
                pathShape={mandalaPathShape}
              />
            </div>
          {/each}
        </div>
      {/if}

      <div class="timeline-rows">
        {#each timelineRows as row, rowIndex (rowIndex)}
          <div class="timeline-row">
            {#each row.steps as { stepIndex, duration } (getStepKey(steps[stepIndex]!, stepIndex))}
              {@const step = steps[stepIndex]!}
              {@const isDeleting = removingStepIndices.has(stepIndex)}
              {@const shouldSlide =
                removingStepIndex !== null &&
                !isDeleting &&
                stepIndex > removingStepIndex}
              {@const musicalPosition = getDurationDisplay(stepIndex)}
              {@const effectiveDuration = getEffectiveMultiplier(
                stepIndex,
                duration,
              )}
              <div
                class="timeline-cell step-container"
                class:deleting={isDeleting}
                class:sliding={shouldSlide}
                class:hidden-for-sequential={displayState.shouldBeatBeHidden(stepIndex)}
                class:cell-selected={selectedStepNumber === step.stepNumber}
                class:cell-practice={practiceStepNumber === step.stepNumber}
                style:--duration-multiplier={effectiveDuration}
                style:animation-delay={shouldSlide
                  ? `${Math.min(stepIndex - removingStepIndex - 1, 5) * 50}ms`
                  : "0ms"}
              >
                <StepCell
                  {step}
                  index={stepIndex}
                  onClick={() => onStepClick?.(step.stepNumber)}
                  onDelete={() => onStepDelete?.(step.stepNumber)}
                  onLongPress={() => onStepLongPress?.(step.stepNumber)}
                  shouldAnimate={displayState.shouldBeatAnimate(stepIndex)}
                  isSelected={selectedStepNumber === step.stepNumber}
                  isPracticeStep={practiceStepNumber === step.stepNumber}
                  {activeMode}
                  highlightStyle={highlightedSteps?.get(step.stepNumber) ?? null}
                  {musicalPosition}
                  isTimelineMode={true}
                  widthMultiplier={effectiveDuration}
                  animationEpoch={displayState.animationEpoch}
                  {bluePropTypeOverride}
                  {redPropTypeOverride}
                />
                {#if onDurationChange && selectedStepNumber === step.stepNumber}
                  <DurationResizeHandle
                    currentDuration={duration}
                    onDragStart={() =>
                      handleResizeDragStart(stepIndex, duration)}
                    onDrag={(delta) => handleResizeDrag(delta)}
                    onDragEnd={() => handleResizeDragEnd()}
                    onStepAdjust={(newDur) =>
                      handleStepAdjust(stepIndex, newDur)}
                  />
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {:else}
      <!-- ===== Standard layout: CSS Grid with uniform cells ===== -->
      {#if startPosition && !('isBlank' in startPosition && startPosition.isBlank)}
        <div
          class="step-container"
          style:grid-row="1"
          style:grid-column="1"
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
          />
        </div>
      {/if}

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
            onLongPress={() => onStepLongPress?.(step.stepNumber)}
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

      {#each standardEmptyCells as cell (cell.row + "-" + cell.column)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="mandala-cell"
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
            bluePropType={effectiveBluePropType}
            redPropType={effectiveRedPropType}
            pathShape={mandalaPathShape}
          />
        </div>
      {/each}
    {/if}
  </div>
  <ContextMenu
    menuState={mandalaMenuState}
    items={mandalaMenuItems}
    onClose={() => (mandalaMenuState = { open: false })}
  />
</div>

<style>
  /* ===== Scroll wrapper ===== */
  .scroll-wrapper {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    /* Breathing room so a selected/hovered cell's scaled gold border + glow
       on the outer rows/columns isn't clipped at the wrapper edge. */
    padding: 16px;
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .scroll-wrapper::-webkit-scrollbar {
    width: 8px;
  }

  .scroll-wrapper::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
    border-radius: 4px;
  }

  .scroll-wrapper::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }

  .scroll-wrapper::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  @media (max-width: 768px) {
    .scroll-wrapper {
      scrollbar-width: auto;
      scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
    }

    .scroll-wrapper::-webkit-scrollbar {
      width: 10px;
    }

    .scroll-wrapper::-webkit-scrollbar-thumb {
      background: var(--scrollbar-thumb);
    }
  }

  .scroll-wrapper.has-scrollbar {
    padding-right: 12px;
  }

  /* ===== Grid surface — visual contract (shared) ===== */
  .grid-surface {
    gap: 0;
    background: transparent;
    border-radius: 6px;
    /* Was overflow: hidden — clipped the gold selection border/glow of cells
       on the grid's bottom/edge rows. Visible lets a selected cell pop forward.
       Child step-containers are opaque squares that fill their cells, so the
       6px corner radius still reads fine. */
    overflow: visible;
    margin: auto;
    padding: 0;
    transition:
      opacity 300ms ease-out,
      transform 300ms ease-out;
  }

  .grid-surface.clearing {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }

  /* Standard mode: CSS Grid */
  .grid-surface.standard {
    display: grid;
    grid-template-columns: repeat(
      var(--grid-cols),
      minmax(0, var(--cell-size))
    );
    grid-auto-rows: var(--cell-size);
    max-width: 100%;
    box-sizing: border-box;
  }

  /* Timeline mode: Flexbox rows */
  .grid-surface.timeline {
    display: flex;
    flex-direction: row;
    width: fit-content;
    max-width: calc(100% - var(--timeline-padding, 16px));
  }

  /* ===== Step container (shared) ===== */
  .step-container {
    margin: 0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--dm-pictograph-bg, #0a0a0f);
  }

  .grid-surface.standard .step-container {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .step-container.deleting {
    animation: fadeOutDisintegrate var(--duration-normal) ease-out forwards;
  }

  .step-container.sliding {
    animation: slideIntoPlace var(--duration-normal)
      cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  }

  .step-container.hidden-for-sequential {
    opacity: 0;
    pointer-events: none;
  }

  /* ===== Timeline sub-elements ===== */
  .timeline-start-column {
    width: var(--cell-size);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-self: flex-start;
  }

  .timeline-rows {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0;
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
  }

  .timeline-start-column .timeline-cell {
    height: var(--cell-size);
    width: 100%;
  }

  .cell-selected {
    z-index: 10;
    border: 3px solid transparent;
    background: linear-gradient(
          var(--dm-pictograph-bg, #0a0a0f),
          var(--dm-pictograph-bg, #0a0a0f)
        )
        padding-box,
      linear-gradient(
          135deg,
          var(--semantic-warning),
          var(--semantic-warning),
          #d97706
        )
        border-box;
    border-radius: 8px;
    box-shadow:
      0 0 20px rgba(251, 191, 36, 0.5),
      0 8px 32px rgba(251, 191, 36, 0.3);
    transform: scale(1.03);
  }

  .cell-practice {
    z-index: 10;
    border: 3px solid var(--semantic-warning);
    border-radius: 8px;
    box-shadow: 0 0 16px rgba(251, 191, 36, 0.5);
  }

  /* ===== Standard mode overrides ===== */
  .grid-surface.standard :global(.step-cell) {
    transform: none;
  }

  /* Hover pop: any non-selected cell lifts forward with a NEUTRAL (cool/white)
     border + glow — a preview affordance, deliberately NOT gold. Gold is
     reserved for the single committed selection so the two never compete.
     The selected cell keeps its gold styling and sits above this (z 10 > 9).
     Covers BOTH layout modes — standard selects via .step-cell.selected,
     timeline selects via the parent .timeline-cell.cell-selected (the
     step-cell itself never gets .selected in timeline mode). */
  .grid-surface.standard :global(.step-cell:not(.selected):hover),
  .grid-surface.timeline :global(.timeline-cell:not(.cell-selected) .step-cell:hover) {
    /* Above the selected cell (z 10): the hovered cell is the one scaling
       toward the user, so it must read as closest / in front. */
    z-index: 11;
    transform: scale(1.06);
    opacity: 1;
    border: 3px solid rgba(226, 232, 240, 0.85);
    border-radius: 12px;
    box-shadow:
      0 0 16px rgba(226, 232, 240, 0.3),
      0 8px 28px rgba(0, 0, 0, 0.35);
  }

  /* Hovering the ALREADY-selected cell (timeline mode): intensify its gold +
     lift instead of painting it white — selected stays gold, hover just makes
     it pop. (Standard mode handles this via .step-cell.selected:hover.) */
  .grid-surface.timeline :global(.timeline-cell.cell-selected:hover) {
    z-index: 11;
    transform: scale(1.07);
    box-shadow:
      0 0 30px rgba(251, 191, 36, 0.7),
      0 12px 48px rgba(251, 191, 36, 0.4);
  }

  /* The gold border lives on the PARENT .timeline-cell, which scales on hover
     (above) and carries the border with it. The inner .step-cell must NOT add
     its own bare :hover scale (StepCell.svelte) on top — that grows the
     pictograph past the gold border. Pin it so border + pictograph scale as one
     and the gold frame stays hugging the pictograph. */
  .grid-surface.timeline :global(.timeline-cell.cell-selected:hover .step-cell) {
    transform: none;
  }

  /* ===== Pictograph border suppression ===== */
  .grid-surface :global(.pictograph-renderer) {
    border: none !important;
  }

  /* ===== Mandala cells ===== */
  .mandala-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: context-menu;
    background: color-mix(
      in srgb,
      var(--dm-pictograph-bg, #0a0a0f) 50%,
      transparent
    );
    transition: background 350ms ease;
  }

  .grid-surface.standard .mandala-cell {
    border-radius: 4px;
  }

  .mandala-cell.light-bg {
    background: color-mix(
      in srgb,
      var(--dm-pictograph-bg, #0a0a0f) 75%,
      transparent
    );
  }

  /* ===== Keyframes ===== */
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
