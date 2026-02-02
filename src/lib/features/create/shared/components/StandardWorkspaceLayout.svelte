<script lang="ts">
  /**
   * StandardWorkspaceLayout - Workspace and Tool Panel Layout Container
   *
   * Uses CSS Grid for smooth, animatable layout transitions.
   * Workspace is always in DOM but collapses when empty.
   *
   * Domain: Create module - Layout
   */


  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import ButtonPanel from "../workspace-panel/shared/components/ButtonPanel.svelte";
  import CreationWorkspaceArea from "./CreationWorkspaceArea.svelte";
  import CreationToolPanelSlot from "./CreationToolPanelSlot.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { createCreateModuleState as CreateModuleStateType } from "../state/create-module-state.svelte";
  import type { PanelCoordinationState } from "../state/panel-coordination-state.svelte";
  import type { IToolPanelMethods } from "../types/create-module-types";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import type { LetterSource } from "$lib/features/create/spell/domain/models/spell-models";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/implementations/SequenceViewerNavigator";
  import { getReturnContext } from "$lib/shared/coordinators/sequence-handoff.svelte";

  type CreateModuleState = ReturnType<typeof CreateModuleStateType>;

  // ============================================================================
  // PROPS
  // ============================================================================
  let {
    shouldUseSideBySideLayout,
    CreateModuleState,
    panelState,
    currentDisplayWord,
    currentLetterSources = null,
    isInputMode = false,
    // Bindable props
    animatingStepNumber = $bindable(null),
    toolPanelRef = $bindable(null),
    buttonPanelElement = $bindable(),
    toolPanelElement = $bindable(),
    // Event handlers
    onClearSequence,
    onShareHub = undefined,
    onSequenceActionsClick,
    onOptionSelected,
    onOpenFilters,
    onCloseFilters,
  }: {
    shouldUseSideBySideLayout: boolean;
    CreateModuleState: CreateModuleState;
    panelState: PanelCoordinationState;
    currentDisplayWord: string;
    /** Letter sources for spell tab - enables original vs bridge letter styling */
    currentLetterSources?: LetterSource[] | null;
    /** Input mode active - collapse workspace to maximize space for word input */
    isInputMode?: boolean;
    animatingStepNumber?: number | null;
    toolPanelRef?: IToolPanelMethods | null;
    buttonPanelElement?: HTMLElement | null;
    toolPanelElement?: HTMLElement | null;
    onClearSequence: () => void;
    onShareHub?: () => void;
    onSequenceActionsClick: () => void;
    onOptionSelected: (option: PictographData) => Promise<void>;
    onOpenFilters: () => void;
    onCloseFilters: () => void;
  } = $props();

  // ============================================================================
  // LOCAL STATE
  // ============================================================================
  let workspaceContainerRef: HTMLElement | null = $state(null);
  let buttonPanelHeight = $state(0);

  // Spotlight modal state (legacy - modal replaced with route navigation)
  let spotlightOpen = $state(false);
  let spotlightSequence = $state<SequenceData | null>(null);
  // Note: These are kept for backwards compatibility but modal is no longer rendered

  // ============================================================================
  // DERIVED STATE - Workspace Color Coding & Visibility
  // ============================================================================

  // Check if workspace has any content to display
  // Use the exposed getActiveTabSequenceState() method which handles tab-specific sequence states
  const hasWorkspaceContent = $derived.by(() => {
    // Use the proper API method that handles tab switching
    const sequence = CreateModuleState.sequenceState.currentSequence;

    if (!sequence) {
      return false;
    }

    const hasStep = sequence.steps && sequence.steps.length > 0;
    const hasStartPosition =
      sequence.startingPosition || sequence.startPosition;
    const result = hasStep || hasStartPosition;

    return result;
  });

  // Generator tab always shows workspace (for help button accessibility)
  const isGeneratorTab = $derived(navigationState.activeTab === "generate");

  // Workspace should be visible if:
  // - NOT in input mode (keyboard up on mobile)
  // - Generator tab (always visible with empty prompt)
  // - Other tabs only when there's content
  const shouldShowWorkspace = $derived(!isInputMode && (isGeneratorTab || hasWorkspaceContent));

  // Color border based on active CREATE tab (for visual workspace distinction)
  const workspaceBorderColor = $derived.by(() => {
    const activeTab = navigationState.activeTab;

    // Map each creation mode to its color (20% opacity for subtle border)
    switch (activeTab) {
      case "assemble":
        return "rgba(139, 92, 246, 0.2)"; // Purple
      case "construct":
        return "rgba(59, 130, 246, 0.2)"; // Blue
      case "generate":
        return "rgba(245, 158, 11, 0.2)"; // Gold
      default:
        return "rgba(255, 255, 255, 0.1)"; // Default
    }
  });

  // Measure button panel height dynamically
  $effect(() => {
    if (!buttonPanelElement) {
      buttonPanelHeight = 0;
      return;
    }

    const updateHeight = () => {
      buttonPanelHeight = buttonPanelElement?.offsetHeight ?? 0;
    };

    // Initial measurement
    updateHeight();

    // Use ResizeObserver to track size changes (responsive layouts, container queries)
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(buttonPanelElement);

    return () => resizeObserver.disconnect();
  });

  // Handler for spotlight button - opens fullscreen sequence viewer
  function handleSpotlight() {
    const sequence = CreateModuleState.sequenceState.currentSequence;
    if (sequence) {
      const { returnPath, returnLabel } = getReturnContext();
      openSequenceViewer(sequence, { returnPath, returnLabel });
    }
  }

  function handleSpotlightClose() {
    // Legacy - no longer used since modal is replaced with route
    spotlightOpen = false;
    spotlightSequence = null;
  }
</script>

<div
  class="layout-wrapper"
  class:side-by-side={shouldUseSideBySideLayout}
  class:workspace-visible={shouldShowWorkspace}
>
  <!-- Workspace Panel - Visible based on tab and content -->
  <div
    bind:this={workspaceContainerRef}
    class="workspace-container"
    class:workspace-collapsed={!shouldShowWorkspace}
    style:--workspace-border-color={workspaceBorderColor}
  >
    <!-- Workspace Content Area -->
    <div class="workspace-content">
      {#if hasWorkspaceContent}
        <CreationWorkspaceArea
          {animatingStepNumber}
          {currentDisplayWord}
          {buttonPanelHeight}
          letterSources={currentLetterSources}
          {...toolPanelRef?.getAnimationStateRef?.()
            ? { animationStateRef: toolPanelRef.getAnimationStateRef() }
            : {}}
        />
      {:else if isGeneratorTab}
        <p class="empty-prompt">Tap Generate to create your sequence</p>
      {/if}
    </div>

    <!-- Button Panel - Shows when workspace is visible -->
    {#if shouldShowWorkspace}
      <div class="button-panel-wrapper" bind:this={buttonPanelElement}>
        <ButtonPanel
          {onClearSequence}
          {onShareHub}
          {onSequenceActionsClick}
          onSpotlight={handleSpotlight}
        />
      </div>
    {/if}
  </div>

  <!-- Tool Panel -->
  <div class="tool-panel-container" bind:this={toolPanelElement}>
    <CreationToolPanelSlot
      bind:toolPanelRef
      {onOptionSelected}
      onPracticeStepIndexChange={(index) => {
        panelState.setPracticeStepIndex(index);
      }}
      {onOpenFilters}
      {onCloseFilters}
    />
  </div>
</div>

<!-- Spotlight Modal - Replaced with /sequence/[id] route navigation -->

<style>
  .layout-wrapper {
    /* CSS Grid for smooth, animatable layout */
    display: grid;
    grid-template-rows: 0fr 1fr;
    height: 100%;
    width: 100%;
    overflow: hidden;
    gap: 0;

    /* View Transitions API - use unique name to avoid duplicates */
    view-transition-name: create-workspace-layout;

    /* Single smooth transition for ALL layout changes */
    transition:
      grid-template-rows 450ms cubic-bezier(0.4, 0, 0.2, 1),
      grid-template-columns 450ms cubic-bezier(0.4, 0, 0.2, 1),
      gap 450ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* When workspace has content - expand to 5:4 ratio */
  .layout-wrapper.workspace-visible {
    grid-template-rows: 5fr 4fr;
  }

  /* Side-by-side layout - horizontal instead of vertical */
  .layout-wrapper.side-by-side {
    grid-template-rows: 1fr;
    grid-template-columns: 0fr 1fr;
  }

  .layout-wrapper.side-by-side.workspace-visible {
    grid-template-columns: 1fr 1fr;
  }

  /* Shared container styles */
  .workspace-container,
  .tool-panel-container {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
  }

  .workspace-container {
    position: relative;

    /* Colored border for visual workspace distinction */
    border: 1px solid var(--workspace-border-color, var(--theme-stroke));
    border-radius: 8px;

    /* Smooth opacity and border transitions */
    opacity: 1;
    transition:
      opacity 350ms cubic-bezier(0.4, 0, 0.2, 1),
      border-color 300ms ease;
  }

  /* Collapsed state - invisible but still in layout flow */
  .workspace-container.workspace-collapsed {
    opacity: 0;
    pointer-events: none;
    border-color: transparent;
  }

  .workspace-content {
    flex: 1;
    min-height: 0;
    position: relative;
    overflow: hidden;
  }

  .button-panel-wrapper {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    /* Must be above drawer content (z-index: 150) so buttons remain clickable
       when slide-in panels are open */
    z-index: 160;
    /* Allow taps to pass through empty areas to the step grid below */
    pointer-events: none;
  }

  .tool-panel-container {
    position: relative;
  }

  /* Simple prompt when workspace is empty */
  .empty-prompt {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 1rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
    text-align: center;
  }
</style>
