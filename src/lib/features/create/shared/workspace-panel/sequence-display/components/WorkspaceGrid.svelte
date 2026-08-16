<!-- WorkspaceGrid.svelte - Unified workspace grid with standard and timeline layout modes -->
<script lang="ts">
  import { tick } from "svelte";
  import { fade } from "svelte/transition";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
  import type { BuildModeId } from "$lib/shared/foundation/ui/ui-types";
  import type {
    GridLayout,
    TimelineRow,
  } from "$lib/shared/create/utils/grid-calculations";
  import type {
    PictographArrivalRequest,
    StepGridDisplayState,
  } from "../state/step-grid-display-state.svelte";
  import type { ScrollState } from "../state/scroll-state.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    calculateStepPosition,
    getTimelineWidthMultiplier,
  } from "$lib/shared/create/utils/grid-calculations";
  import { getMandalaPlacements } from "$lib/shared/sequence-viewer/services/get-mandala-placements";
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
  import { saveMandalaToCollection } from "$lib/features/mandala/tabs/collection/services/save-mandala-to-collection";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { motionDuration } from "$lib/shared/transitions/motion";
  import {
    createLayoutFlip,
    GRID_LAYOUT_TRANSITION_EASING,
    GRID_LAYOUT_TRANSITION_MS,
  } from "$lib/shared/transitions/layout-flip";
  import { computeGridLayoutSignature } from "../domain/grid-layout-signature";
  import type {
    MandalaPathShape,
    MandalaRenderOptions,
  } from "$lib/shared/mandala/domain/mandala-types";
  import type { HistoryTransitionPlan } from "$lib/features/create/shared/services/history-transition-planner";

  const MANDALA_CELL_SCALE = 0.78;
  /** Undo/redo's content-change pulse — a highlight, not a movement. */
  const HISTORY_FLOURISH_MS = 240;
  const HISTORY_FLOURISH_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
  const hapticService = getHapticFeedback();

  let {
    steps,
    startPosition = null,
    isTimelineMode = false,
    gridLayout,
    standardGridCenterOffset = 0,
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
    historyTransition = null,
    historyTransitionEpoch = 0,
    highlightedSteps = null,
    onStepClick,
    onStartClick,
    onStepDelete,
    onStepLongPress,
    onDurationChange,
    onMandalaClick,
    getStepKey,
    getDurationDisplay,
    bluePropTypeOverride = undefined,
    redPropTypeOverride = undefined,
    sequenceWord = "",
    arrivalRequest = null,
    scrollContainerRef = $bindable(),
  }: {
    steps: ReadonlyArray<StepData> | StepData[];
    startPosition?: StartPositionData | StepData | null;
    isTimelineMode?: boolean;
    gridLayout: GridLayout;
    standardGridCenterOffset?: number;
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
    historyTransition?: HistoryTransitionPlan | null;
    historyTransitionEpoch?: number;
    highlightedSteps?: Map<number, { bg: string; border: string }> | null;
    onStepClick?: (
      stepNumber: number,
      modifiers?: { range: boolean; toggle: boolean }
    ) => void;
    onStartClick?: () => void;
    onStepDelete?: (stepNumber: number) => void;
    onStepLongPress?: (stepNumber: number) => void;
    onDurationChange?: (stepNumber: number, newDuration: number) => void;
    onMandalaClick?: (
      variant: MandalaRenderOptions["show"],
      pathShape: MandalaPathShape
    ) => void;
    getStepKey: (beat: StepData, index: number) => string;
    getDurationDisplay: (stepIndex: number) => string;
    bluePropTypeOverride?: PropType;
    redPropTypeOverride?: PropType;
    sequenceWord?: string;
    arrivalRequest?: PictographArrivalRequest | null;
    scrollContainerRef?: HTMLElement;
  } = $props();

  function isArrivalDestination(stepIndex: number): boolean {
    return arrivalRequest?.stepIndex === stepIndex;
  }

  function isArrivalDestinationHidden(stepIndex: number): boolean {
    return isArrivalDestination(stepIndex) && arrivalRequest?.owner === "stage";
  }

  // Single-step deletion reports through removingStepIndex and multi-step
  // deletion through removingStepIndices. Both mean the same thing to the cell:
  // play your exit, you are about to leave the layout.
  function isStepLeaving(stepIndex: number): boolean {
    return removingStepIndices.has(stepIndex) || removingStepIndex === stepIndex;
  }

  const cellSize = $derived(
    isTimelineMode ? timelineUnitSize : gridLayout.cellSize
  );

  // Effective prop for the step-grid mandalas: an explicit override wins, else
  // the user's selected prop, else staff. The mandala derives its tip count
  // (single- vs dual-ended) from this, so passing the raw (often undefined)
  // override drew the dual-staff figure even for a club. Mirrors the
  // collection-save resolution below.
  const effectiveBluePropType = $derived(
    bluePropTypeOverride ?? settingsService.settings.bluePropType ?? "staff"
  );
  const effectiveRedPropType = $derived(
    redPropTypeOverride ?? settingsService.settings.redPropType ?? "staff"
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
    resizingPreviewDuration = Math.max(
      MIN_DURATION,
      Math.min(MAX_DURATION, raw)
    );
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
    baseDuration: number
  ): number {
    if (stepIndex === resizingStepIndex && resizingPreviewDuration !== null) {
      return resizingPreviewDuration;
    }
    return getTimelineWidthMultiplier(baseDuration);
  }

  // --- Mandala fill ---
  type MandalaShow = MandalaRenderOptions["show"];

  const hasStartPosition = $derived(
    startPosition !== null &&
      !("isBlank" in startPosition && startPosition.isBlank)
  );

  const isLightBackground = $derived(
    settingsService.settings.backgroundType === BackgroundType.CELESTIAL
  );

  const standardMandalaCells = $derived.by(() => {
    if (isTimelineMode || steps.length === 0) return [];
    const { placements } = getMandalaPlacements({
      stepCount: steps.length,
      cols: gridLayout.totalColumns,
      rows: gridLayout.rows,
      includeStartPosition: hasStartPosition,
      showQRCode: false,
      blueVisible: true,
      redVisible: true,
      mandalaEnabled: true,
      startPositionLayout: "column",
    });

    return placements.map(({ row, col, variant }) => ({
      key: `mandala-${variant}`,
      row,
      column: col,
      show: variant === "full" ? ("both" as const) : variant,
    }));
  });

  // These no longer carry a layout version to force re-measurement: the layout
  // transition below measures the real rectangles itself, before and after.
  const standardStartCells = $derived.by(() => {
    if (isTimelineMode || !hasStartPosition || !startPosition) return [];
    return [{ key: "start-position", startPosition }];
  });

  const standardStepCells = $derived.by(() => {
    if (isTimelineMode) return [];
    return steps.map((step, index) => ({
      step,
      index,
      identity: getStepKey(step, index),
    }));
  });

  let gridSurfaceRef: HTMLDivElement | null = null;
  let gridHistoryAnimation: Animation | null = null;

  // Every layout change in this grid — a delete, a mid-sequence insert, a
  // column-count change, the timeline toggle, the start tile appearing, an
  // arrival landing — is the same gesture: cells leave one arrangement and
  // arrive at another. One owner runs all of them, so nothing can apply a
  // second transform on top of a first and make the motion wobble.
  const layoutFlip = createLayoutFlip({
    getRoot: () => gridSurfaceRef,
    groups: [
      { selector: "[data-history-step-identity]", datasetKey: "historyStepIdentity" },
      { selector: "[data-history-start-position]", datasetKey: "historyStartPosition" },
      { selector: "[data-layout-mandala-key]", datasetKey: "layoutMandalaKey" },
    ],
    // The transform goes on the keyed element itself, never on an inner
    // wrapper. The cell's opaque background lives on the outer box, so moving
    // only the inside would park a black square at the destination and have the
    // pictograph slide over to cover it.
    cancelSelectors: [".history-layout-shell", ".step-cell"],
    getDuration: () => motionDuration(GRID_LAYOUT_TRANSITION_MS),
    easing: GRID_LAYOUT_TRANSITION_EASING,
  });

  /** What the grid looks like, reduced to a string. Changes here mean cells
   * moved, which is what the layout transition exists to carry. */
  const layoutSignature = $derived.by(() =>
    computeGridLayoutSignature({
      isTimelineMode,
      columns: gridLayout.columns,
      totalColumns: gridLayout.totalColumns,
      rows: gridLayout.rows,
      hasStartPosition,
      timelineRowSizes: isTimelineMode
        ? timelineRows.map((row) => row.steps.length)
        : [],
      stepIdentities: steps.map((step, index) => getStepKey(step, index)),
    })
  );

  let lastLayoutSignature: string | null = null;
  let lastHistoryEpoch = 0;
  let layoutTransitionToken = 0;
  // Arrival captures at a precise moment inside its own flushSync, before it
  // measures the destination cell. While that transaction is open the automatic
  // capture stands aside rather than overwriting its snapshot.
  let arrivalCapturePending = false;

  function getHistoryMembershipDuration(identity: string): number {
    if (!historyTransition) return 0;
    const changesMembership =
      historyTransition.insertedStepIdentities.has(identity) ||
      historyTransition.removedStepIdentities.has(identity);
    return changesMembership ? motionDuration(180) : 0;
  }

  function getHistoryStartDuration(): number {
    return historyTransition?.startPositionChanged ? motionDuration(180) : 0;
  }

  function getStepLayoutElements(): Map<string, HTMLElement> {
    if (!gridSurfaceRef) return new Map();
    return new Map(
      Array.from(
        gridSurfaceRef.querySelectorAll<HTMLElement>(
          "[data-history-step-identity]"
        )
      ).map((element) => [element.dataset.historyStepIdentity!, element])
    );
  }

  /**
   * Undo and redo carry more than a layout change: cells whose CONTENT changed
   * get a brightness pulse so the edit that was reverted is visible, and a
   * change to the whole sequence's shape flashes the surface. The geometry half
   * of the gesture belongs to the layout transition, same as everywhere else.
   */
  function playHistoryFlourishes(plan: HistoryTransitionPlan): void {
    const duration = motionDuration(HISTORY_FLOURISH_MS);
    if (duration <= 0) return;

    const surface = gridSurfaceRef;
    if (
      surface &&
      (plan.startPositionChanged ||
        plan.gridModeChanged ||
        plan.circularityChanged)
    ) {
      const animation = surface.animate(
        [
          { opacity: 0.68, filter: "brightness(1.14)" },
          { opacity: 1, filter: "brightness(1)" },
        ],
        { duration, easing: HISTORY_FLOURISH_EASING }
      );
      gridHistoryAnimation = animation;
      animation.onfinish = () => {
        animation.cancel();
        if (gridHistoryAnimation === animation) gridHistoryAnimation = null;
      };
    }

    const elements = getStepLayoutElements();
    for (const transition of plan.steps) {
      if (transition.fromIndex === null || transition.toIndex === null) continue;

      const element = elements.get(transition.identity);
      if (!element) continue;

      const selectionAffected =
        plan.selectionChanged &&
        (element.dataset.stepNumber === String(plan.fromSelectedStepNumber) ||
          element.dataset.stepNumber === String(plan.toSelectedStepNumber));
      if (transition.changes.size === 0 && !selectionAffected) continue;

      element.querySelector<HTMLElement>(".step-cell")?.animate(
        [
          { opacity: 0.58, filter: "brightness(1.22)" },
          { opacity: 1, filter: "brightness(1)" },
        ],
        { duration, easing: HISTORY_FLOURISH_EASING }
      );
    }
  }

  // The one transition. Capture before Svelte updates the DOM, play after —
  // the same pre/tick pair the arrival landing has always used, now driven by
  // the layout itself rather than by one feature asking for it.
  $effect.pre(() => {
    const signature = layoutSignature;
    const epoch = historyTransitionEpoch;
    const plan = historyTransition;
    const suspended = isClearing || displayState.isClearingForGeneration;

    const previousSignature = lastLayoutSignature;
    const previousEpoch = lastHistoryEpoch;
    lastLayoutSignature = signature;
    lastHistoryEpoch = epoch;

    // An arrival that was cancelled mid-flight (undo, a replacement option)
    // would otherwise leave the automatic capture standing aside forever.
    if (arrivalCapturePending && !arrivalRequest) {
      arrivalCapturePending = false;
      layoutFlip.discard();
    }

    const layoutChanged =
      previousSignature !== null && previousSignature !== signature;
    const historyChanged = plan !== null && epoch !== previousEpoch;
    if (!layoutChanged && !historyChanged) return;
    if (suspended || !gridSurfaceRef) return;

    gridHistoryAnimation?.cancel();
    gridHistoryAnimation = null;

    const captured =
      layoutChanged && !arrivalCapturePending && layoutFlip.capture();
    const token = ++layoutTransitionToken;

    void tick().then(() => {
      if (token !== layoutTransitionToken) return;
      if (captured) layoutFlip.play();
      if (historyChanged && plan === historyTransition) {
        playHistoryFlourishes(plan);
      }
    });
  });

  export function captureArrivalLayout(): void {
    arrivalCapturePending = layoutFlip.capture();
  }

  export function playArrivalLayout(): void {
    arrivalCapturePending = false;
    layoutFlip.play();
  }

  const timelineStartMandalas = $derived.by(() => {
    if (!isTimelineMode) return [];
    const rowCount = timelineRows.length;
    if (rowCount < 2 || steps.length === 0) return [];
    const { placements } = getMandalaPlacements({
      stepCount: steps.length,
      cols: gridLayout.totalColumns,
      rows: rowCount,
      includeStartPosition: hasStartPosition,
      showQRCode: false,
      blueVisible: true,
      redVisible: true,
      mandalaEnabled: true,
      startPositionLayout: "column",
    });

    // Every timeline row still needs a left-column cell to stay aligned with
    // the steps. Only the card-rule placements receive artwork; the remaining
    // cells stay blank.
    return Array.from({ length: rowCount - 1 }, (_, index) => {
      const placement = placements.find(({ row }) => row === index + 2);
      return {
        index: index + 1,
        show: placement
          ? placement.variant === "full"
            ? ("both" as const)
            : placement.variant
          : null,
      };
    });
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

  const PATH_SHAPE_OPTIONS: {
    id: MandalaPathShape;
    label: string;
    icon: string;
  }[] = [
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
      action: async () => {
        const name = await saveMandalaToCollection({
          steps: [...steps],
          variant: mandalaMenuVariant,
          bluePropType: effectiveBluePropType,
          redPropType: effectiveRedPropType,
          pathShape: mandalaPathShape,
          sequenceWord,
        });
        if (name) toast.success(`Saved "${name}" to collection`);
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
        action: () => {
          mandalaPathShape = opt.id;
        },
      })),
    },
  ]);
</script>

{#snippet mandalaArtwork(show: MandalaShow)}
  <SequenceMandala
    sequence={{ steps }}
    mode="card-back"
    style="stroke"
    {show}
    size={mandalaSize}
    bluePropType={effectiveBluePropType}
    redPropType={effectiveRedPropType}
    pathShape={mandalaPathShape}
    morphChanges
  />
{/snippet}

<div
  class="scroll-wrapper"
  class:has-scrollbar={scrollState.hasVerticalScrollbar}
  bind:this={scrollContainerRef}
>
  <div
    bind:this={gridSurfaceRef}
    class="grid-surface"
    class:standard={!isTimelineMode}
    class:timeline={isTimelineMode}
    class:assemble-surface={activeMode === "assemble"}
    class:clearing={isClearing || displayState.isClearingForGeneration}
    data-arrival-phase={arrivalRequest?.phase}
    style:--cell-size="{cellSize}px"
    style:--grid-center-offset="{standardGridCenterOffset}px"
    style:--grid-rows={gridLayout.rows}
    style:--grid-cols={gridLayout.totalColumns}
    style:--timeline-padding="{timelinePadding}px"
  >
    {#if isTimelineMode}
      <!-- ===== Timeline layout: start column + flexbox rows ===== -->
      {#if startPosition && !("isBlank" in startPosition && startPosition.isBlank)}
        <div class="timeline-start-column">
          <div
            class="timeline-cell"
            class:cell-selected={selectedStepNumber === 0}
            class:cell-practice={practiceStepNumber === 0}
            data-history-start-position
            in:fade={{ duration: getHistoryStartDuration() }}
            out:fade={{ duration: getHistoryStartDuration() }}
          >
            <div class="history-layout-shell">
              <StartTile
                {startPosition}
                shouldAnimate={displayState.shouldAnimateStartPosition}
                isSelected={selectedStepNumber === 0}
                isPracticeStep={practiceStepNumber === 0}
                {activeMode}
                {onStartClick}
                onLongPress={onStepLongPress}
                onDelete={onStepDelete}
                animationEpoch={displayState.animationEpoch}
                isTimelineMode={true}
                {bluePropTypeOverride}
                {redPropTypeOverride}
              />
            </div>
          </div>
          {#each timelineStartMandalas as cell (cell.index)}
            {#if cell.show !== null}
              {#if onMandalaClick}
                <button
                  type="button"
                  class="timeline-cell mandala-cell viewer-enabled"
                  class:light-bg={isLightBackground}
                  data-layout-mandala-key={`timeline-start:${cell.index}`}
                  onclick={() => onMandalaClick(cell.show!, mandalaPathShape)}
                  oncontextmenu={(e) => handleMandalaContextMenu(e, cell.show!)}
                  aria-label="Open mandala"
                  title="Open mandala"
                >
                  {@render mandalaArtwork(cell.show)}
                </button>
              {:else}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="timeline-cell mandala-cell"
                  class:light-bg={isLightBackground}
                  data-layout-mandala-key={`timeline-start:${cell.index}`}
                  oncontextmenu={(e) => handleMandalaContextMenu(e, cell.show!)}
                >
                  {@render mandalaArtwork(cell.show)}
                </div>
              {/if}
            {:else}
              <div
                class="timeline-cell"
                data-layout-mandala-key={`timeline-start:${cell.index}`}
              ></div>
            {/if}
          {/each}
        </div>
      {/if}

      <div class="timeline-rows">
        {#each timelineRows as row, rowIndex (rowIndex)}
          <div class="timeline-row">
            {#each row.steps as { stepIndex, duration } (getStepKey(steps[stepIndex]!, stepIndex))}
              {@const step = steps[stepIndex]!}
              {@const identity = getStepKey(step, stepIndex)}
              {@const isDeleting = isStepLeaving(stepIndex)}
              {@const musicalPosition = getDurationDisplay(stepIndex)}
              {@const effectiveDuration = getEffectiveMultiplier(
                stepIndex,
                duration
              )}
              <div
                class="timeline-cell step-container"
                class:deleting={isDeleting}
                class:arrival-destination={isArrivalDestination(stepIndex)}
                class:arrival-destination-hidden={isArrivalDestinationHidden(
                  stepIndex
                )}
                class:hidden-for-sequential={displayState.shouldBeatBeHidden(
                  stepIndex
                )}
                class:cell-selected={selectedStepNumber === step.stepNumber}
                class:cell-practice={practiceStepNumber === step.stepNumber}
                data-step-index={stepIndex}
                data-step-number={step.stepNumber}
                data-history-step-identity={identity}
                data-arrival-destination-state={isArrivalDestination(stepIndex)
                  ? isArrivalDestinationHidden(stepIndex)
                    ? "hidden"
                    : "ready"
                  : undefined}
                aria-hidden={isArrivalDestinationHidden(stepIndex)
                  ? "true"
                  : undefined}
                inert={isArrivalDestinationHidden(stepIndex)}
                style:--duration-multiplier={effectiveDuration}
                in:fade={{ duration: getHistoryMembershipDuration(identity) }}
                out:fade={{ duration: getHistoryMembershipDuration(identity) }}
              >
                <div class="history-layout-shell">
                  <StepCell
                    {step}
                    index={stepIndex}
                    transitionKey={identity}
                    onClick={(mods) => onStepClick?.(step.stepNumber, mods)}
                    onDelete={() => onStepDelete?.(step.stepNumber)}
                    onLongPress={() => onStepLongPress?.(step.stepNumber)}
                    shouldAnimate={displayState.shouldBeatAnimate(stepIndex)}
                    isSelected={selectedStepNumber === step.stepNumber}
                    isPracticeStep={practiceStepNumber === step.stepNumber}
                    {activeMode}
                    highlightStyle={highlightedSteps?.get(step.stepNumber) ??
                      null}
                    {musicalPosition}
                    isTimelineMode={true}
                    widthMultiplier={effectiveDuration}
                    animationEpoch={displayState.animationEpoch}
                    {bluePropTypeOverride}
                    {redPropTypeOverride}
                  />
                </div>
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
      {#each standardStartCells as startCell (startCell.key)}
        <div
          class="step-container"
          data-history-start-position
          style:grid-row="1"
          style:grid-column="1"
          in:fade={{ duration: getHistoryStartDuration() }}
          out:fade={{ duration: getHistoryStartDuration() }}
        >
          <div class="history-layout-shell">
            <StartTile
              startPosition={startCell.startPosition}
              shouldAnimate={displayState.shouldAnimateStartPosition}
              isSelected={selectedStepNumber === 0}
              isPracticeStep={practiceStepNumber === 0}
              {activeMode}
              {onStartClick}
              onLongPress={onStepLongPress}
              onDelete={onStepDelete}
              animationEpoch={displayState.animationEpoch}
              {bluePropTypeOverride}
              {redPropTypeOverride}
            />
          </div>
        </div>
      {/each}

      {#each standardStepCells as { step, index, identity } (identity)}
        {@const position = calculateStepPosition(index, gridLayout.columns)}
        {@const isDeleting = isStepLeaving(index)}
        {@const musicalPosition = getDurationDisplay(index)}
        <div
          class="step-container"
          class:deleting={isDeleting}
          class:arrival-destination={isArrivalDestination(index)}
          class:arrival-destination-hidden={isArrivalDestinationHidden(index)}
          class:hidden-for-sequential={displayState.shouldBeatBeHidden(index)}
          data-step-index={index}
          data-step-number={step.stepNumber}
          data-history-step-identity={identity}
          data-arrival-destination-state={isArrivalDestination(index)
            ? isArrivalDestinationHidden(index)
              ? "hidden"
              : "ready"
            : undefined}
          aria-hidden={isArrivalDestinationHidden(index) ? "true" : undefined}
          inert={isArrivalDestinationHidden(index)}
          style:grid-row={position.row}
          style:grid-column={position.column}
          in:fade={{ duration: getHistoryMembershipDuration(identity) }}
          out:fade={{ duration: getHistoryMembershipDuration(identity) }}
        >
          <div class="history-layout-shell">
            <StepCell
              {step}
              {index}
              transitionKey={identity}
              onClick={(mods) => onStepClick?.(step.stepNumber, mods)}
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
        </div>
      {/each}

      {#each standardMandalaCells as cell (cell.key)}
        <div
          class="mandala-layout-item"
          data-layout-mandala-key={cell.key}
          style:grid-row={cell.row}
          style:grid-column={cell.column}
        >
          {#if onMandalaClick}
            <button
              type="button"
              class="mandala-cell viewer-enabled"
              class:light-bg={isLightBackground}
              onclick={() => onMandalaClick(cell.show, mandalaPathShape)}
              oncontextmenu={(e) => handleMandalaContextMenu(e, cell.show)}
              aria-label="Open mandala"
              title="Open mandala"
            >
              {@render mandalaArtwork(cell.show)}
            </button>
          {:else}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="mandala-cell"
              class:light-bg={isLightBackground}
              oncontextmenu={(e) => handleMandalaContextMenu(e, cell.show)}
            >
              {@render mandalaArtwork(cell.show)}
            </div>
          {/if}
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
    margin-block: 0;
    translate: 0 var(--grid-center-offset, 0px);
  }

  /* Assemble grows one continuous record beside the interactive grid. Filling
     the unused cells keeps shorter final rows from cutting a staircase into
     the canvas while the sequence is still changing. */
  .grid-surface.standard.assemble-surface {
    background: var(--dm-pictograph-bg, #0a0a0f);
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

  /* A sizing box only. The layout transition transforms the cell around it,
     so this must not carry a background or a transform of its own. */
  .history-layout-shell {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  /* The leaving cell recedes in place while its neighbours hold still. The
     moment it is gone the layout transition carries every survivor to its new
     home, so the two halves read as one continuous gesture. */
  .step-container.deleting {
    animation: fadeOutCollapse var(--duration-normal, 200ms) ease-out forwards;
  }

  .step-container.hidden-for-sequential {
    opacity: 0;
    pointer-events: none;
  }

  .step-container.arrival-destination :global(.step-cell) {
    transition: none;
  }

  .step-container.arrival-destination-hidden {
    visibility: hidden;
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
    background:
      linear-gradient(
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
  .grid-surface.timeline
    :global(.timeline-cell:not(.cell-selected) .step-cell:hover) {
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
  .grid-surface.timeline
    :global(.timeline-cell.cell-selected:hover .step-cell) {
    transform: none;
  }

  /* ===== Pictograph border suppression ===== */
  .grid-surface :global(.pictograph-renderer) {
    border: none !important;
  }

  /* ===== Mandala cells ===== */
  .mandala-layout-item {
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 0;
  }

  .mandala-layout-item:hover {
    z-index: 2;
  }

  .mandala-layout-item > .mandala-cell {
    width: 100%;
    height: 100%;
  }

  .mandala-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    padding: 0;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    box-sizing: border-box;
    font: inherit;
    cursor: context-menu;
    background: color-mix(
      in srgb,
      var(--dm-pictograph-bg, #0a0a0f) 50%,
      transparent
    );
    transition:
      background 350ms ease,
      border-color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
  }

  .mandala-cell.viewer-enabled {
    cursor: pointer;
  }

  @media (hover: hover) {
    .mandala-cell.viewer-enabled:hover {
      z-index: 2;
      border-color: color-mix(
        in srgb,
        var(--theme-accent, #6366f1) 55%,
        transparent
      );
      transform: scale(1.03);
    }
  }

  .mandala-cell.viewer-enabled:active {
    transform: scale(0.98);
  }

  .mandala-cell.viewer-enabled:focus-visible {
    z-index: 2;
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
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

  @media (prefers-reduced-motion: reduce) {
    .mandala-cell {
      transition: background 350ms ease;
    }

    .mandala-cell.viewer-enabled:hover,
    .mandala-cell.viewer-enabled:active {
      transform: none;
    }
  }

  /* ===== Keyframes ===== */
  @keyframes fadeOutCollapse {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.86);
      pointer-events: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .grid-surface.standard {
      transition: none;
    }

    .step-container.deleting {
      animation: none;
    }
  }
</style>
