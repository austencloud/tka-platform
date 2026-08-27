<script lang="ts">
  /**
   * Creation Workspace Area
   *
   * Wrapper for the actual workspace panel when a creation method has been selected.
   * Provides fade transitions and dynamic padding for the button panel at the bottom.
   * The padding is measured from the actual ButtonPanel height to adapt to different
   * screen sizes and responsive layouts.
   *
   * Extracted from CreateModule to reduce component size.
   *
   * Domain: Create module - Workspace presentation
   */

  import { fade } from "svelte/transition";
  import type { IToolPanelMethods } from "../types/create-module-types";
  import type { LetterSource } from "$lib/shared/create/domain/spell-models";
  import WorkspacePanel from "../workspace-panel/core/WorkspacePanel.svelte";
  import { getCreateModuleContext } from "../context/create-module-context";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";

  const ctx = getCreateModuleContext();
  const { CreateModuleState, panelState, layout } = ctx;

  // Props (only presentation-specific props)
  let {
    animatingStepNumber = null,
    animationStateRef,
    currentDisplayWord,
    buttonPanelHeight = 0,
    letterSources = null,
  }: {
    animatingStepNumber?: number | null;
    animationStateRef?: ReturnType<IToolPanelMethods["getAnimationStateRef"]>;
    currentDisplayWord: string;
    buttonPanelHeight?: number;
    /** Letter sources for spell tab - enables original vs bridge letter styling */
    letterSources?: LetterSource[] | null;
  } = $props();

  // Derive values from context
  const practiceStepIndex = $derived(panelState.practiceStepIndex);
  const shouldOrbitAroundCenter = $derived(panelState.shouldOrbitAroundCenter);
  const isSideBySideLayout = $derived(layout.shouldUseSideBySideLayout);
  const isMobilePortrait = $derived(layout.isMobilePortrait());

  const optionAudition = $derived(panelState.optionAudition);

  $effect(() => {
    if (
      navigationState.activeTab !== "construct" &&
      panelState.optionAudition
    ) {
      panelState.exitOptionAudition();
    }
  });

  // CRITICAL: Derive the active tab's sequence state reactively
  // Track both the active tab AND the sequence within that tab
  // This ensures the workspace updates when:
  // 1. The user switches tabs
  // 2. Sequence actions modify the state (mirror, rotate, etc.)
  const activeSequenceState = $derived.by(() => {
    // Track the active tab so we re-evaluate when it changes
    const activeTab = navigationState.activeTab;

    // Get the sequence state for the active tab
    const state = CreateModuleState.getActiveTabSequenceState();

    // Also track the currentSequence so we re-evaluate when it changes
    // This is the key fix - we need to access the reactive property
    const _sequence = state.currentSequence;

    return state;
  });

  $effect(() => {
    const audition = optionAudition;
    if (
      audition &&
      activeSequenceState.currentSequenceRevision !==
        audition.sourceSequenceRevision
    ) {
      panelState.exitOptionAudition();
    }
  });
</script>

<!-- Layout 2: Actual workspace when method is selected -->
<div
  class="workspace-panel-wrapper"
  style:padding-bottom="{buttonPanelHeight}px"
  in:fade={{ duration: 400, delay: 200 }}
  out:fade={{ duration: 300 }}
>
  <!-- Duration pattern preview renders inside the editable workspace timeline
       (SequenceDisplay swaps in panelState.previewSequence) — there is no
       separate preview workspace. -->
  <!-- CRITICAL: {#key} block ensures fresh StepGrid instances per tab
       This prevents animation state pollution (step-grid-display-state.svelte)
       But we DON'T key the parent layout to avoid workspace visibility timing issues -->
  {#key navigationState.activeTab}
    <WorkspacePanel
      sequenceState={activeSequenceState}
      createModuleState={CreateModuleState}
      {panelState}
      {practiceStepIndex}
      {animatingStepNumber}
      {isSideBySideLayout}
      {shouldOrbitAroundCenter}
      {animationStateRef}
      {currentDisplayWord}
      {letterSources}
    />
  {/key}
</div>

<style>
  /* Workspace panel wrapper (Layout 2) */
  .workspace-panel-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* padding-bottom is set dynamically via style attribute based on ButtonPanel height */
  }
</style>
