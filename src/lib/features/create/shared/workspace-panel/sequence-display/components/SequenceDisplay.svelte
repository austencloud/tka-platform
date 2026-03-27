<script lang="ts">
  import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
  import { DIFFICULTY_LEVELS, DEFAULT_DIFFICULTY_STYLE } from "$lib/shared/config/difficulty-styles";
  import { container } from "$lib/shared/di";
  import type { SequenceState } from "../../../state/SequenceStateOrchestrator.svelte";
  import { getCreateModuleContext } from "../../../context/create-module-context";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import type { LetterSource } from "$lib/features/create/spell/domain/models/spell-models";
  import StepGrid from "./StepGrid.svelte";
  import WordLabel from "./WordLabel.svelte";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
  import { SliceSize } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import { loopTypeResolver } from "$lib/features/create/generate/shared/services/implementations/LOOPTypeResolver";
  import { loopDetector as circularLoopDetector } from "$lib/features/create/generate/circular/services/implementations/LOOPDetector";
  import { SequenceDifficultyCalculator } from "$lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator";
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

  // LOOP detection — uses the circular LOOPDetector singleton directly
  // (detectLOOPType + SequenceData) rather than container.items.loopDetector
  // which is the loop-labeler version (detectLOOP + SequenceEntry)

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

  const activeComponents = $derived.by(() => {
    if (!loopDetectionResult?.loopType) return new Set<LOOPComponent>();
    return loopTypeResolver.parseComponents(loopDetectionResult.loopType);
  });

  const hasDetectedLoop = $derived(activeComponents.size > 0);

  // LOOP-aligned column count: align the grid to match the LOOP's slice structure
  // so that each row visually represents one slice of the circular pattern.
  const loopAlignedColumnCount = $derived.by(() => {
    // Gate on circularity, not loopType — a 6-step loop is circular
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

  // Difficulty level badge (mirrors ChoreoCard exactly)
  const difficultyCalculator = new SequenceDifficultyCalculator();
  const difficultyLevel = $derived.by(() => {
    if (!currentSequence?.steps?.length) return 1;
    return difficultyCalculator.calculateDifficultyLevel([...currentSequence.steps]);
  });

  // Level badge colors — single source of truth shared with the image compositor
  const currentLevelStyle = $derived.by(() => {
    const style = DIFFICULTY_LEVELS[difficultyLevel] ?? DEFAULT_DIFFICULTY_STYLE;
    return { bg: style.cssBg, border: style.border, text: style.text };
  });
  const hasContent = $derived((currentSequence?.steps?.length ?? 0) > 0);

  // Info modals
  let showDifficultyInfo = $state(false);
  let showLoopInfo = $state(false);

  const loopDisplayName = $derived.by(() => {
    if (!loopDetectionResult?.loopType) return "";
    return loopTypeResolver.formatForDisplay(loopDetectionResult.loopType);
  });

  const difficultyDescriptions: Record<number, string> = {
    1: "Base Motions",
    2: "Whole Turns",
    3: "Half Turns, Floats",
  };

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
      <!-- Top bar: Difficulty badge (left) + Word label (center) + LOOP icons (right) -->
      <div class="top-bar">
        <div class="top-left-zone">
          {#if hasContent}
            {#key difficultyLevel}
              <button
                class="difficulty-badge pop-in"
                style="
                  background: {currentLevelStyle.bg};
                  border-color: {currentLevelStyle.border};
                  color: {currentLevelStyle.text};
                "
                title="Level {difficultyLevel}"
                aria-label="Level {difficultyLevel} — tap for details"
                onclick={() => (showDifficultyInfo = true)}
              >
                {difficultyLevel}
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
                aria-label="{loopDisplayName} LOOP — tap for details"
                onclick={() => (showLoopInfo = true)}
              >
                <LOOPIconStrip
                  {activeComponents}
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
        />
      </div>
    </div>
  </div>
</div>

<!-- Difficulty Level Info Modal -->
<BaseModal
  open={showDifficultyInfo}
  onclose={() => (showDifficultyInfo = false)}
  size="sm"
>
  <ModalHeader
    title="Level {difficultyLevel}"
    subtitle={difficultyDescriptions[difficultyLevel] ?? ""}
    icon="fa-layer-group"
    iconColor={difficultyLevel === 3 ? "#b8860b" : difficultyLevel === 2 ? "#a8a8a8" : "#6366f1"}
    onClose={() => (showDifficultyInfo = false)}
  />
  <div class="info-modal-body">
    <p>Each level introduces new concepts.</p>
    <div class="level-list">
      {#each [1, 2, 3] as level}
        {@const style = DIFFICULTY_LEVELS[level] ?? DEFAULT_DIFFICULTY_STYLE}
        <div class="level-row" class:current={level === difficultyLevel}>
          <div
            class="level-dot"
            style="background: {style.cssBg}; border-color: {style.border}; color: {style.text};"
          >{level}</div>
          <span class="level-desc">{difficultyDescriptions[level]}</span>
        </div>
      {/each}
    </div>
  </div>
</BaseModal>

<!-- LOOP Info Modal -->
<BaseModal
  open={showLoopInfo}
  onclose={() => (showLoopInfo = false)}
  size="sm"
>
  <ModalHeader
    title="{loopDisplayName} LOOP"
    subtitle="This sequence repeats with a transformation pattern"
    icon="fa-infinity"
    iconColor="#36c3ff"
    onClose={() => (showLoopInfo = false)}
  />
  <div class="info-modal-body">
    <p>A LOOP (Linked Orbital Offset Pattern) means the second half of this sequence is a transformation of the first half. When played on repeat, it creates a seamless cycle.</p>
    <div class="loop-components-display">
      <span class="components-label">Active components:</span>
      <div class="components-strip">
        <LOOPIconStrip
          {activeComponents}
          size={28}
          darkMode={true}
          showFreeformWhenEmpty={false}
        />
      </div>
    </div>
  </div>
</BaseModal>

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

  /* Difficulty badge — matches ChoreoCard.svelte proportions */
  .difficulty-badge {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid black;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Cambria, serif;
    font-weight: bold;
    font-size: 26px;
    flex-shrink: 0;
    cursor: pointer;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.15s ease;
  }

  .difficulty-badge:hover {
    transform: scale(1.1);
  }

  .difficulty-badge:active {
    transform: scale(0.95);
  }

  .difficulty-badge.pop-in {
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
    .difficulty-badge.pop-in,
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

  /* Info modal body */
  .info-modal-body {
    padding: 20px;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim);
    line-height: 1.6;
  }

  .info-modal-body p {
    margin: 0 0 16px;
  }

  /* Level list in difficulty modal */
  .level-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .level-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 8px;
    border-radius: 8px;
    transition: background 0.15s ease;
  }

  .level-row.current {
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
  }

  .level-dot {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid black;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Cambria, serif;
    font-weight: bold;
    font-size: 14px;
    padding-bottom: 1px;
    flex-shrink: 0;
  }

  .level-desc {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
  }

  .level-row.current .level-desc {
    color: var(--theme-text);
    font-weight: 500;
  }

  /* LOOP components display */
  .loop-components-display {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
  }

  .components-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
  }

  .components-strip {
    display: flex;
    justify-content: center;
    padding: 8px 0;
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
