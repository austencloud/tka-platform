<!--
  EditWorkspace.svelte

  Displays the sequence being edited with selectable steps.
  Reuses the existing StepGrid component from the Create module.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StartPositionData } from "../../create/shared/domain/models/StartPositionData";
  import type { StepData } from "../../create/shared/domain/models/StepData";
  import { isStartPosition } from "../../create/shared/domain/type-guards/pictograph-type-guards";
  import StepGrid from "../../create/shared/workspace-panel/sequence-display/components/StepGrid.svelte";
  import type { ISequenceNormalizer } from "$lib/features/compose/services/contracts/ISequenceNormalizer";
  import { onMount } from "svelte";

  interface Props {
    sequence: SequenceData | null;
    selectedStepNumber: number | null;
    selectedStepNumbers: number[];
    onStepSelect: (stepNumber: number, stepData: StepData | null) => void;
    onBeatMultiSelect: (stepNumber: number) => void;
    onChangeSequence?: () => void;
  }

  let {
    sequence,
    selectedStepNumber,
    selectedStepNumbers,
    onStepSelect,
    onBeatMultiSelect,
    onChangeSequence,
  }: Props = $props();

  // Service for normalizing sequence data
  let normalizationService: ISequenceNormalizer | null = $state(null);

  onMount(() => {
    try {
      normalizationService = container.items.sequenceNormalizer;
    } catch (error) {
      console.warn(
        "EditWorkspace: Failed to resolve ISequenceNormalizer:",
        error
      );
    }
  });

  /**
   * Fallback normalization when service isn't available
   * Handles the case where start position might be mixed in the steps array
   */
  function manualNormalize(seq: SequenceData) {
    // Check for dedicated start position fields first
    if (seq.startPosition) {
      return {
        steps: seq.steps || [],
        startPosition: seq.startPosition,
      };
    }

    if (seq.startingPosition) {
      return {
        steps: seq.steps || [],
        startPosition: seq.startingPosition,
      };
    }

    // Fallback: start position might be in the steps array
    const allSteps = seq.steps || [];
    const startPos = allSteps.find((beat) => isStartPosition(beat)) || null;
    const steps = allSteps.filter((beat) => !isStartPosition(beat));

    return { steps, startPosition: startPos };
  }

  // Normalize sequence data (separate steps from startPosition)
  const normalizedData = $derived.by(() => {
    if (!sequence) {
      return { steps: [], startPosition: null };
    }

    // Use service if available, otherwise use manual normalization
    if (normalizationService) {
      return normalizationService.separateStepsFromStartPosition(sequence);
    }

    return manualNormalize(sequence);
  });

  // Get steps and start position
  const steps = $derived(normalizedData.steps);
  const startPosition = $derived<StartPositionData | StepData | null>(
    normalizedData.startPosition
  );

  // Convert selectedStepNumbers array to Set for StepGrid
  const selectedBeatNumbersSet = $derived(new Set(selectedStepNumbers));

  // Handle beat click from StepGrid
  function handleStepClick(stepNumber: number) {
    const stepData =
      stepNumber === 0
        ? (startPosition as StepData | null)
        : (steps[stepNumber - 1] ?? null);
    onStepSelect(stepNumber, stepData);
  }

  // Handle start position click
  function handleStartClick() {
    onStepSelect(0, startPosition as StepData | null);
  }

  // Handle long press for multi-select
  function handleBeatLongPress(stepNumber: number) {
    onBeatMultiSelect(stepNumber);
  }

  function handleStartLongPress() {
    onBeatMultiSelect(0);
  }
</script>

<div class="edit-workspace">
  {#if sequence}
    <div class="sequence-header">
      <div class="header-left">
        <h3 class="sequence-name">{sequence.name || "Untitled Sequence"}</h3>
        <span class="beat-count">{steps.length} steps</span>
      </div>
      {#if onChangeSequence}
        <button
          class="change-sequence-btn"
          onclick={onChangeSequence}
          title="Change sequence"
          aria-label="Change sequence"
        >
          <i class="fas fa-folder-open" aria-hidden="true"></i>
        </button>
      {/if}
    </div>

    <div class="beat-grid-wrapper">
      <StepGrid
        {steps}
        {startPosition}
        {selectedStepNumber}
        selectedStepNumbers={selectedBeatNumbersSet}
        onStepClick={handleStepClick}
        onStartClick={handleStartClick}
        onStepLongPress={handleBeatLongPress}
        onStartLongPress={handleStartLongPress}
        isMultiSelectMode={selectedStepNumbers.length > 0}
      />
    </div>

    <div class="workspace-hint">
      Click a beat to select. Long-press to multi-select.
    </div>
  {:else}
    <div class="no-sequence">No sequence loaded</div>
  {/if}
</div>

<style>
  .edit-workspace {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px;
    overflow: hidden;
  }

  .sequence-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--theme-stroke);
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .sequence-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-text);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .beat-count {
    font-size: 0.8rem;
    color: var(--theme-text-dim);
    flex-shrink: 0;
  }

  .change-sequence-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 8px;
    background: rgba(6, 182, 212, 0.1);
    border: 1px solid rgba(6, 182, 212, 0.3);
    color: #06b6d4;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    flex-shrink: 0;
  }

  .change-sequence-btn:hover {
    background: rgba(6, 182, 212, 0.2);
    border-color: rgba(6, 182, 212, 0.5);
  }

  /* Wrapper for the reused StepGrid component */
  .beat-grid-wrapper {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .workspace-hint {
    text-align: center;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    padding-top: 8px;
    flex-shrink: 0;
  }

  .no-sequence {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--theme-text-dim);
  }
</style>
