<script lang="ts">
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  /**
   * Creation Tool Panel Slot
   *
   * Renders the appropriate tool panel based on the active tab.
   * Each creation mode (Constructor, Generator, Assemble) has its own dedicated panel.
   *
   * Domain: Create module - Tool panel presentation
   */

  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { IToolPanelMethods } from "../types/create-module-types";
  import { getCreateModuleContext } from "../context/create-module-context";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import ConstructTabContent from "./ConstructTabContent.svelte";
  // GeneratePanel (136-file subtree), AssembleToolPanel (21), and FuseTab (235!)
  // are deferred via LazyMount — only the active build-mode tab's chunk loads.
  // Construct is the default tab so ConstructTabContent stays eager. This keeps
  // ~400 files out of the Create module's first-paint graph (see scripts/trace-create-three.cjs).
  import { desktopSidebarState } from "$lib/shared/layout/desktop-sidebar-state.svelte";
  import {
    logConstructStartPoseCompleted,
    type StartPosePath,
  } from "../../construct/services/construct-analytics";
  import { getStartPositionDisplayLabel } from "../../construct/start-position-picker/services/start-position-display-label";

  // Get context
  const ctx = getCreateModuleContext();
  const {
    CreateModuleState: createModuleState,
    constructTabState,
    constructTutorialState,
    panelState,
    layout,
  } = ctx;


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

  const activeSequenceState = $derived.by(() => {
    const state = createModuleState.getActiveTabSequenceState();
    void state.selectedStepNumber;
    return state;
  });

  const isStartPositionSelected = $derived(
    activeSequenceState.selectedStepNumber === 0
  );

  // Properly handle null state - don't convert to false, let it stay null for loading detection
  const shouldShowStartPositionPicker = $derived.by(() => {
    if (!isPersistenceFullyInitialized) return null;
    if (!constructTabState?.isInitialized) return null;

    const pickerState = constructTabState.shouldShowStartPositionPicker();
    // Return null if state is not yet determined (still initializing)
    if (pickerState === null) return null;

    return pickerState || isStartPositionSelected;
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
    const seq = activeSequenceState.currentSequence;
    // Use sequence's grid mode if available (updated by rotations)
    if (seq?.gridMode) return seq.gridMode;
    // Fallback to start position picker's grid mode (for initial selection)
    return (
      constructTabState?.startPositionStateService?.currentGridMode ??
      GridMode.DIAMOND
    );
  });
  const currentStartPosition = $derived(
    activeSequenceState.currentSequence?.startingPosition ??
      activeSequenceState.currentSequence?.startPosition ??
      null
  );
  const isEditingExistingStart = $derived(
    isStartPositionSelected &&
      activeSequenceState.currentSequence !== null
  );

  // Transition state for undo animations
  let isUndoingOption = $state(false);

  let pendingStartPose = $state<{
    path: StartPosePath;
    previousPosition: PictographData | null;
  } | null>(null);

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

  function handleStartPositionSubmitted(
    _position: PictographData,
    path: StartPosePath
  ) {
    pendingStartPose = {
      path,
      previousPosition: currentStartPosition,
    };
  }

  $effect(() => {
    const pending = pendingStartPose;
    const committedPosition = currentStartPosition;
    if (!pending || !committedPosition) return;
    if (committedPosition === pending.previousPosition) return;

    logConstructStartPoseCompleted({
      path: pending.path,
      gridMode: sequenceGridMode,
    });

    const label = getStartPositionDisplayLabel(committedPosition);
    if (label) {
      constructTutorialState.recordStartPose(label);
    }
    pendingStartPose = null;
  });

</script>

<div class="tool-panel-wrapper">
  {#if !isPersistenceFullyInitialized}
    <!-- Loading state while persistence is being restored -->
    <div class="persistence-loading">
      <ProgressRing percent={-1} size={32} strokeWidth={3} />
      <p>Restoring sequence...</p>
    </div>
  {:else if activeToolPanel}
    <!-- Render the appropriate tool panel based on active tab -->
    <div class="creation-tool-content" data-active-tab={activeToolPanel}>
      {#key activeToolPanel}
        <div class="sub-tab-content" data-tab={activeToolPanel}>
          {#if activeToolPanel === "construct"}
            <!-- Constructor Mode - Manual builder (step by step) -->
            {#if isPickerStateLoading}
              <div class="picker-loading">
                <ProgressRing percent={-1} size={32} strokeWidth={3} />
                <p>Loading options...</p>
              </div>
            {:else}
              <ConstructTabContent
                shouldShowStartPositionPicker={shouldShowStartPositionPicker ===
                  true}
                startPositionState={constructTabState.startPositionStateService}
                currentSequence={currentSequenceData}
                currentGridMode={sequenceGridMode}
                initialStartPosition={currentStartPosition}
                lockStartGridMode={isEditingExistingStart}
                startPositionValidationMessage={constructTabState.error}
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
                onStartPositionSubmitted={handleStartPositionSubmitted}
              />
            {/if}
          {:else if activeToolPanel === "generate"}
            <!-- Generator Mode - Automatic sequence generation (deferred chunk) -->
            <LazyMount
              loader={() => import("../../generate/components/GeneratePanel.svelte")}
              active
              props={{
                sequenceState: createModuleState.getActiveTabSequenceState(),
                isDesktop: showDesktopSidebar,
              }}
            />
          {:else if activeToolPanel === "assemble"}
            <!-- Assemble Mode - Click grid points to build sequences (deferred chunk) -->
            {@const assembleTabState = createModuleState.assembleTabState}
            {#if assembleTabState}
              <LazyMount
                loader={() => import("../../assemble/components/AssembleToolPanel.svelte")}
                active
                props={{ tabState: assembleTabState }}
              />
            {:else}
              <div class="coming-soon-panel">
                <p>Assemble loading...</p>
              </div>
            {/if}
          {:else if activeToolPanel === "fuse"}
            <!-- Fuse Mode - Combine two sequences into one (deferred chunk) -->
            <LazyMount loader={() => import("$lib/features/fuse/FuseTab.svelte")} active />
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

    /* Container for child components to query available space */
    /* Use 'size' (not 'inline-size') to enable height queries */
    container-type: size;
    container-name: tool-panel;

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

  .coming-soon-panel p,
  .no-tab-selected p {
    font-size: var(--font-size-sm);
    margin: 0;
  }

</style>
