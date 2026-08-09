<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { BuildModeId } from "$lib/shared/foundation/ui/ui-types";
  import type { SequenceState } from "../../../state/sequence-state-orchestrator.svelte";
  import { getCreateModuleContext } from "../../../context/create-module-context";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import type { LetterSource } from "$lib/shared/create/domain/spell-models";
  import type {
    MandalaPathShape,
    MandalaRenderOptions,
  } from "$lib/shared/mandala/domain/mandala-types";
  import StepGrid from "./StepGrid.svelte";
  import WordLabel from "./WordLabel.svelte";
  import SaveToLibraryButton from "../../shared/components/buttons/SaveToLibraryButton.svelte";
  import { loopDetector as circularLoopDetector } from "$lib/features/create/generate/circular/services/loop-detector";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";
  import { getIsTimelineMode } from "../state/timeline-mode.svelte";
  import { updateStepDuration } from "../../../services/step-operations/duration-handler";
  import { UndoOperationType } from "../../../services/undo-manager";
  import {
    logConstructContextPreviewCompleted,
    logConstructContextPreviewReady,
  } from "$lib/features/create/construct/services/construct-analytics";

  let {
    sequenceState,
    onStepSelected,
    onStartPositionSelected,
    onStepDelete,
    onStepLongPress,
    selectedStepNumber = null,
    practiceStepNumber = null,
    isSideBySideLayout = false,
    shouldOrbitAroundCenter = false,
    activeMode = null,
    currentDisplayWord = "",
    letterSources = null,
  } = $props<{
    sequenceState: SequenceState;
    onStepSelected?: (
      stepNumber: number,
      modifiers?: { range: boolean; toggle: boolean }
    ) => void;
    onStartPositionSelected?: () => void;
    onStepDelete?: (stepNumber: number) => void;
    onStepLongPress?: () => void;
    selectedStepNumber?: number | null; // 0=start, 1=first beat, 2=second beat, etc.
    practiceStepNumber?: number | null; // 0=start, 1=first beat, 2=second beat, etc.
    isSideBySideLayout?: boolean;
    shouldOrbitAroundCenter?: boolean;
    activeMode?: BuildModeId | null;
    currentDisplayWord?: string;
    /** Optional: When provided for spell tab, enables original vs bridge letter styling */
    letterSources?: LetterSource[] | null;
  }>();

  const logger = createComponentLogger("SequenceDisplay");

  // Services
  const hapticService = getHapticFeedback();

  // Get context for UndoButton and LOOP completion
  const ctx = getCreateModuleContext();
  const { CreateModuleState, panelState } = ctx;

  // LOOP detection - uses the circular LOOPDetector singleton directly
  // (detectLOOPType + SequenceData) rather than the loop-labeler version
  // (detectLOOP + SequenceEntry)

  // Use $derived.by() to ensure Svelte tracks the getters properly
  // when sequenceState is passed as a prop (not a reactive state)
  const currentSequence = $derived.by(() => sequenceState.currentSequence);
  const selectedStartPosition = $derived.by(
    () => sequenceState.selectedStartPosition
  );
  const removingStepIndex = $derived.by(() =>
    sequenceState.getRemovingStepIndex()
  );
  const removingStepIndices = $derived.by(() =>
    sequenceState.getRemovingStepIndices()
  );
  const isClearing = $derived.by(() => sequenceState.getIsClearing());
  const historyTransition = $derived.by(
    () => sequenceState.animationState.historyTransition
  );
  const historyTransitionEpoch = $derived.by(
    () => sequenceState.animationState.historyTransitionEpoch
  );
  const isShiftStartMode = $derived(panelState.isShiftStartMode);
  const isTimelineMode = $derived(getIsTimelineMode());
  const canSaveToLibrary = $derived(CreateModuleState.canShowActionButtons());
  const optionAudition = $derived(panelState.optionAudition);

  // Duration pattern preview renders on this same editable timeline: while a
  // preview session is active, the grid shows the previewed durations without
  // touching the active sequence. Apply/cancel semantics stay with the panel.
  const isDurationPreviewMode = $derived(panelState.isDurationPreviewMode);
  const displaySequence = $derived.by(() =>
    isDurationPreviewMode && panelState.previewSequence
      ? panelState.previewSequence
      : currentSequence
  );

  // Multi-select highlight: paint every batch-selected beat with the accent
  // ring via the existing StepCell `.highlighted` mechanism. Gold `.selected`
  // stays reserved for single-select (selectedStepNumber is null in multi mode).
  const MULTI_HIGHLIGHT = {
    bg: "rgba(139, 92, 246, 0.24)",
    border: "rgba(139, 92, 246, 0.9)",
  };
  const highlightedSteps = $derived.by(() => {
    if (!sequenceState.isMultiSelectMode) return null;
    const map = new Map<number, { bg: string; border: string }>();
    for (const n of sequenceState.selectedStepNumbers) {
      map.set(n, MULTI_HIGHLIGHT);
    }
    return map;
  });

  // Reactive LOOP detection - kept for grid alignment: the circular detector's
  // isCircular + loopType shape drives loopAlignedColumnCount below (the badge
  // that also read it has been removed).
  const loopDetectionResult = $derived.by(() => {
    if (!currentSequence) return null;
    if ((currentSequence.steps?.length ?? 0) < 2) return null;
    return circularLoopDetector.detectLOOPType(currentSequence);
  });

  // LOOP-aligned column count: align the grid to match the LOOP's slice structure
  // so that each row visually represents one slice of the circular pattern.
  const loopAlignedColumnCount = $derived.by(() => {
    // Gate on circularity, not loopType - a 6-step loop is circular
    // but may not have a recognized loopType (compound detection needs 8+ steps)
    if (!loopDetectionResult?.isCircular) return null;

    const stepCount = currentSequence?.steps?.length ?? 0;
    if (stepCount < 4) return null;

    // Try halving first. If that gives too many columns (>5), quarter instead.
    const halved = stepCount / 2;
    const columns = halved <= 5 ? halved : Math.ceil(stepCount / 4);

    if (!Number.isInteger(halved) && halved <= 5) return null;
    if (columns < 2) return null;

    return columns;
  });

  // Convert selectedStartPosition (PictographData) to StepData format for StepGrid
  const startPositionStep = $derived(() => {
    if (!selectedStartPosition) return null;

    // Create StepData that extends the PictographData
    return {
      ...selectedStartPosition,
      stepNumber: 0,
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
    };
  });

  function handleStepClick(
    stepNumber: number,
    modifiers?: { range: boolean; toggle: boolean }
  ) {
    hapticService?.trigger("selection");

    // If in shift start mode, use the shift handler instead of normal selection.
    // (Spell's "move start" takes priority over range-select — shift means
    // reorder-start there, not extend-selection.)
    if (panelState.isShiftStartMode && panelState.shiftStartHandler) {
      panelState.shiftStartHandler(stepNumber);
      return;
    }

    onStepSelected?.(stepNumber, modifiers);
  }

  function handleStartPositionClick() {
    hapticService?.trigger("selection");
    onStartPositionSelected?.();
  }

  function handleMandalaClick(
    variant: MandalaRenderOptions["show"],
    pathShape: MandalaPathShape
  ) {
    hapticService?.trigger("selection");
    sequenceState.clearSelection();
    panelState.openMandalaViewer({ variant, pathShape });
  }

  function handleDurationChange(stepNumber: number, newDuration: number) {
    hapticService?.trigger("selection");
    CreateModuleState.pushUndoSnapshot(
      UndoOperationType.MODIFY_BEAT_PROPERTIES
    );
    updateStepDuration(stepNumber, newDuration, CreateModuleState);
  }

  function handleAuditionReady(requestId: number, autoplay: boolean) {
    const audition = panelState.optionAudition;
    if (!audition || audition.requestId !== requestId) return;

    logConstructContextPreviewReady({
      stepNumber: audition.stepNumber,
      latencyMs: performance.now() - audition.activatedAt,
      autoplay,
    });
  }

  function handleAuditionCompleted(requestId: number) {
    const audition = panelState.optionAudition;
    if (!audition || audition.requestId !== requestId) return;

    logConstructContextPreviewCompleted({
      stepNumber: audition.stepNumber,
    });
  }

  function handleAuditionDismiss(requestId: number) {
    if (panelState.optionAudition?.requestId !== requestId) return;
    panelState.exitOptionAudition();
  }
</script>

<div class="sequence-container">
  <div class="content-wrapper">
    <div class="label-and-beatframe-unit">
      <!-- The leading header track is occupied by the workspace-level history
           action. Save remains opposite it so the sequence name stays centered. -->
      <div class="top-bar">
        <div class="word-label-area">
          <WordLabel
            word={currentDisplayWord}
            scrollMode={false}
            {letterSources}
            activeStepNumber={practiceStepNumber}
            {historyTransitionEpoch}
            historyWordChanged={historyTransition?.wordChanged ?? false}
          />
        </div>

        <div class="save-area">
          {#if canSaveToLibrary}
            <SaveToLibraryButton
              sequence={currentSequence}
              onclick={() => panelState.openSaveToLibraryPanel()}
            />
          {/if}
        </div>
      </div>

      <div class="step-grid-wrapper" class:shift-mode={isShiftStartMode}>
        <StepGrid
          steps={displaySequence?.steps ?? []}
          arrivalSequence={displaySequence}
          {optionAudition}
          startPosition={startPositionStep() ?? undefined}
          onStepClick={handleStepClick}
          onStartClick={handleStartPositionClick}
          {onStepDelete}
          {onStepLongPress}
          {selectedStepNumber}
          {removingStepIndex}
          {removingStepIndices}
          {isClearing}
          {historyTransition}
          {historyTransitionEpoch}
          {shouldOrbitAroundCenter}
          {practiceStepNumber}
          {isSideBySideLayout}
          {activeMode}
          {isTimelineMode}
          {highlightedSteps}
          onDurationChange={isDurationPreviewMode
            ? undefined
            : handleDurationChange}
          onMandalaClick={handleMandalaClick}
          onAuditionReady={handleAuditionReady}
          onAuditionCompleted={handleAuditionCompleted}
          onAuditionDismiss={handleAuditionDismiss}
          manualColumnCount={loopAlignedColumnCount}
          sequenceWord={currentDisplayWord}
        />
      </div>
    </div>
  </div>
</div>

<style>
  .sequence-container {
    container-type: inline-size;
    container-name: sequence-workspace;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: visible;
    padding: 0; /* Removed padding - parent SequenceDisplay handles top spacing for word label */
    box-sizing: border-box;
    transition: all var(--duration-emphasis) ease-out;
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    flex: 1;
    min-height: 0;
    transition: all var(--duration-emphasis) ease-out;
  }

  .label-and-beatframe-unit {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: 100%;
    gap: 0;
    flex: 1 1 auto;
    min-height: 0;
    transition: all var(--duration-emphasis) ease-out;
  }

  /* Equal action tracks keep the word centered while the workspace history
     action and Save occupy the two stable document-level positions. */
  .top-bar {
    box-sizing: border-box;
    display: grid;
    grid-template-columns:
      var(--workspace-leading-actions-width, var(--min-touch-target, 44px))
      minmax(0, 1fr)
      var(--workspace-leading-actions-width, var(--min-touch-target, 44px));
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    width: 100%;
    padding: 8px 12px;
    flex-shrink: 0;
  }

  .word-label-area {
    grid-column: 2;
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    /* Constrain width to prevent overflow into sibling button zones */
    min-width: 0;
    overflow: visible;
  }

  .save-area {
    grid-column: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    justify-self: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
  }

  @container sequence-workspace (min-width: 768px) {
    .top-bar {
      --workspace-leading-actions-width: 192px;
      --workspace-action-label-display: inline;
      --workspace-action-width: auto;
      --workspace-action-gap: 8px;
      --workspace-action-padding-inline: 16px;
      --workspace-action-radius: 999px;
    }

    .save-area {
      width: 100%;
    }
  }

  .step-grid-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    flex: 1 1 auto;
    min-height: 0;
    border-radius: 12px;
    transition:
      box-shadow 0.2s ease,
      border-color 0.2s ease;
  }

  .step-grid-wrapper.shift-mode {
    box-shadow:
      0 0 0 2px rgba(6, 182, 212, 0.5),
      0 0 20px rgba(6, 182, 212, 0.2);
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .sequence-container,
    .content-wrapper,
    .label-and-beatframe-unit,
    .step-grid-wrapper {
      transition: none;
    }
  }
</style>
