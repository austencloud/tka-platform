<!--
SpellResultsView.svelte - Flexible Layout for Spell Results

Supports three panels with smart toggling:
- Animation canvas (with auto-play)
- Step grid (synced with animation)
- Playback controls + visibility settings

Layout adapts based on which panels are visible.
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import StepGrid from "$lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte";
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
  import SettingsTogglePanel from "$lib/features/compose/components/controls/SettingsTogglePanel.svelte";
  import { container } from "$lib/shared/di";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { ISequenceMotionLoader } from "$lib/shared/sequence-viewer/services/contracts/ISequenceMotionLoader";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { createSpellResultsLayoutState } from "../state/spell-results-layout-state.svelte";

  // Props
  let {
    sequence,
    autoPlayOnMount = true,
  }: {
    sequence: SequenceData;
    autoPlayOnMount?: boolean;
  } = $props();

  // Services (resolved from DI container)
  let controller = $state<IAnimationPlaybackController | null>(null);
  let motionLoader = $state<ISequenceMotionLoader | null>(null);

  // State
  const animState = createAnimationPanelState();
  const layoutState = createSpellResultsLayoutState();
  let loading = $state(true);
  let error = $state<string | null>(null);
  let lastSequenceId = $state<string | null>(null);
  let bpm = $state(60);

  // Derived state for AnimatorCanvas
  // Animation beat indexing: 0 = start position, 1+ = steps
  const stepData = $derived.by(() => {
    const seq = animState.sequenceData;
    if (!seq) return null;

    // Beat 0 = start position
    if (animState.currentStep < 1) {
      return seq.startPosition ?? null;
    }

    // Beat 1+ = steps array (convert 1-based to 0-based index)
    const stepIndex = Math.floor(animState.currentStep) - 1;
    const clamped = Math.min(stepIndex, seq.steps.length - 1);
    return seq.steps[clamped] ?? null;
  });

  const letter = $derived(stepData?.letter ?? null);

  // Initialize services on mount
  onMount(() => {
    try {
      motionLoader = container.items.sequenceMotionLoader;
      controller = container.items.animationPlaybackController;
      loading = false;
    } catch (err) {
      console.error("[SpellResultsView] Failed to initialize:", err);
      error = "Failed to load animation";
      loading = false;
    }

    return () => {
      controller?.dispose();
      animState.dispose();
      layoutState.dispose();
    };
  });

  // Watch sequence changes and initialize animation
  $effect(() => {
    // Read reactive dependencies
    const currentController = controller;
    const currentMotionLoader = motionLoader;
    const currentSequence = sequence;

    if (!currentController || !currentMotionLoader) return;

    // Create unique ID to detect sequence changes
    const seqId = `${currentSequence?.id}:${currentSequence?.ownerId ?? "local"}`;
    if (seqId === lastSequenceId) return;

    untrack(async () => {
      lastSequenceId = seqId;
      animState.reset();
      error = null;

      try {
        // Load motion data
        const fullSeq = await currentMotionLoader!.ensureMotionData(currentSequence);
        if (!fullSeq) {
          error = "Failed to load sequence";
          return;
        }

        // Debug logging
        console.log("[SpellResultsView] Loaded sequence:", {
          id: fullSeq.id,
          steps: fullSeq.steps?.length,
          hasStartPosition: !!fullSeq.startPosition,
          startPosition: fullSeq.startPosition,
        });

        // Initialize playback
        const ok = currentController!.initialize(fullSeq, animState);
        if (!ok) {
          error = "Failed to initialize playback";
          return;
        }

        // Auto-play with small delay (let initialization settle)
        if (autoPlayOnMount && layoutState.animationVisible) {
          setTimeout(() => currentController?.togglePlayback(), 300);
        }
      } catch (err) {
        console.error("[SpellResultsView] Initialization error:", err);
        error = err instanceof Error ? err.message : "Animation error";
      }
    });
  });

  // Playback control handlers
  function handlePlaybackToggle() {
    controller?.togglePlayback();
  }

  function handleStepHalfBack() {
    controller?.stepHalfBeatBackward();
  }

  function handleStepHalfFwd() {
    controller?.stepHalfBeatForward();
  }

  function handleStepFullBack() {
    controller?.stepFullBeatBackward();
  }

  function handleStepFullFwd() {
    controller?.stepFullBeatForward();
  }

  function handleBpmChange(newBpm: number) {
    bpm = newBpm;
    animState.setSpeed(newBpm / 60);
  }

  function handlePlaybackModeChange(mode: "continuous" | "step") {
    animState.setPlaybackMode(mode);
  }

  function handleStepSizeChange(size: 0.5 | 1) {
    animState.setStepPlaybackStepSize(size);
  }
</script>

<div class="spell-results-view">
  <!-- Layout Toggle Buttons -->
  <div class="layout-toggles">
    <button
      class="toggle-btn"
      class:active={layoutState.animationVisible}
      onclick={() => layoutState.toggleAnimation()}
      type="button"
      aria-label="Toggle animation canvas"
    >
      <i class="fas fa-film" aria-hidden="true"></i>
      Animation
    </button>

    <button
      class="toggle-btn"
      class:active={layoutState.gridVisible}
      onclick={() => layoutState.toggleGrid()}
      type="button"
      aria-label="Toggle step grid"
    >
      <i class="fas fa-th" aria-hidden="true"></i>
      Grid
    </button>

    <button
      class="toggle-btn"
      class:active={layoutState.controlsVisible}
      class:disabled={!layoutState.controlsEnabled}
      onclick={() => layoutState.toggleControls()}
      type="button"
      aria-label="Toggle playback controls"
      disabled={!layoutState.controlsEnabled}
    >
      <i class="fas fa-sliders-h" aria-hidden="true"></i>
      Controls
    </button>
  </div>

  {#if loading}
    <div class="loading-state">Loading animation...</div>
  {:else if error}
    <div class="error-state">{error}</div>
  {:else}
    <!-- Dynamic Layout Based on Visibility -->
    <div
      class="results-layout"
      data-show-grid={layoutState.gridVisible}
      data-show-animation={layoutState.animationVisible}
      data-show-controls={layoutState.controlsVisible}
    >
      <!-- Step Grid (Left) -->
      {#if layoutState.gridVisible && animState.sequenceData}
        <div class="grid-panel">
          {#if animState.sequenceData.startPosition}
            <!-- Debug: Start position exists -->
            <div style="display: none;">
              Start: {JSON.stringify(animState.sequenceData.startPosition?.blueStartPosition)}
            </div>
          {/if}
          <StepGrid
            steps={animState.sequenceData.steps ?? []}
            startPosition={animState.sequenceData.startPosition ?? null}
            selectedStepNumber={Math.floor(animState.currentStep)}
            onStartClick={() => controller?.jumpToStep(0)}
            onStepClick={(stepNum) => controller?.jumpToStep(stepNum)}
            isSpotlightMode={true}
            heightSizingRowThreshold={20}
          />
        </div>
      {/if}

      <!-- Animation Canvas (Center/Main) -->
      {#if layoutState.animationVisible}
        <div class="animation-panel">
          <AnimatorCanvas
            blueProp={animState.bluePropState}
            redProp={animState.redPropState}
            gridVisible={true}
            gridMode={sequence?.gridMode}
            {letter}
            {stepData}
            sequenceData={animState.sequenceData}
            currentStep={animState.currentStep}
            isPlaying={animState.isPlaying}
            progressBarVariant="gradient-labeled"
          />
        </div>
      {/if}

      <!-- Controls Panel (Right) -->
      {#if layoutState.controlsVisible && layoutState.animationVisible}
        <div class="controls-panel">
          <div class="controls-inner">
            <TransportControls
              isPlaying={animState.isPlaying}
              onPlaybackToggle={handlePlaybackToggle}
              onStepHalfBeatBackward={handleStepHalfBack}
              onStepHalfBeatForward={handleStepHalfFwd}
              onStepFullBeatBackward={handleStepFullBack}
              onStepFullBeatForward={handleStepFullFwd}
            />

            <SettingsTogglePanel
              propType={null}
              bluePropType={null}
              redPropType={null}
              {bpm}
              playbackMode={animState.playbackMode}
              stepPlaybackStepSize={animState.stepPlaybackStepSize}
              isPlaying={animState.isPlaying}
              onBpmChange={handleBpmChange}
              onPlaybackModeChange={handlePlaybackModeChange}
              onStepPlaybackStepSizeChange={handleStepSizeChange}
              onPlaybackToggle={handlePlaybackToggle}
            />
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .spell-results-view {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 16px);
    container-type: inline-size;
  }

  /* Layout Toggle Buttons */
  .layout-toggles {
    display: flex;
    gap: var(--settings-spacing-sm, 8px);
    justify-content: center;
    padding: 0 var(--settings-spacing-md, 16px);
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    min-height: 40px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .toggle-btn:hover:not(.disabled) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .toggle-btn.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  .toggle-btn.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .toggle-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Results Layout - Dynamic Grid */
  .results-layout {
    flex: 1;
    display: grid;
    gap: var(--settings-spacing-lg, 24px);
    padding: 0;
    width: 100%;
    min-height: 0;
  }

  /* Animation only */
  .results-layout[data-show-animation="true"][data-show-grid="false"][data-show-controls="false"] {
    grid-template-columns: 1fr;
    max-width: 900px;
    margin: 0 auto;
  }

  /* Grid only */
  .results-layout[data-show-animation="false"][data-show-grid="true"] {
    grid-template-columns: 1fr;
    max-width: 900px;
    margin: 0 auto;
  }

  /* Animation + Grid */
  .results-layout[data-show-animation="true"][data-show-grid="true"][data-show-controls="false"] {
    grid-template-columns: 1.2fr 1fr;  /* Grid gets more space */
  }

  /* Animation + Controls */
  .results-layout[data-show-animation="true"][data-show-grid="false"][data-show-controls="true"] {
    grid-template-columns: 1fr 380px;
  }

  /* All three: Grid + Animation + Controls */
  .results-layout[data-show-animation="true"][data-show-grid="true"][data-show-controls="true"] {
    grid-template-columns: 1.3fr 1fr 380px;  /* Grid gets most space */
  }

  /* Panel styles */
  .grid-panel,
  .animation-panel,
  .controls-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }

  .grid-panel {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
    padding: var(--settings-spacing-lg, 24px);
    overflow: auto;
    min-height: 600px;
  }

  .animation-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 600px;
  }

  .controls-panel {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
    padding: var(--settings-spacing-md, 16px);
    overflow-y: auto;
  }

  .controls-inner {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 16px);
  }

  /* Loading and error states */
  .loading-state,
  .error-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--settings-spacing-lg, 24px);
    text-align: center;
    font-size: var(--font-size-md, 16px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .error-state {
    color: var(--semantic-error, #ef4444);
  }

  /* Responsive: Stack vertically on mobile */
  @media (max-width: 768px) {
    .results-layout {
      grid-template-columns: 1fr !important;
      grid-template-rows: auto;
    }

    .toggle-btn {
      flex: 1;
      justify-content: center;
    }
  }
</style>
