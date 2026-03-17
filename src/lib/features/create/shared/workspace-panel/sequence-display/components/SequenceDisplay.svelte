<script lang="ts">
  import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
  import { container } from "$lib/shared/di";
  import type { SequenceState } from "../../../state/SequenceStateOrchestrator.svelte";
  import { getCreateModuleContext } from "../../../context/create-module-context";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import type { LetterSource } from "$lib/features/create/spell/domain/models/spell-models";
  import StepGrid from "./StepGrid.svelte";
  import WordLabel from "./WordLabel.svelte";
  import UndoButton from "../../shared/components/buttons/UndoButton.svelte";
  import LOOPRingButton from "../../shared/components/buttons/LOOPRingButton.svelte";
  import LOOPCompletionPopover from "../../shared/components/LOOPCompletionPopover.svelte";
  import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
  import type { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import { loopTypeResolver } from "$lib/features/create/generate/shared/services/implementations/LOOPTypeResolver";
  import { loopDetector as circularLoopDetector } from "$lib/features/create/generate/circular/services/implementations/LOOPDetector";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";
  import { getIsTimelineMode } from "../state/timeline-mode.svelte";
  import { updateStepDuration } from "../../../services/implementations/step-operations/DurationHandler";
  import { UndoOperationType } from "../../../services/contracts/IUndoManager";

  let {
    sequenceState,
    onBeatSelected,
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
    onBeatSelected?: (stepNumber: number) => void;
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
  const hapticService = container.items.hapticFeedback;

  // Get context for UndoButton and LOOP completion
  const ctx = getCreateModuleContext();
  const { CreateModuleState, panelState } = ctx;

  // LOOP analysis state
  // Use the circular LOOPDetector singleton directly (detectLOOPType + SequenceData)
  // rather than container.items.loopDetector which is the loop-labeler version
  // (detectLOOP + SequenceEntry — a different data model)
  const extensionFlowCoordinator = container.items.extensionFlowCoordinator;

  let showLoopPopover = $state(false);
  let extensionAnalysis = $state<import("$lib/features/create/shared/services/contracts/ISequenceExtender").ExtensionAnalysis | null>(null);
  let analysisRequestId = 0;

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
    sequenceState.getRemovingBeatIndices()
  );
  const isClearing = $derived.by(() => sequenceState.getIsClearing());
  const isShiftStartMode = $derived(panelState.isShiftStartMode);
  const isTimelineMode = $derived(getIsTimelineMode());

  // Reactive LOOP detection
  const loopDetectionResult = $derived.by(() => {
    if (!currentSequence) return null;
    if ((currentSequence.steps?.length ?? 0) < 2) return null;
    return circularLoopDetector.detectLOOPType(currentSequence);
  });

  const isCircular = $derived(loopDetectionResult?.isCircular ?? false);

  const activeComponents = $derived.by(() => {
    if (!loopDetectionResult?.loopType) return new Set<LOOPComponent>();
    return loopTypeResolver.parseComponents(loopDetectionResult.loopType);
  });

  const currentLoopLabel = $derived.by(() => {
    if (!loopDetectionResult?.loopType) return null;
    return loopTypeResolver.formatForDisplay(loopDetectionResult.loopType);
  });

  const availableComponents = $derived.by(() => {
    const set = new Set<LOOPComponent>();
    if (!extensionAnalysis) return set;
    for (const option of extensionAnalysis.availableLOOPOptions) {
      const components = loopTypeResolver.parseComponents(option.loopType);
      for (const c of components) set.add(c);
    }
    return set;
  });

  const hasSufficientBeats = $derived((currentSequence?.steps?.length ?? 0) >= 2);

  // Run extension analysis when sequence changes (with stale-request guard).
  // Only analyzes if the sequence isn't already a detected LOOP — if it is,
  // there's nothing to extend and the ring just shows the active LOOP state.
  $effect(() => {
    if (!currentSequence || !extensionFlowCoordinator || !hasSufficientBeats) {
      extensionAnalysis = null;
      return;
    }
    if (loopDetectionResult?.loopType) {
      extensionAnalysis = null;
      return;
    }
    const requestId = ++analysisRequestId;
    extensionFlowCoordinator.startFlow(currentSequence).then((result) => {
      if (requestId !== analysisRequestId) return;
      extensionAnalysis = result.canExtend ? (result.analysis ?? null) : null;
    });
  });

  // LOOP popover handlers
  function handleLoopRingClick() {
    showLoopPopover = !showLoopPopover;
  }

  function handleComponentSelect(_component: LOOPComponent, loopType: LOOPType) {
    showLoopPopover = false;
    panelState.requestLoopCompletion(loopType);
  }

  // Close popover on click outside
  $effect(() => {
    if (!showLoopPopover) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".loop-ring-wrapper")) {
        showLoopPopover = false;
      }
    }
    document.addEventListener("click", handleClickOutside, true);
    return () => document.removeEventListener("click", handleClickOutside, true);
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

  function handleStepClick(stepNumber: number) {
    hapticService?.trigger("selection");

    // If in shift start mode, use the shift handler instead of normal selection
    if (panelState.isShiftStartMode && panelState.shiftStartHandler) {
      panelState.shiftStartHandler(stepNumber);
      return;
    }

    onBeatSelected?.(stepNumber);
  }

  function handleStartPositionClick() {
    hapticService?.trigger("selection");
    onStartPositionSelected?.();
  }

  function handleDurationChange(stepNumber: number, newDuration: number) {
    hapticService?.trigger("selection");
    CreateModuleState.pushUndoSnapshot(
      UndoOperationType.MODIFY_BEAT_PROPERTIES
    );
    updateStepDuration(stepNumber, newDuration, CreateModuleState);
  }
</script>

<div class="sequence-container">
  <div class="content-wrapper">
    <div class="label-and-beatframe-unit">
      <!-- Top bar: Undo/Back button (left) + Word label (center) -->
      <div class="top-bar">
        <div class="top-left-zone">
          <UndoButton {CreateModuleState} />
        </div>
        <div class="word-label-area">
          <WordLabel
            word={currentDisplayWord}
            scrollMode={false}
            {letterSources}
            activeStepNumber={practiceStepNumber}
          />
        </div>
        <div class="top-right-zone">
          <div class="loop-ring-wrapper">
            <LOOPRingButton
              {activeComponents}
              {availableComponents}
              disabled={!hasSufficientBeats}
              onclick={handleLoopRingClick}
            />
            {#if showLoopPopover}
              <div class="loop-popover">
                <LOOPCompletionPopover
                  {activeComponents}
                  availableLOOPOptions={extensionAnalysis?.availableLOOPOptions ?? []}
                  {currentLoopLabel}
                  {isCircular}
                  {hasSufficientBeats}
                  onComponentSelect={handleComponentSelect}
                />
              </div>
            {/if}
          </div>
        </div>
      </div>

      <div class="step-grid-wrapper" class:shift-mode={isShiftStartMode}>
        <StepGrid
          steps={currentSequence?.steps ?? []}
          startPosition={startPositionStep() ?? undefined}
          onStepClick={handleStepClick}
          onStartClick={handleStartPositionClick}
          {onStepDelete}
          {onStepLongPress}
          {selectedStepNumber}
          {removingStepIndex}
          {removingStepIndices}
          {isClearing}
          {shouldOrbitAroundCenter}
          {practiceStepNumber}
          {isSideBySideLayout}
          {activeMode}
          {isTimelineMode}
          onDurationChange={handleDurationChange}
        />
      </div>
    </div>
  </div>
</div>

<style>
  .sequence-container {
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

  /* Top bar with 3-column layout: Undo (left) | WordLabel (center) | Empty (right) */
  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 8px 12px;
    flex-shrink: 0;
  }

  .top-left-zone {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    min-width: 60px; /* Reserve space for undo button */
  }

  .top-right-zone {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 60px; /* Balance with left zone */
  }

  .loop-ring-wrapper {
    position: relative;
  }

  .loop-popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 100;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .word-label-area {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    /* Constrain width to prevent overflow into sibling button zones */
    min-width: 0;
    overflow: hidden;
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
