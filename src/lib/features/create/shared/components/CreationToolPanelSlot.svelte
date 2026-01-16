<script lang="ts">
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  /**
   * Creation Tool Panel Slot
   *
   * Renders the appropriate tool panel based on the active tab.
   * Each creation mode (Constructor, Generator, Assembler) has its own dedicated panel.
   *
   * Domain: Create module - Tool panel presentation
   */

  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { createStepData } from "../domain/factories/createStepData";
  import { createStartPositionData } from "../domain/factories/createStartPositionData";
  import type { IToolPanelMethods } from "../types/create-module-types";
  import { getCreateModuleContext } from "../context/create-module-context";
  import GeneratePanel from "../../generate/components/GeneratePanel.svelte";
  import ConstructTabContent from "./ConstructTabContent.svelte";
  import AssemblerTab from "../../assemble/components/AssemblerTab.svelte";
  import type {
    AssemblyUndoRef,
    AssemblyBackRef,
  } from "../../assemble/components/HandPathOrchestrator.svelte";
  import SpellPanel from "../../spell/components/SpellPanel.svelte";
  import { desktopSidebarState } from "$lib/shared/layout/desktop-sidebar-state.svelte";

  // Get context
  const ctx = getCreateModuleContext();
  const {
    CreateModuleState: createModuleState,
    constructTabState,
    panelState,
    layout,
  } = ctx;

  // Access assemblyTabKey reactively via getter (don't destructure - loses reactivity)
  const assemblyTabKey = $derived(ctx.assemblyTabKey);

  // Derive values from context
  const isSideBySideLayout = () => layout.shouldUseSideBySideLayout;
  const isFilterPanelOpen = $derived(panelState.isFilterPanelOpen);
  const showDesktopSidebar = $derived(desktopSidebarState.isVisible);

  // Derived state for which panel to show
  // Read directly from navigationState for proper reactivity
  const activeToolPanel = $derived(navigationState.activeTab);

  // Loading states
  const isPersistenceFullyInitialized = $derived(
    createModuleState.isPersistenceInitialized &&
      constructTabState?.isPersistenceInitialized !== false
  );

  // Properly handle null state - don't convert to false, let it stay null for loading detection
  const shouldShowStartPositionPicker = $derived.by(() => {
    if (!isPersistenceFullyInitialized) return null;
    if (!constructTabState?.isInitialized) return null;

    const pickerState = constructTabState.shouldShowStartPositionPicker();
    // Return null if state is not yet determined (still initializing)
    if (pickerState === null) return null;

    return pickerState;
  });

  // Loading when either persistence isn't ready OR picker state is null (still determining)
  const isPickerStateLoading = $derived(
    !constructTabState?.isPersistenceInitialized ||
      shouldShowStartPositionPicker === null
  );

  // Convert SequenceData to PictographData[] for OptionViewer
  // Include startingPosition as the first element if it exists
  // IMPORTANT: Use getActiveTabSequenceState() to get tab-specific data
  const currentSequenceData = $derived.by(() => {
    const activeSequenceState = createModuleState.getActiveTabSequenceState();
    const seq = activeSequenceState.currentSequence;
    if (!seq) return [];

    const startStep = seq.startingPosition || seq.startPosition;
    if (!startStep) return [...seq.steps];

    // Include start position beat as first element, followed by regular steps
    return [startStep, ...seq.steps];
  });

  // Get grid mode from the sequence (source of truth after transforms)
  // Falls back to startPositionState when no sequence exists yet
  const sequenceGridMode = $derived.by(() => {
    const activeSequenceState = createModuleState.getActiveTabSequenceState();
    const seq = activeSequenceState.currentSequence;
    // Use sequence's grid mode if available (updated by rotations)
    if (seq?.gridMode) return seq.gridMode;
    // Fallback to start position picker's grid mode (for initial selection)
    return (
      constructTabState?.startPositionStateService?.currentGridMode ??
      GridMode.DIAMOND
    );
  });

  // Transition state for undo animations
  let isUndoingOption = $state(false);

  // Assembly undo ref - synced to CreateModuleState for workspace-level undo
  let assemblyUndoRef: AssemblyUndoRef | null = $state(null);

  // Assembly back ref - synced to CreateModuleState for workspace back button
  let assemblyBackRef: AssemblyBackRef | null = $state(null);

  // Sync assembly undo ref to CreateModuleState when it changes
  $effect(() => {
    createModuleState.assemblyUndoRef = assemblyUndoRef;
  });

  // Sync assembly back ref to CreateModuleState when it changes
  $effect(() => {
    createModuleState.assemblyBackRef = assemblyBackRef;
  });

  // Reset assembly refs when assembly tab remounts (via key change)
  $effect(() => {
    // Track key changes to clear stale refs
    void assemblyTabKey;
    assemblyUndoRef = null;
    assemblyBackRef = null;
  });

  // Props (only callbacks and bindable refs)
  let {
    toolPanelRef = $bindable(),
    onOptionSelected,
    onPracticeStepIndexChange,
    onOpenFilters,
    onCloseFilters,
  }: {
    toolPanelRef?: IToolPanelMethods | null;
    onOptionSelected: (option: PictographData) => Promise<void>;
    onPracticeStepIndexChange: (index: number | null) => void;
    onOpenFilters: () => void;
    onCloseFilters: () => void;
  } = $props();
</script>

<div class="tool-panel-wrapper">
  {#if !isPersistenceFullyInitialized}
    <!-- Loading state while persistence is being restored -->
    <div class="persistence-loading">
      <div class="loading-spinner"></div>
      <p>Loading...</p>
    </div>
  {:else if activeToolPanel}
    <!-- Render the appropriate tool panel based on active tab -->
    <div class="creation-tool-content">
      {#key `${activeToolPanel}-${assemblyTabKey}`}
        <div class="sub-tab-content">
          {#if activeToolPanel === "assembler"}
            <!-- Assembler Mode - Simplified tap-based hand path builder -->
            {@const assemblerTabState = createModuleState.assemblerTabState}
            {@const assemblerSeq =
              assemblerTabState?.sequenceState?.currentSequence}
            {@const existingStartBeat =
              assemblerSeq?.startingPosition ||
              assemblerSeq?.startPosition ||
              null}
            {@const existingBeatsArray = [...(assemblerSeq?.steps || [])]}
            {@const hasExistingAssemblerData = !!(
              existingStartBeat || existingBeatsArray.length > 0
            )}
            <AssemblerTab
              initialGridMode={assemblerTabState?.sequenceState?.gridMode}
              hasExistingSequence={hasExistingAssemblerData}
              existingStartPositionStep={existingStartBeat}
              existingSteps={existingBeatsArray}
              bind:undoRef={assemblyUndoRef}
              bind:backRef={assemblyBackRef}
              onClearSequence={() => {
                // Fully clear the assembler's sequence (steps + start position)
                const assemblerSequenceState =
                  createModuleState.assemblerTabState?.sequenceState;
                if (assemblerSequenceState) {
                  assemblerSequenceState.setCurrentSequence(null);
                }
              }}
              onStartPositionSet={(startPosition) => {
                // IMPORTANT: Use assemblerTabState.sequenceState directly, NOT getActiveTabSequenceState()
                // getActiveTabSequenceState() returns state based on navigationState.activeTab at call time,
                // which could be wrong if the user switches tabs before this callback completes.
                const assemblerSequenceState =
                  createModuleState.assemblerTabState?.sequenceState;
                if (!assemblerSequenceState) {
                  console.warn(
                    "[CreationToolPanelSlot] Assembler tab state not initialized"
                  );
                  return;
                }

                // Ensure a sequence exists
                let currentSeq = assemblerSequenceState.currentSequence;
                if (!currentSeq) {
                  const gridMode = assemblerSequenceState.gridMode;
                  currentSeq = {
                    id: crypto.randomUUID(),
                    name: "Hand Path Sequence",
                    word: "",
                    steps: [],
                    gridMode,
                    thumbnails: [],
                    isFavorite: false,
                    isCircular: false,
                    metadata: {},
                    tags: [],
                    startingPosition: createStartPositionData({
                      ...startPosition,
                    }),
                  };
                  assemblerSequenceState.setCurrentSequence(currentSeq);
                } else {
                  // Update existing sequence with start position
                  assemblerSequenceState.updateSequence({
                    ...currentSeq,
                    startingPosition: createStartPositionData({
                      ...startPosition,
                    }),
                  });
                }
              }}
              onSequenceUpdate={(pictographs) => {
                // IMPORTANT: Use assemblerTabState.sequenceState directly, NOT getActiveTabSequenceState()
                // This ensures we always update the assembler's state, not whatever tab is currently active.
                const assemblerSequenceState =
                  createModuleState.assemblerTabState?.sequenceState;
                if (!assemblerSequenceState) {
                  console.warn(
                    "[CreationToolPanelSlot] Assembler tab state not initialized"
                  );
                  return;
                }

                // Ensure a sequence exists
                let currentSeq = assemblerSequenceState.currentSequence;
                if (!currentSeq) {
                  const gridMode = assemblerSequenceState.gridMode;
                  currentSeq = {
                    id: crypto.randomUUID(),
                    name: "Hand Path Sequence",
                    word: "",
                    steps: [],
                    gridMode,
                    thumbnails: [],
                    isFavorite: false,
                    isCircular: false,
                    metadata: {},
                    tags: [],
                  };
                  assemblerSequenceState.setCurrentSequence(currentSeq);
                }

                const steps = pictographs.map((p, i) =>
                  createStepData({ ...p, stepNumber: i + 1, duration: 1 })
                );
                assemblerSequenceState.updateSequence({
                  ...currentSeq,
                  steps,
                });
              }}
              onSequenceComplete={(pictographs) => {
                // IMPORTANT: Use assemblerTabState.sequenceState directly, NOT getActiveTabSequenceState()
                // This ensures we always update the assembler's state, not whatever tab is currently active.
                const assemblerSequenceState =
                  createModuleState.assemblerTabState?.sequenceState;
                if (!assemblerSequenceState) {
                  console.warn(
                    "[CreationToolPanelSlot] Assembler tab state not initialized"
                  );
                  return;
                }
                const currentSeq = assemblerSequenceState.currentSequence;

                if (!currentSeq) {
                  console.warn(
                    "[CreationToolPanelSlot] No sequence exists - cannot complete"
                  );
                  return;
                }

                const steps = pictographs.map((p, i) =>
                  createStepData({ ...p, stepNumber: i + 1, duration: 1 })
                );
                assemblerSequenceState.updateSequence({
                  ...currentSeq,
                  steps,
                });
              }}
              onHeaderTextChange={(text) => {
                createModuleState.setGuidedModeHeaderText(text);
              }}
            />
          {:else if activeToolPanel === "constructor"}
            <!-- Constructor Mode - Manual builder (step by step) -->
            {#if isPickerStateLoading}
              <div class="picker-loading">
                <div class="loading-spinner"></div>
                <p>Loading...</p>
              </div>
            {:else}
              <ConstructTabContent
                shouldShowStartPositionPicker={shouldShowStartPositionPicker ===
                  true}
                startPositionState={constructTabState.startPositionStateService}
                currentSequence={currentSequenceData}
                currentGridMode={sequenceGridMode}
                {onOptionSelected}
                {isUndoingOption}
                onStartPositionNavigateToAdvanced={() => {}}
                onStartPositionNavigateToDefault={() => {}}
                {isSideBySideLayout}
                {onOpenFilters}
                {onCloseFilters}
                {isFilterPanelOpen}
                isContinuousOnly={constructTabState.isContinuousOnly}
                onToggleContinuous={(value) =>
                  constructTabState.setContinuousOnly(value)}
              />
            {/if}
          {:else if activeToolPanel === "generator"}
            <!-- Generator Mode - Automatic sequence generation -->
            <GeneratePanel
              sequenceState={createModuleState.getActiveTabSequenceState()}
              isDesktop={showDesktopSidebar}
            />
          {:else if activeToolPanel === "spell"}
            <!-- Spell Mode - Word to sequence generator -->
            {@const spellTabState = createModuleState.spellTabState}
            {#if spellTabState}
              <SpellPanel
                spellState={spellTabState}
                sequenceState={spellTabState.sequenceState}
                isDesktop={showDesktopSidebar}
              />
            {:else}
              <div class="coming-soon-panel">
                <p>Spell tab loading...</p>
              </div>
            {/if}
          {/if}
        </div>
      {/key}
    </div>
  {:else}
    <!-- Fallback case -->
    <div class="no-tab-selected">
      <p>No tab selected</p>
    </div>
  {/if}
</div>

<style>
  .tool-panel-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    position: relative;
  }

  .creation-tool-content {
    flex: 1;
    min-height: 0;
    position: relative;
    overflow: hidden;
  }

  .sub-tab-content {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* Loading states */
  .persistence-loading,
  .picker-loading,
  .coming-soon-panel,
  .no-tab-selected {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    gap: 16px;
    color: var(--theme-text-dim);
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--theme-stroke);
    border-top-color: var(--theme-text-dim);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .coming-soon-panel p,
  .no-tab-selected p {
    font-size: var(--font-size-sm);
    margin: 0;
  }
</style>
