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
  import SaveToLibraryButton from "../../shared/components/buttons/SaveToLibraryButton.svelte";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";
  import { getIsTimelineMode } from "../state/timeline-mode.svelte";

  let {
    sequenceState,
    onBeatSelected,
    onStartPositionSelected,
    onStepDelete,
    onStepLongPress,
    onAssemblerBack,
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
    onAssemblerBack?: (() => void) | null;
    selectedStepNumber?: number | null; // 0=start, 1=first beat, 2=second beat, etc.
    practiceStepNumber?: number | null; // 0=start, 1=first beat, 2=second beat, etc.
    isSideBySideLayout?: boolean;
    shouldOrbitAroundCenter?: boolean;
    activeMode?: BuildModeId | null;
    currentDisplayWord?: string;
    /** Optional: When provided for spell tab, enables original vs bridge letter styling */
    letterSources?: LetterSource[] | null;
  }>();

  // Check if we're in the assembler tab
  const isAssemblerTab = $derived(navigationState.activeTab === "assemble");

  const logger = createComponentLogger("SequenceDisplay");

  // Services
  const hapticService = container.items.hapticFeedback;

  // Get context for UndoButton and library save
  const ctx = getCreateModuleContext();
  const { CreateModuleState, panelState } = ctx;

  // Library save handler - use panelState for mutual exclusivity with other panels
  function handleSaveButtonClick() {
    panelState.openSaveToLibraryPanel(); // This calls closeAllPanels() first
  }

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
</script>

<div class="sequence-container">
  <div class="content-wrapper">
    <div class="label-and-beatframe-unit">
      <!-- Top bar: Undo/Back button (left) + Word label (center) -->
      <div class="top-bar">
        <div class="top-left-zone">
          {#if isAssemblerTab && onAssemblerBack}
            <button
              class="back-button"
              onclick={onAssemblerBack}
              aria-label="Back to grid mode selection"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M12 16L6 10L12 4"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          {:else}
            <UndoButton {CreateModuleState} />
          {/if}
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
          <SaveToLibraryButton
            sequence={currentSequence}
            onclick={handleSaveButtonClick}
          />
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

  /* Back button for Assembler tab */
  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 48px); /* WCAG AAA touch target */
    height: var(--min-touch-target, 48px);
    border: none;
    background: var(--theme-card-bg);
    border-radius: 10px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .back-button:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .back-button:active {
    transform: scale(0.95);
  }

  .back-button:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(139, 92, 246, 0.8));
    outline-offset: 2px;
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .sequence-container,
    .content-wrapper,
    .label-and-beatframe-unit,
    .step-grid-wrapper,
    .back-button {
      transition: none;
    }

    .back-button:active {
      transform: none;
    }
  }
</style>
