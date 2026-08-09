<!-- WorkspaceGrid.svelte - Unified workspace grid with standard and timeline layout modes -->
<script lang="ts">
  import { flip } from "svelte/animate";
  import { tick } from "svelte";
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
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
    PICTOGRAPH_ARRIVAL_LANDING_EASING,
    PICTOGRAPH_ARRIVAL_LANDING_MS,
  } from "../domain/pictograph-arrival-motion";
  import type {
    MandalaPathShape,
    MandalaRenderOptions,
  } from "$lib/shared/mandala/domain/mandala-types";
  import type { HistoryTransitionPlan } from "$lib/features/create/shared/services/history-transition-planner";

  const MANDALA_CELL_SCALE = 0.78;
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

  // Reading the grid geometry here ensures Svelte measures the keyed cells
  // whenever their tracks change, even when the underlying sequence objects
  // themselves did not move. The cells then glide and scale from their old
  // rectangles instead of repainting at the new size in one frame.
  const standardStartCells = $derived.by(() => {
    const layoutVersion = `${gridLayout.columns}:${gridLayout.cellSize}`;
    if (isTimelineMode || !hasStartPosition || !startPosition) return [];
    return [{ key: "start-position", startPosition, layoutVersion }];
  });

  const standardStepCells = $derived.by(() => {
    const layoutVersion = `${gridLayout.columns}:${gridLayout.cellSize}`;
    if (isTimelineMode) return [];
    return steps.map((step, index) => ({
      step,
      index,
      identity: getStepKey(step, index),
      layoutVersion,
    }));
  });

  function getLayoutFlipDuration(): number {
    if (
      (activeMode !== "construct" && historyTransition === null) ||
      removingStepIndex !== null ||
      isClearing ||
      displayState.isClearingForGeneration
    ) {
      return 0;
    }
    return motionDuration(PICTOGRAPH_ARRIVAL_LANDING_MS);
  }

  let gridSurfaceRef: HTMLDivElement | null = null;
  let gridHistoryAnimation: Animation | null = null;

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

  function getHistoryStepElements(): Map<string, HTMLElement> {
    if (!gridSurfaceRef) return new Map();
    return new Map(
      Array.from(
        gridSurfaceRef.querySelectorAll<HTMLElement>(
          "[data-history-step-identity]"
        )
      ).map((element) => [element.dataset.historyStepIdentity!, element])
    );
  }

  function cancelHistoryAnimations(element: HTMLElement): void {
    const shell = element.querySelector<HTMLElement>(".history-step-shell");
    shell?.getAnimations().forEach((animation) => animation.cancel());
    element
      .querySelector<HTMLElement>(".step-cell")
      ?.getAnimations()
      .forEach((animation) => animation.cancel());
  }

  $effect.pre(() => {
    const plan = historyTransition;
    const epoch = historyTransitionEpoch;
    if (!plan || !gridSurfaceRef) return;

    gridHistoryAnimation?.cancel();
    gridHistoryAnimation = null;

    const beforeElements = getHistoryStepElements();
    const beforeRects = new Map<string, DOMRect>();
    for (const [identity, element] of beforeElements) {
      beforeRects.set(identity, element.getBoundingClientRect());
      cancelHistoryAnimations(element);
    }

    void tick().then(() => {
      if (epoch !== historyTransitionEpoch || plan !== historyTransition)
        return;

      const duration = motionDuration(300);
      const currentElements = getHistoryStepElements();

      if (
        duration > 0 &&
        (plan.startPositionChanged ||
          plan.gridModeChanged ||
          plan.circularityChanged)
      ) {
        const surface = gridSurfaceRef;
        if (!surface) return;
        gridHistoryAnimation = surface.animate(
          [
            { opacity: 0.68, filter: "brightness(1.14)" },
            { opacity: 1, filter: "brightness(1)" },
          ],
          {
            duration: motionDuration(240),
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          }
        );
        if (gridHistoryAnimation) {
          const animation = gridHistoryAnimation;
          animation.onfinish = () => {
            animation.cancel();
            if (gridHistoryAnimation === animation) {
              gridHistoryAnimation = null;
            }
          };
        }
      }

      for (const transition of plan.steps) {
        if (transition.fromIndex === null || transition.toIndex === null) {
          continue;
        }

        const beforeRect = beforeRects.get(transition.identity);
        const element = currentElements.get(transition.identity);
        const shell = element?.querySelector<HTMLElement>(
          ".history-step-shell"
        );
        if (!beforeRect || !element || !shell) continue;

        const afterRect = element.getBoundingClientRect();
        const deltaX = beforeRect.left - afterRect.left;
        const deltaY = beforeRect.top - afterRect.top;
        const scaleX =
          afterRect.width > 0 ? beforeRect.width / afterRect.width : 1;
        const scaleY =
          afterRect.height > 0 ? beforeRect.height / afterRect.height : 1;
        const geometryChanged =
          Math.abs(deltaX) > 0.5 ||
          Math.abs(deltaY) > 0.5 ||
          Math.abs(scaleX - 1) > 0.005 ||
          Math.abs(scaleY - 1) > 0.005;

        if (duration > 0 && geometryChanged) {
          const animation = shell.animate(
            [
              {
                transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`,
              },
              { transform: "none" },
            ],
            {
              duration,
              easing: PICTOGRAPH_ARRIVAL_LANDING_EASING,
              fill: "both",
            }
          );
          animation.onfinish = () => animation.cancel();
        }

        const selectionAffected =
          plan.selectionChanged &&
          (element.dataset.stepNumber === String(plan.fromSelectedStepNumber) ||
            element.dataset.stepNumber === String(plan.toSelectedStepNumber));
        if (
          duration > 0 &&
          (transition.changes.size > 0 || selectionAffected)
        ) {
          const content = element.querySelector<HTMLElement>(".step-cell");
          content?.animate(
            [
              { opacity: 0.58, filter: "brightness(1.22)" },
              { opacity: 1, filter: "brightness(1)" },
            ],
            {
              duration: motionDuration(240),
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            }
          );
        }
      }
    });
  });

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
    class:layout-motion-enabled={getLayoutFlipDuration() > 0}
    data-arrival-phase={arrivalRequest?.phase}
    style:--cell-size="{cellSize}px"
    style:--grid-center-offset="{standardGridCenterOffset}px"
    style:--grid-layout-duration="{getLayoutFlipDuration()}ms"
    style:--grid-layout-easing={PICTOGRAPH_ARRIVAL_LANDING_EASING}
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
            in:fade={{ duration: getHistoryStartDuration() }}
            out:fade={{ duration: getHistoryStartDuration() }}
          >
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
          {#each timelineStartMandalas as cell (cell.index)}
            {#if cell.show !== null}
              {#if onMandalaClick}
                <button
                  type="button"
                  class="timeline-cell mandala-cell viewer-enabled"
                  class:light-bg={isLightBackground}
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
                  oncontextmenu={(e) => handleMandalaContextMenu(e, cell.show!)}
                >
                  {@render mandalaArtwork(cell.show)}
                </div>
              {/if}
            {:else}
              <div class="timeline-cell"></div>
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
              {@const isDeleting = removingStepIndices.has(stepIndex)}
              {@const shouldSlide =
                removingStepIndex !== null &&
                !isDeleting &&
                stepIndex > removingStepIndex}
              {@const musicalPosition = getDurationDisplay(stepIndex)}
              {@const effectiveDuration = getEffectiveMultiplier(
                stepIndex,
                duration
              )}
              <div
                class="timeline-cell step-container"
                class:deleting={isDeleting}
                class:sliding={shouldSlide}
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
                style:animation-delay={shouldSlide
                  ? `${Math.min(stepIndex - removingStepIndex - 1, 5) * 50}ms`
                  : "0ms"}
                in:fade={{ duration: getHistoryMembershipDuration(identity) }}
                out:fade={{ duration: getHistoryMembershipDuration(identity) }}
              >
                <div class="history-step-shell">
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
          style:grid-row="1"
          style:grid-column="1"
          animate:flip={{
            duration: getLayoutFlipDuration(),
            easing: cubicOut,
          }}
          in:fade={{ duration: getHistoryStartDuration() }}
          out:fade={{ duration: getHistoryStartDuration() }}
        >
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
      {/each}

      {#each standardStepCells as { step, index, identity } (identity)}
        {@const position = calculateStepPosition(index, gridLayout.columns)}
        {@const isDeleting = removingStepIndices.has(index)}
        {@const shouldSlide =
          removingStepIndex !== null &&
          !isDeleting &&
          index > removingStepIndex}
        {@const musicalPosition = getDurationDisplay(index)}
        <div
          class="step-container"
          class:deleting={isDeleting}
          class:sliding={shouldSlide}
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
          style:animation-delay={shouldSlide
            ? `${Math.min(index - removingStepIndex - 1, 5) * 50}ms`
            : "0ms"}
          animate:flip={{
            duration: historyTransition ? 0 : getLayoutFlipDuration(),
            easing: cubicOut,
          }}
          in:fade={{ duration: getHistoryMembershipDuration(identity) }}
          out:fade={{ duration: getHistoryMembershipDuration(identity) }}
        >
          <div class="history-step-shell">
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
          style:grid-row={cell.row}
          style:grid-column={cell.column}
          animate:flip={{
            duration: getLayoutFlipDuration(),
            easing: cubicOut,
          }}
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

  .grid-surface.standard.layout-motion-enabled {
    transition:
      opacity 300ms ease-out,
      transform 300ms ease-out,
      translate var(--grid-layout-duration, 280ms)
        var(--grid-layout-easing, cubic-bezier(0.4, 0, 0.2, 1));
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

  .history-step-shell {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    transform-origin: center;
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
    .grid-surface.standard {
      transition: none;
    }

    .step-container.deleting,
    .step-container.sliding {
      animation: none;
    }
  }
</style>
