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
  import DurationPreviewWorkspace from "./sequence-actions/DurationPreviewWorkspace.svelte";
  import { getCreateModuleContext } from "../context/create-module-context";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { getChangedTransitionPlaybackWindow } from "$lib/shared/create/domain/changed-transition-playback";
  import {
    logConstructContextPreviewCompleted,
    logConstructContextPreviewReady,
  } from "../../construct/services/construct-analytics";

  // Get context
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

  // Duration preview mode - shows split workspace with animation and timeline
  const isDurationPreviewMode = $derived(panelState.isDurationPreviewMode);
  const previewSequence = $derived(panelState.previewSequence);
  const changedTransitionPlayback = $derived(
    panelState.changedTransitionPlayback
  );
  const changedTransitionWindow = $derived.by(() => {
    if (!changedTransitionPlayback) return null;
    return getChangedTransitionPlaybackWindow(
      changedTransitionPlayback.sequence,
      changedTransitionPlayback.stepNumber
    );
  });

  $effect(() => {
    if (
      navigationState.activeTab !== "construct" &&
      panelState.changedTransitionPlayback
    ) {
      panelState.exitChangedTransitionPlayback();
    }
  });

  function handleChangedPreviewReady(latencyMs: number, autoplay: boolean) {
    const playback = changedTransitionPlayback;
    if (!playback) return;

    logConstructContextPreviewReady({
      stepNumber: playback.stepNumber,
      latencyMs,
      autoplay,
    });
  }

  function handleChangedPreviewComplete() {
    const playback = changedTransitionPlayback;
    if (!playback) return;

    logConstructContextPreviewCompleted({
      stepNumber: playback.stepNumber,
    });
  }

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
    const playback = changedTransitionPlayback;
    if (
      playback &&
      activeSequenceState.currentSequenceRevision !==
        playback.sourceSequenceRevision
    ) {
      panelState.exitChangedTransitionPlayback();
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
  {#if isDurationPreviewMode && previewSequence}
    <!-- Duration Preview Mode: Split workspace with animation preview and timeline -->
    <DurationPreviewWorkspace sequence={previewSequence} />
  {:else if changedTransitionPlayback && changedTransitionWindow}
    {#key changedTransitionPlayback.requestId}
      <DurationPreviewWorkspace
        sequence={changedTransitionPlayback.sequence}
        variant="changed-transition"
        startStep={changedTransitionWindow.startStep}
        endStepExclusive={changedTransitionWindow.endStepExclusive}
        changedStep={changedTransitionWindow.changedStep}
        activatedAt={changedTransitionPlayback.activatedAt}
        onPreviewReady={handleChangedPreviewReady}
        onPlaybackComplete={handleChangedPreviewComplete}
      />
    {/key}
  {:else}
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
  {/if}
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
