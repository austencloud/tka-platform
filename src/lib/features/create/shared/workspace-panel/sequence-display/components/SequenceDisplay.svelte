<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { BuildModeId } from "$lib/shared/foundation/ui/ui-types";
  import DifficultyBadge from "$lib/shared/components/DifficultyBadge.svelte";
import type { SequenceState } from "../../../state/sequence-state-orchestrator.svelte";
  import { getCreateModuleContext } from "../../../context/create-module-context";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import type { LetterSource } from "$lib/shared/create/domain/spell-models";
  import StepGrid from "./StepGrid.svelte";
  import WordLabel from "./WordLabel.svelte";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import LevelInfoModal from "./LevelInfoModal.svelte";
  import LOOPInfoModal from "./LOOPInfoModal.svelte";
  import { resolveLoopDisplay } from "$lib/features/loop-labeler/services/loop-display-resolver";
  import { loopDetector as circularLoopDetector } from "$lib/features/create/generate/circular/services/loop-detector";
  import { formatLOOPTypeForDisplay } from "$lib/shared/create/services/loop-type-utils";
  import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import type { Period } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { analyzeDifficulty } from "$lib/shared/browse/services/sequence-difficulty-calculator";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";
  import { getIsTimelineMode } from "../state/timeline-mode.svelte";
  import { updateStepDuration } from "../../../services/step-operations/duration-handler";
  import { UndoOperationType } from "../../../services/undo-manager";

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
    onStepSelected?: (stepNumber: number) => void;
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
    sequenceState.getRemovingBeatIndices()
  );
  const isClearing = $derived.by(() => sequenceState.getIsClearing());
  const isShiftStartMode = $derived(panelState.isShiftStartMode);
  const isTimelineMode = $derived(getIsTimelineMode());

  // Reactive LOOP detection - the circular detector still owns the
  // isCircular + loopType shape we need for grid alignment and the modal
  // title. The resolver layered on top of it gives us the icon-shaped
  // output (components + rotation slice size) for the badge.
  const loopDetectionResult = $derived.by(() => {
    if (!currentSequence) return null;
    if ((currentSequence.steps?.length ?? 0) < 2) return null;
    return circularLoopDetector.detectLOOPType(currentSequence);
  });

  const loopDisplay = $derived.by(() =>
    currentSequence
      ? resolveLoopDisplay(currentSequence)
      : {
          components: new Set<LOOPComponent>(),
          rotationPeriod: undefined as Period | undefined,
          inversionPeriod: undefined as Period | undefined,
          period: 1,
        }
  );
  const activeComponents = $derived(loopDisplay.components);
  const rotationPeriod = $derived(loopDisplay.rotationPeriod);
  const inversionPeriod = $derived(loopDisplay.inversionPeriod);
  const loopPeriod = $derived(loopDisplay.period);

  const hasDetectedLoop = $derived(activeComponents.size > 0);

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

  // Difficulty analysis - returns both level and the feature that triggered it
  const difficultyAnalysis = $derived.by(() => {
    if (!currentSequence?.steps?.length) {
      return { level: 1 as const, trigger: "none" as const };
    }
    return analyzeDifficulty([...currentSequence.steps]);
  });
  const difficultyLevel = $derived(difficultyAnalysis.level);

  const hasContent = $derived((currentSequence?.steps?.length ?? 0) > 0);

  // Info modals
  let showDifficultyInfo = $state(false);
  let showLoopInfo = $state(false);

  const loopDisplayName = $derived.by(() => {
    if (!loopDetectionResult?.loopType) return "";
    return formatLOOPTypeForDisplay(loopDetectionResult.loopType);
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

    onStepSelected?.(stepNumber);
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
      <!-- Top bar: Difficulty badge (left) + Word label (center) + LOOP icons (right) -->
      <div class="top-bar">
        <div class="top-left-zone">
          {#if hasContent}
            {#key difficultyLevel}
              <button
                class="badge-button pop-in"
                title="Level {difficultyLevel}"
                aria-label="Level {difficultyLevel} - tap for details"
                onclick={() => (showDifficultyInfo = true)}
              >
                <DifficultyBadge level={difficultyLevel} size="40px" fontSize="26px" />
              </button>
            {/key}
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
          {#if hasDetectedLoop}
            {#key loopDisplayName}
              <button
                class="loop-badge-button pop-in"
                aria-label="{loopDisplayName} LOOP - tap for details"
                onclick={() => (showLoopInfo = true)}
              >
                <LOOPIconStrip
                  {activeComponents}
                  {rotationPeriod}
                  {inversionPeriod}
                  period={loopPeriod}
                  size={22}
                  darkMode={true}
                  showFreeformWhenEmpty={false}
                />
              </button>
            {/key}
          {/if}
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
          manualColumnCount={loopAlignedColumnCount}
          sequenceWord={currentDisplayWord}
        />
      </div>
    </div>
  </div>
</div>

<!-- Difficulty Level Info Modal -->
<LevelInfoModal
  open={showDifficultyInfo}
  analysis={difficultyAnalysis}
  onclose={() => (showDifficultyInfo = false)}
/>

<!-- LOOP Info Modal -->
<LOOPInfoModal
  open={showLoopInfo}
  {activeComponents}
  loopDisplayName={loopDisplayName}
  sequence={currentSequence}
  period={loopPeriod}
  onclose={() => (showLoopInfo = false)}
/>

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

  /* Top bar with 3-column layout: Difficulty (left) | WordLabel (center) | LOOP icons (right) */
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
    min-width: 40px;
  }

  .badge-button {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.15s ease;
  }

  .badge-button:hover {
    transform: scale(1.1);
  }

  .badge-button:active {
    transform: scale(0.95);
  }

  .badge-button.pop-in {
    animation: badge-pop 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes badge-pop {
    0% {
      opacity: 0;
      transform: scale(0.7);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  .loop-badge-button.pop-in {
    animation: badge-pop 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    .badge-button.pop-in,
    .loop-badge-button.pop-in {
      animation: none;
    }
  }

  .top-right-zone {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 40px; /* Balance with left zone */
  }

  .word-label-area {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    /* Constrain width to prevent overflow into sibling button zones */
    min-width: 0;
    overflow: visible;
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

  /* LOOP badge clickable wrapper */
  .loop-badge-button {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    padding: 4px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .loop-badge-button:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .loop-badge-button:active {
    background: rgba(255, 255, 255, 0.12);
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
