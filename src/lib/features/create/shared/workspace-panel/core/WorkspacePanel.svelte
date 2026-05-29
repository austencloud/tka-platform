<!--
	WorkspacePanel.svelte

	Workspace panel containing the sequence display and action buttons.
	Main area for viewing and interacting with the sequence.
-->
<script lang="ts">

import { getStepOperator } from "$lib/features/create/shared/get-step-operator";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { onMount } from "svelte";
  import Toast from "../components/Toast.svelte";
  import SequenceDisplay from "../sequence-display/components/SequenceDisplay.svelte";
  import type { StepOperator } from "$lib/features/create/shared/services/step-operator";
  import type { SequenceState } from "../../state/sequence-state-orchestrator.svelte";
  import type { CreateModuleState } from "../../state/create-module-state.svelte";
  import type { IAnimationStateRef } from "../../types/create-module-types";
  import type { PanelCoordinationState } from "../../state/panel-coordination-state.svelte";
  import type { LetterSource } from "$lib/shared/create/domain/spell-models";

  // Services
  let StepOperator: StepOperator | null = null;

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

  } = $props();

  // Derive selection directly from sequenceState when not animating
  // This avoids stale state issues from effect-based syncing
  const effectiveSelectedStepNumber = $derived.by(() => {
    // Animation takes precedence - show the animating step as selected
    if (animatingStepNumber !== null) {
      return animatingStepNumber;
    }
    // Otherwise use the sequence state's selection
    return sequenceState?.selectedStepNumber ?? null;
  });

  // Toast message for validation errors
  let toastMessage = $state<string | null>(null);

  // Handle beat selection (receives stepNumber: 1, 2, 3...)
  function handleBeatSelected(stepNumber: number) {
    if (!sequenceState) return;

    // Close any open viewer/animation panels - editing takes priority
    // Export panel handles stopping its own animation when closed
    panelState?.closeExportPanel();
    panelState?.closeAnimationPanel();
    animationStateRef?.stop();

    // Select the step (derived state will update automatically)
    sequenceState.selectStep(stepNumber);

    // Open the step editor panel directly
    // NOTE: We do this here rather than relying on an effect because
    // Svelte 5's $effect.root() doesn't properly track reactive state
    // accessed through multiple getter layers (CreateModuleState.sequenceState.selectedStepNumber)
    panelState?.openStepEditorPanel();
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
    // Export panel handles stopping its own animation when closed
    panelState?.closeExportPanel();
    panelState?.closeAnimationPanel();
    animationStateRef?.stop();

    // Select start position for editing (stepNumber 0)
    // Derived state will update automatically
    sequenceState.selectStartPositionForEditing();

    // Open the step editor panel directly (same fix as handleBeatSelected)
    panelState?.openStepEditorPanel();
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
        // For assemble tab, reset the builder state entirely
        if (navigationState.activeTab === "assemble") {
          const assembleTabState = createModuleState.assembleTabState;
          assembleTabState?.assembleBuilderState?.reset();
          return;
        }
        sequenceState?.setStartPosition(null);
        sequenceState?.clearSelection();
        // Close step editor panel since workspace is now empty
        panelState?.closeStepEditorPanel();
        return;
      }

      // For assemble tab, truncate builder steps instead of modifying sequence state
      // (the reactive bridge would overwrite any direct sequence state changes)
      if (navigationState.activeTab === "assemble") {
        const assembleTabState = createModuleState.assembleTabState;
        const stepIndex = stepNumber - 1;
        assembleTabState?.assembleBuilderState?.truncateAtStep(stepIndex);
        return;
      }

      if (!StepOperator) {
        console.warn("Cannot delete step - StepOperator not initialized");
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
    StepOperator = getStepOperator();
  });
</script>

{#if sequenceState}
  <div class="workspace-panel" data-testid="workspace-panel">
    <!-- Sequence Display -->
    <div class="sequence-display-container">
      <SequenceDisplay
        {sequenceState}
        onStepSelected={handleBeatSelected}
        onStartPositionSelected={handleStartPositionSelected}
        onStepDelete={handleStepDelete}
        selectedStepNumber={effectiveSelectedStepNumber}
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
