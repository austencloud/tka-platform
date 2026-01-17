<!--
  EditModule.svelte - Sequence Editing Module

  A dedicated workspace for refining and transforming sequences.

  Modes:
  - Beat: Edit individual pictographs (turns, rotation, motion type)
  - Sequence: Apply transformations to entire sequences (mirror, rotate, swap, reverse)

  Sequences can arrive here from:
  - Create module (editing a sequence being built)
  - Discover module (editing a sequence from gallery)
  - Deep link (editing a shared sequence)
-->
<script lang="ts">
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { container } from "$lib/shared/di";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import { onMount } from "svelte";
  import {
    createEditModuleState,
    type EditMode,
  } from "./state/edit-module-state.svelte";
  import type { ISequenceTransformer } from "../create/shared/services/contracts/ISequenceTransformer";
  import type { IDiscoverLoader } from "../discover/sequences/display/services/contracts/IDiscoverLoader";
  import type { IMotionQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
  import type { IGridModeDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridModeDeriver";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import StepEditPanel from "./components/StepEditPanel.svelte";
  import SequenceEditPanel from "./components/SequenceEditPanel.svelte";
  import EditWorkspace from "./components/EditWorkspace.svelte";
  import EmptyEditState from "./components/EmptyEditState.svelte";
  import SequenceBrowserPanel from "../../shared/animation-engine/components/SequenceBrowserPanel.svelte";

  // Create module state
  const editState = createEditModuleState();

  // Services
  let transformService: ISequenceTransformer | null = null;
  let exploreLoader: IDiscoverLoader | null = null;
  let motionQueryHandler: IMotionQueryHandler | null = null;
  let gridModeDeriver: IGridModeDeriver | null = null;

  // Sequence browser state
  let isSequenceBrowserOpen = $state(false);
  let isLoadingFullSequence = $state(false);

  function openSequenceBrowser() {
    isSequenceBrowserOpen = true;
  }

  function closeSequenceBrowser() {
    isSequenceBrowserOpen = false;
  }

  async function handleSequenceSelect(sequenceMetadata: SequenceData) {
    // The browser returns lightweight metadata without steps
    // We need to load the full sequence data
    if (!exploreLoader) {
      console.error("EditModule: DiscoverLoader not available");
      return;
    }

    isLoadingFullSequence = true;
    closeSequenceBrowser();

    try {
      const sequenceName = sequenceMetadata.name || sequenceMetadata.id;
      const fullSequence =
        await exploreLoader.loadFullSequenceData(sequenceName);

      if (fullSequence) {
        editState.loadSequence(fullSequence, { module: "browser" });
      } else {
        console.error(
          `EditModule: Could not load full sequence for "${sequenceName}"`
        );
      }
    } catch (error) {
      console.error("EditModule: Failed to load full sequence:", error);
    } finally {
      isLoadingFullSequence = false;
    }
  }

  // Initialize on mount
  onMount(() => {
    try {
      transformService = container.items.sequenceTransformer;
    } catch (error) {
      console.warn("Failed to resolve ISequenceTransformer:", error);
    }

    try {
      exploreLoader = container.items.discoverLoader;
    } catch (error) {
      console.warn("Failed to resolve IDiscoverLoader:", error);
    }

    try {
      motionQueryHandler = container.items.motionQueryHandler;
    } catch (error) {
      console.warn("Failed to resolve IMotionQueryHandler:", error);
    }

    try {
      gridModeDeriver = container.items.gridModeDeriver;
    } catch (error) {
      console.warn("Failed to resolve IGridModeDeriver:", error);
    }

    // Set the default tab for the edit module
    navigationState.setActiveTab("edit");
  });

  /**
   * Handle beat updates with letter derivation
   * When motion properties change (rotation direction, turns, etc.), re-derive the letter
   */
  async function handleStepUpdate(
    stepIndex: number,
    updates: Partial<StepData>
  ) {
    const sequence = editState.editingSequence;
    if (!sequence) return;

    // Get the current beat data
    const currentStep = sequence.steps[stepIndex];
    if (!currentStep) return;

    // Merge updates to get the new beat state
    const updatedStep = { ...currentStep, ...updates };

    // Check if motions were updated - if so, derive the new letter
    if (updates.motions && motionQueryHandler && gridModeDeriver) {
      const blueMotion = updatedStep.motions?.[MotionColor.BLUE];
      const redMotion = updatedStep.motions?.[MotionColor.RED];

      if (blueMotion && redMotion) {
        try {
          // Derive grid mode from motions
          const gridMode = gridModeDeriver.deriveGridMode(
            blueMotion,
            redMotion
          );

          // Find the correct letter for this motion configuration
          const newLetter =
            await motionQueryHandler.findLetterByMotionConfiguration(
              blueMotion,
              redMotion,
              gridMode
            );

          if (newLetter && newLetter !== updatedStep.letter) {
            // Include the new letter in the updates (cast string to Letter enum)
            updates = { ...updates, letter: newLetter as Letter };
          }
        } catch (error) {
          console.warn(
            "EditModule: Failed to derive letter for beat update:",
            error
          );
        }
      }
    }

    // Update the beat with the (possibly augmented) updates
    editState.updateStep(stepIndex, updates);
  }

  /**
   * Transformation handlers that use the resolved service
   */
  async function handleMirror(): Promise<SequenceData | null> {
    const sequence = editState.editingSequence;
    if (!sequence || !transformService) return null;
    return await transformService.mirrorSequence(sequence);
  }

  async function handleRotate(direction: "cw" | "ccw"): Promise<SequenceData | null> {
    const sequence = editState.editingSequence;
    if (!sequence || !transformService) return null;
    // Rotate 45 degrees (one step)
    const amount = direction === "cw" ? 1 : -1;
    return await transformService.rotateSequence(sequence, amount);
  }

  function handleSwapColors(): SequenceData | null {
    const sequence = editState.editingSequence;
    if (!sequence || !transformService) return null;
    return transformService.swapColors(sequence);
  }

  async function handleRewind(): Promise<SequenceData | null> {
    const sequence = editState.editingSequence;
    if (!sequence || !transformService) return null;
    return await transformService.rewindSequence(sequence);
  }

  // Derived state
  const hasSequence = $derived(editState.hasSequence);
  const currentMode = $derived(editState.currentMode);
</script>

<div class="edit-module">
  {#if isLoadingFullSequence}
    <!-- Loading full sequence data -->
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading sequence...</p>
    </div>
  {:else if !hasSequence}
    <!-- No sequence loaded - show empty state -->
    <EmptyEditState
      onLoadSequence={(seq) => editState.loadSequence(seq)}
      onBrowseSequences={openSequenceBrowser}
    />
  {:else}
    <!-- Main editing interface -->
    <div class="edit-layout">
      <!-- Workspace: Shows the sequence being edited -->
      <div class="workspace-area">
        <EditWorkspace
          sequence={editState.editingSequence}
          selectedStepNumber={editState.selectedStepNumber}
          selectedStepNumbers={editState.selectedStepNumbers}
          onStepSelect={(stepNumber, stepData) =>
            editState.selectStep(stepNumber, stepData)}
          onBeatMultiSelect={(stepNumber) =>
            editState.toggleStepInMultiSelect(stepNumber)}
          onChangeSequence={openSequenceBrowser}
        />
      </div>

      <!-- Tool Panel: Edit controls based on mode -->
      <div class="tool-panel">
        <!-- Mode Toggle -->
        <div class="mode-toggle">
          <button
            class="mode-btn"
            class:active={currentMode === "beat"}
            onclick={() => editState.setCurrentMode("beat")}
            aria-label="Beat editing mode"
          >
            <i class="fas fa-pen" aria-hidden="true"></i>
            <span>Beat</span>
          </button>
          <button
            class="mode-btn"
            class:active={currentMode === "sequence"}
            onclick={() => editState.setCurrentMode("sequence")}
            aria-label="Sequence transformation mode"
          >
            <i class="fas fa-layer-group" aria-hidden="true"></i>
            <span>Sequence</span>
          </button>
        </div>

        <!-- Edit Controls -->
        <div class="edit-controls">
          {#if currentMode === "beat"}
            <StepEditPanel
              selectedStepNumber={editState.selectedStepNumber}
              selectedStepData={editState.selectedStepData}
              selectedStepNumbers={editState.selectedStepNumbers}
              sequence={editState.editingSequence}
              onStepUpdate={(index, updates) =>
                handleStepUpdate(index, updates)}
              onStartPositionUpdate={(updates) =>
                editState.updateStartPosition(updates)}
            />
          {:else if currentMode === "sequence"}
            <SequenceEditPanel
              sequence={editState.editingSequence}
              onTransform={(newSequence) =>
                editState.transformSequence(newSequence)}
              {handleMirror}
              {handleRotate}
              {handleSwapColors}
              {handleRewind}
            />
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Sequence Browser Drawer -->
  <SequenceBrowserPanel
    mode="primary"
    show={isSequenceBrowserOpen}
    onSelect={handleSequenceSelect}
    onClose={closeSequenceBrowser}
  />
</div>

<style>
  .edit-module {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: transparent;
  }

  .edit-layout {
    display: grid;
    grid-template-rows: 5fr 4fr;
    height: 100%;
    width: 100%;
    gap: 8px;
    padding: 8px;
    overflow: hidden;
  }

  /* Side-by-side on wider screens */
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) {
    .edit-layout {
      grid-template-rows: 1fr;
      grid-template-columns: 5fr 4fr;
    }
  }

  .workspace-area {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(6, 182, 212, 0.2);
  }

  .tool-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(6, 182, 212, 0.2);
  }

  .mode-toggle {
    display: flex;
    gap: 4px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .mode-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 6px;
    background: var(--theme-card-bg);
    border: 1px solid transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    font-size: 0.9rem;
  }

  .mode-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }

  .mode-btn.active {
    background: rgba(6, 182, 212, 0.15);
    border-color: rgba(6, 182, 212, 0.5);
    color: #06b6d4;
  }

  .mode-btn i {
    font-size: 0.85rem;
  }

  .edit-controls {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
    color: var(--theme-text-dim);
  }

  .loading-state p {
    margin: 0;
    font-size: 1rem;
  }

  .spinner {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 3px solid var(--theme-stroke);
    border-top-color: #06b6d4;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
