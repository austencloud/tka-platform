<script lang="ts">
  /**
   * StandardWorkspaceLayout - Workspace and Tool Panel Layout Container
   *
   * Uses CSS Grid for smooth, animatable layout transitions.
   * Workspace is always in DOM but collapses when empty.
   *
   * Domain: Create module - Layout
   */


  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import ButtonPanel from "../workspace-panel/shared/components/ButtonPanel.svelte";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  // CreationWorkspaceArea (85-file subtree) only renders once a sequence exists,
  // so its chunk is deferred via LazyMount — empty/first-paint Create loads skip it.
  import CreationToolPanelSlot from "./CreationToolPanelSlot.svelte";
  import type { createCreateModuleState as CreateModuleStateType } from "../state/create-module-state.svelte";
  import type { PanelCoordinationState } from "../state/panel-coordination-state.svelte";
  import type { IToolPanelMethods } from "../types/create-module-types";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import type { LetterSource } from "$lib/shared/create/domain/spell-models";

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
    onViewSequence = undefined,
    onSequenceActionsClick,
    onSaveToLibrary = undefined,
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
    onViewSequence?: () => void;
    onSequenceActionsClick: () => void;
    onSaveToLibrary?: () => void;
    onOptionSelected: (option: PictographData) => Promise<void>;
    onOpenFilters: () => void;
    onCloseFilters: () => void;
  } = $props();

  // ============================================================================
  // LOCAL STATE
  // ============================================================================
  let workspaceContainerRef: HTMLElement | null = $state(null);
  let layoutWrapperRef: HTMLElement | null = $state(null);
  let buttonPanelHeight = $state(0);

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

  const isGeneratorTab = $derived(navigationState.activeTab === "generate");

  // Assemble tab: collapse tool panel when sequence is complete
  const isAssembleComplete = $derived(
    navigationState.activeTab === "assemble" &&
    CreateModuleState.assembleTabState?.assembleBuilderState?.phase === "complete"
  );

  // Fuse tab: hides workspace entirely (Fuse owns its own full-width layout)
  const isFuseTab = $derived(navigationState.activeTab === "fuse");

  // Workspace visible only when there's actual content to show
  const shouldShowWorkspace = $derived(!isInputMode && !isFuseTab && hasWorkspaceContent);

  // Color border based on active CREATE tab (for visual workspace distinction)
  const workspaceBorderColor = $derived.by(() => {
    const activeTab = navigationState.activeTab;

    // Map each creation mode to its color (20% opacity for subtle border)
    switch (activeTab) {
      case "construct":
        return "rgba(59, 130, 246, 0.2)"; // Blue
      case "assemble":
        return "rgba(6, 182, 212, 0.2)"; // Cyan
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

</script>

<div
  bind:this={layoutWrapperRef}
  class="layout-wrapper"
  class:side-by-side={shouldUseSideBySideLayout}
  class:workspace-visible={shouldShowWorkspace}
  class:tool-panel-collapsed={isAssembleComplete}
  class:generator-active={isGeneratorTab}
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
        <LazyMount
          loader={() => import("./CreationWorkspaceArea.svelte")}
          active
          props={{
            animatingStepNumber,
            currentDisplayWord,
            buttonPanelHeight,
            letterSources: currentLetterSources,
            ...(toolPanelRef?.getAnimationStateRef?.()
              ? { animationStateRef: toolPanelRef.getAnimationStateRef() }
              : {}),
          }}
        />
      {/if}
    </div>

    <!-- Button Panel - Shows when workspace is visible -->
    {#if shouldShowWorkspace}
      <div class="button-panel-wrapper" bind:this={buttonPanelElement}>
        <ButtonPanel
          {onClearSequence}
          {onViewSequence}
          {onSequenceActionsClick}
          {onSaveToLibrary}
        />
      </div>
    {/if}

    <!-- Build Another overlay - shown when assemble sequence is complete.
         Positioned above the ButtonPanel using its measured height. -->
    {#if isAssembleComplete}
      <div class="build-another-overlay" style:bottom="{buttonPanelHeight + 16}px">
        <button class="build-another-btn" onclick={onClearSequence}>
          <i class="fas fa-plus" aria-hidden="true"></i>
          <span>Build Another</span>
        </button>
      </div>
    {/if}
  </div>

  <!-- Tool Panel -->
  <div class="tool-panel-container" bind:this={toolPanelElement}>
    {#if !hasWorkspaceContent && isGeneratorTab}
      <p class="workspace-hint">Tap Generate to create your sequence</p>
    {/if}
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

  /* Assemble complete: collapse tool panel, workspace takes full height */
  .layout-wrapper.workspace-visible.tool-panel-collapsed:not(.side-by-side) {
    grid-template-rows: 1fr 0fr;
  }

  .layout-wrapper.side-by-side.workspace-visible.tool-panel-collapsed {
    grid-template-columns: 1fr 0fr;
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
    container-type: size;
    container-name: tool-panel;
  }

  /* Short viewports on Generate tab: give the tool panel a bit more room
     so the card grid fits comfortably. Default 5fr:4fr (~55:44) becomes
     1fr:1fr (50:50) on short screens so cards aren't squeezed. */
  @media (max-height: 850px) {
    .layout-wrapper.workspace-visible.generator-active:not(.side-by-side) {
      grid-template-rows: 5fr 4fr;
    }
  }


  /* Build Another overlay - appears over workspace when assemble is complete */
  .build-another-overlay {
    position: absolute;
    /* bottom is set dynamically via inline style based on buttonPanelHeight */
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    z-index: 20;
    pointer-events: none;
  }

  .build-another-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 14px;
    border: 1.5px solid var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, var(--theme-panel-bg, rgba(18, 18, 28, 0.98)));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    pointer-events: auto;
    min-height: var(--min-touch-target, 44px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    transition: background 0.15s ease;
  }

  .build-another-btn:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 30%, var(--theme-panel-bg, rgba(18, 18, 28, 0.98)));
  }

  .build-another-btn:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: 3px;
  }

  .build-another-btn i {
    font-size: 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .build-another-btn {
      transition: none;
    }
  }

  .workspace-hint {
    flex-shrink: 0;
    text-align: center;
    /* push down off the top edge into the empty space above the cards */
    margin: clamp(2.5rem, 11vmin, 6.5rem) 0 0;
    padding: 0 1rem;
    font-family: "Playfair Display", Georgia, serif;
    /* cqi tracks the tool-panel container width (container-type: size below), so
       the hint scales to fit on ONE line at any width; nowrap forbids the wrap.
       Coefficient chosen so the line still fits when the 2rem cap kicks in. */
    font-size: clamp(1rem, 4.6cqi, 2rem);
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
    color: var(--theme-text, #fff);
    /* single soft shadow so it stays legible over the busy background */
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
  }
</style>
