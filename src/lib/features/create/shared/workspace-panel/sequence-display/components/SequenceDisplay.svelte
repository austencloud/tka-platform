<script lang="ts">
  import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
  import { container } from "$lib/shared/di";
  import type { SequenceState } from "../../../state/SequenceStateOrchestrator.svelte";
  import { getCreateModuleContext } from "../../../context/create-module-context";
  import type { LetterSource } from "$lib/features/create/spell/domain/models/spell-models";
  import BeatGrid from "./BeatGrid.svelte";
  import WordLabel from "./WordLabel.svelte";
  import UndoButton from "../../shared/components/buttons/UndoButton.svelte";
  import SaveToLibraryButton from "../../shared/components/buttons/SaveToLibraryButton.svelte";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";

  let {
    sequenceState,
    onBeatSelected,
    onStartPositionSelected,
    onBeatDelete,
    onBeatLongPress,
    selectedBeatNumber = null,
    practiceBeatNumber = null,
    isSideBySideLayout = false,
    shouldOrbitAroundCenter = false,
    activeMode = null,
    currentDisplayWord = "",
    letterSources = null,
  } = $props<{
    sequenceState: SequenceState;
    onBeatSelected?: (beatNumber: number) => void;
    onStartPositionSelected?: () => void;
    onBeatDelete?: (beatNumber: number) => void;
    onBeatLongPress?: () => void;
    selectedBeatNumber?: number | null; // 0=start, 1=first beat, 2=second beat, etc.
    practiceBeatNumber?: number | null; // 0=start, 1=first beat, 2=second beat, etc.
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
  const removingBeatIndex = $derived.by(() =>
    sequenceState.getRemovingBeatIndex()
  );
  const removingBeatIndices = $derived.by(() =>
    sequenceState.getRemovingBeatIndices()
  );
  const isClearing = $derived.by(() => sequenceState.getIsClearing());
  const isShiftStartMode = $derived(panelState.isShiftStartMode);

  // Convert selectedStartPosition (PictographData) to BeatData format for BeatGrid
  const startPositionBeat = $derived(() => {
    if (!selectedStartPosition) return null;

    // Create BeatData that extends the PictographData
    return {
      ...selectedStartPosition,
      beatNumber: 0,
      duration: 1000,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
    };
  });

  function handleBeatClick(beatNumber: number) {
    hapticService?.trigger("selection");

    // If in shift start mode, use the shift handler instead of normal selection
    if (panelState.isShiftStartMode && panelState.shiftStartHandler) {
      panelState.shiftStartHandler(beatNumber);
      return;
    }

    onBeatSelected?.(beatNumber);
  }

  function handleStartPositionClick() {
    hapticService?.trigger("selection");
    onStartPositionSelected?.();
  }
</script>

<div class="sequence-container">
  <div class="content-wrapper">
    <div class="label-and-beatframe-unit">
      <!-- Top bar: Undo button (left) + Word label (center) -->
      <div class="top-bar">
        <div class="top-left-zone">
          <UndoButton {CreateModuleState} />
        </div>
        <div class="word-label-area">
          <WordLabel
            word={currentDisplayWord}
            scrollMode={false}
            {letterSources}
          />
        </div>
        <div class="top-right-zone">
          <SaveToLibraryButton
            sequence={currentSequence}
            onclick={handleSaveButtonClick}
          />
        </div>
      </div>

      <div class="beat-grid-wrapper" class:shift-mode={isShiftStartMode}>
        <BeatGrid
          beats={currentSequence?.beats ?? []}
          startPosition={startPositionBeat() ?? undefined}
          onBeatClick={handleBeatClick}
          onStartClick={handleStartPositionClick}
          {onBeatDelete}
          {onBeatLongPress}
          {selectedBeatNumber}
          {removingBeatIndex}
          {removingBeatIndices}
          {isClearing}
          {shouldOrbitAroundCenter}
          {practiceBeatNumber}
          {isSideBySideLayout}
          {activeMode}
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
    transition: all 0.3s ease-out;
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
    transition: all 0.3s ease-out;
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
    transition: all 0.3s ease-out;
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
  }

  .beat-grid-wrapper {
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

  .beat-grid-wrapper.shift-mode {
    box-shadow:
      0 0 0 2px rgba(6, 182, 212, 0.5),
      0 0 20px rgba(6, 182, 212, 0.2);
  }
</style>
