<!--
	WorkspacePanel.svelte

	Workspace panel containing the sequence display and action buttons.
	Main area for viewing and interacting with the sequence.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { onMount } from "svelte";
  import Toast from "../components/Toast.svelte";
  import SequenceDisplay from "../sequence-display/components/SequenceDisplay.svelte";
  import type { IStepOperator } from "../../services/contracts/IStepOperator";
  import type { SequenceState } from "../../state/SequenceStateOrchestrator.svelte";
  import type { CreateModuleState } from "../../state/create-module-state.svelte";
  import type { IAnimationStateRef } from "../../types/create-module-types";
  import type { PanelCoordinationState } from "../../state/panel-coordination-state.svelte";
  import type { LetterSource } from "$lib/features/create/spell/domain/models/spell-models";

  // Services
  let StepOperator: IStepOperator | null = null;

  // Props
  let {
    sequenceState,
    createModuleState,
    panelState = null,
    practiceStepIndex = null,
    animatingStepNumber = null,
    shouldOrbitAroundCenter = false,

    // Animation state ref (for animate tab)
    animationStateRef = null,

    // Layout mode
    isSideBySideLayout = false,

    // Current word display
    currentDisplayWord = "",

    // Letter sources for spell tab
    letterSources = null,

    // Assembler back handler (returns to welcome screen)
    onAssemblerBack = null,
  }: {
    sequenceState?: SequenceState;
    createModuleState?: CreateModuleState;
    panelState?: PanelCoordinationState | null;
    practiceStepIndex?: number | null;
    animatingStepNumber?: number | null;
    shouldOrbitAroundCenter?: boolean;

    // Animation state ref
    animationStateRef?: IAnimationStateRef | null;

    // Layout mode
    isSideBySideLayout?: boolean;

    // Current word display
    currentDisplayWord?: string;

    /** Letter sources for spell tab - enables original vs bridge letter styling */
    letterSources?: LetterSource[] | null;

    /** Handler for assembler back button - returns to welcome screen */
    onAssemblerBack?: (() => void) | null;
  } = $props();

  // Local beat selection state (stepNumber: 0=start, 1=first beat, etc.)
  let localSelectedStepNumber = $state<number | null>(null);

  // Effect: Update local selection when animation is playing
  $effect(() => {
    if (animatingStepNumber !== null) {
      localSelectedStepNumber = animatingStepNumber;
    }
  });

  // Effect: Sync local selection with sequenceState selection
  // This ensures UI updates when selection is cleared via edit panel close
  $effect(() => {
    if (!sequenceState) return;

    const globalSelection = sequenceState.selectedStepNumber;
    // Only sync if animation isn't playing (animation takes precedence)
    if (animatingStepNumber === null) {
      localSelectedStepNumber = globalSelection;
    }
  });

  // Toast message for validation errors
  let toastMessage = $state<string | null>(null);

  // Handle beat selection (receives stepNumber: 1, 2, 3...)
  function handleBeatSelected(stepNumber: number) {
    if (!sequenceState) return;

    // Close any open viewer/animation panels - editing takes priority
    // ShareHub panel handles stopping its own animation when closed
    panelState?.closeShareHubPanel();
    panelState?.closeAnimationPanel();
    animationStateRef?.stop();

    // Select the step - the edit panel will open automatically
    localSelectedStepNumber = stepNumber;
    sequenceState.selectStep(stepNumber);
    // Note: We no longer switch to edit tab! The edit slide panel will open instead.
    // This is handled by an effect in CreateModule.svelte that watches for step selection.
  }

  // Handle start position selection (stepNumber 0)
  function handleStartPositionSelected() {
    if (!sequenceState) return;

    // Only proceed if there's actually a start position selected
    if (
      !sequenceState.hasStartPosition ||
      !sequenceState.selectedStartPosition
    ) {
      return;
    }

    // Close any open viewer/animation panels - editing takes priority
    // ShareHub panel handles stopping its own animation when closed
    panelState?.closeShareHubPanel();
    panelState?.closeAnimationPanel();
    animationStateRef?.stop();

    // Select start position for editing (stepNumber 0)
    localSelectedStepNumber = 0;
    sequenceState.selectStartPositionForEditing();

    // Note: We no longer switch to edit tab! The edit slide panel will open instead.
    // This is handled by an effect in CreateModule.svelte that watches for start position selection.
  }

  // Handle beat deletion via keyboard
  function handleStepDelete(stepNumber: number) {
    if (!createModuleState) {
      console.warn("Cannot delete beat - createModuleState not initialized");
      return;
    }

    try {
      // Special case: Start position (stepNumber 0) - clear it instead of removing
      if (stepNumber === 0) {
        sequenceState?.setStartPosition(null);
        sequenceState?.clearSelection();
        // Close beat editor panel since workspace is now empty
        panelState?.closeStepEditorPanel();
        return;
      }

      if (!StepOperator) {
        console.warn("Cannot delete beat - StepOperator not initialized");
        return;
      }

      // Convert stepNumber (1, 2, 3...) to stepIndex (0, 1, 2...)
      const stepIndex = stepNumber - 1;
      StepOperator.removeStep(stepIndex, createModuleState);
    } catch (err) {
      console.error("Failed to remove beat", err);
      toastMessage = "Failed to remove beat";
      setTimeout(() => (toastMessage = null), 3000);
    }
  }

  // Initialize services on mount
  onMount(() => {
    StepOperator = container.items.stepOperator;
  });
</script>

{#if sequenceState}
  <div class="workspace-panel" data-testid="workspace-panel">
    <!-- Sequence Display -->
    <div class="sequence-display-container">
      <SequenceDisplay
        {sequenceState}
        onBeatSelected={handleBeatSelected}
        onStartPositionSelected={handleStartPositionSelected}
        onStepDelete={handleStepDelete}
        {onAssemblerBack}
        selectedStepNumber={localSelectedStepNumber}
        practiceStepNumber={animatingStepNumber ?? practiceStepIndex}
        {isSideBySideLayout}
        {shouldOrbitAroundCenter}
        activeMode={createModuleState?.activeSection ?? null}
        {currentDisplayWord}
        {letterSources}
      />
    </div>

    <!-- Toast for validation errors -->
    <Toast
      message={toastMessage ?? ""}
      onDismiss={() => (toastMessage = null)}
    />
  </div>
{:else}
  <div class="workspace-panel loading" data-testid="workspace-panel">
    <div class="loading-message">Initializing workspace...</div>
  </div>
{/if}

<style>
  .workspace-panel {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column; /* Always stack sequence display above buttons */
    /* Transparent background to show beautiful background without blur */
    background: transparent;
    border: none;
    border-radius: var(--border-radius);
    overflow: hidden;
    border-radius: 12px;
  }

  .sequence-display-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .workspace-panel.loading {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loading-message {
    color: #666;
    font-size: var(--font-size-sm);
  }
</style>
