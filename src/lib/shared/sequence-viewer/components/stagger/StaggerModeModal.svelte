<!--
  @archived - 2026-01-24

  This component is archived and no longer imported.
  Stagger mode is now handled by the Compose module via sequence-handoff.svelte.ts.
  Kept for reference during the Compose multi-performer implementation.

  Original description:
  Full-screen modal for stagger mode visualization.
  Displays two performers with time offset, following TunnelRenderer's dual-performer pattern.

  Architecture:
  - Desktop: 85% viewport modal
  - Mobile: Full-screen takeover
  - Uses createPlaybackControllerFactory for independent animation states
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
  import BpmChips from "$lib/features/compose/components/controls/BpmChips.svelte";
  import StaggerPresetSelector from "./StaggerPresetSelector.svelte";
  import StaggerOffsetSlider from "./StaggerOffsetSlider.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { createPlaybackControllerFactory } from "$lib/shared/di/containers/animator-container";
  import { createStaggerModeState, type StaggerPreset } from "../../state/stagger-mode-state.svelte";
  import type { AnimationStateKey } from "$lib/features/compose/state/animation-panel-state.svelte";

  interface Props {
    open: boolean;
    sequence: SequenceData;
    bpm: number;
    onclose: () => void;
  }

  let { open = $bindable(false), sequence, bpm, onclose }: Props = $props();

  // Services
  let primaryController: IAnimationPlaybackController | null = null;
  let secondaryController: IAnimationPlaybackController | null = null;
  let hapticService: IHapticFeedback | null = null;

  // State
  const staggerState = createStaggerModeState();
  let loading = $state(false);
  let error = $state<string | null>(null);
  let servicesReady = $state(false);
  let lastLoadedSequenceId: string | null = null;

  // Local reactive state (synced from animation states)
  let isPlayingLocal = $state(false);
  let currentStepLocal = $state(0);
  let secondaryCurrentStep = $state(0);
  let cleanupPrimarySubscription: (() => void) | undefined;
  let cleanupSecondarySubscription: (() => void) | undefined;

  // Sync BPM to stagger state
  $effect(() => {
    staggerState.setBpm(bpm);
  });

  // Initialize services
  async function initializeServices() {
    try {
      // Create independent playback controllers using factory
      primaryController = createPlaybackControllerFactory();
      secondaryController = createPlaybackControllerFactory();
      hapticService = container.items.hapticFeedback;

      // Note: Secondary prop textures are loaded automatically by AnimationEngine
      // when it detects secondary props being passed to AnimatorCanvas

      servicesReady = true;
    } catch (err) {
      console.error("[StaggerModeModal] Failed to initialize services:", err);
      error = "Failed to initialize animation services";
    }
  }

  // Initialize animation when modal opens
  async function initializeAnimation() {
    // Guard against re-initialization while loading
    if (loading) return;
    if (!primaryController || !secondaryController || !sequence) return;

    const sequenceId = sequence.id || sequence.word || "unknown";
    if (sequenceId === lastLoadedSequenceId) return;

    try {
      loading = true;
      error = null;

      // Set total steps for offset calculation
      const totalSteps = sequence.steps?.length ?? 0;
      staggerState.setTotalSteps(totalSteps);

      // Configure both states
      staggerState.primaryState.setShouldLoop(true);
      staggerState.secondaryState.setShouldLoop(true);

      // Initialize primary controller
      const primarySuccess = primaryController.initialize(
        sequence,
        staggerState.primaryState
      );

      // Initialize secondary controller with same sequence
      const secondarySuccess = secondaryController.initialize(
        sequence,
        staggerState.secondaryState
      );

      if (!primarySuccess || !secondarySuccess) {
        throw new Error("Failed to initialize playback controllers");
      }

      // Note: controllers already call state.setSequenceData() in initialize()

      // Subscribe to primary state changes
      cleanupPrimarySubscription = staggerState.primaryState.subscribe(
        (key: AnimationStateKey, value: unknown) => {
          if (key === "isPlaying") {
            isPlayingLocal = value as boolean;
          } else if (key === "currentStep") {
            currentStepLocal = value as number;
          }
        }
      );

      // Subscribe to secondary state for its current step
      cleanupSecondarySubscription = staggerState.secondaryState.subscribe(
        (key: AnimationStateKey, value: unknown) => {
          if (key === "currentStep") {
            secondaryCurrentStep = value as number;
          }
        }
      );

      lastLoadedSequenceId = sequenceId;

      // Auto-start animation with offset
      setTimeout(() => {
        // Jump secondary to offset position before starting
        applySecondaryOffset();
        // Start both controllers
        primaryController?.togglePlayback();
        secondaryController?.togglePlayback();
      }, 200);
    } catch (err) {
      console.error("[StaggerModeModal] Failed to initialize animation:", err);
      error = err instanceof Error ? err.message : "Failed to initialize animation";
    } finally {
      loading = false;
    }
  }

  // Apply offset to secondary performer
  function applySecondaryOffset() {
    if (!secondaryController || !sequence) return;

    const totalSteps = sequence.steps?.length ?? 0;
    if (totalSteps === 0) return;

    // Calculate offset in steps
    const msPerBeat = 60000 / staggerState.bpm;
    const offsetSteps = staggerState.effectiveOffsetMs / msPerBeat;

    // Jump secondary to offset position (wrapping if needed)
    const targetStep = offsetSteps % (totalSteps + 1);
    secondaryController.jumpToStep(targetStep);
  }

  // Re-apply offset when preset changes (while paused)
  $effect(() => {
    // Access preset to create dependency
    void staggerState.preset;
    void staggerState.customOffsetBeats;

    if (!isPlayingLocal && secondaryController && staggerState.secondaryState.sequenceData) {
      applySecondaryOffset();
    }
  });

  // Handle playback toggle
  function handlePlaybackToggle() {
    hapticService?.trigger("selection");
    primaryController?.togglePlayback();
    secondaryController?.togglePlayback();
  }

  // Handle BPM change
  function handleBpmChange(newBpm: number) {
    hapticService?.trigger("selection");
    const speedMultiplier = newBpm / 60;
    primaryController?.setSpeed(speedMultiplier);
    secondaryController?.setSpeed(speedMultiplier);
    staggerState.setBpm(newBpm);
  }

  // Handle preset change
  function handlePresetChange(preset: StaggerPreset) {
    hapticService?.trigger("selection");
    staggerState.setPreset(preset);
  }

  // Handle custom offset change
  function handleOffsetChange(beats: number) {
    staggerState.setCustomOffsetBeats(beats);
  }

  // Handle close
  function handleClose() {
    // Stop playback
    if (isPlayingLocal) {
      primaryController?.togglePlayback();
      secondaryController?.togglePlayback();
    }
    onclose();
  }

  // Lifecycle
  $effect(() => {
    if (open && !servicesReady) {
      initializeServices();
    }
  });

  $effect(() => {
    if (open && servicesReady && sequence) {
      initializeAnimation();
    }
  });

  $effect(() => {
    if (!open && lastLoadedSequenceId) {
      // Reset when closed
      lastLoadedSequenceId = null;
      cleanupPrimarySubscription?.();
      cleanupSecondarySubscription?.();
    }
  });

  onDestroy(() => {
    cleanupPrimarySubscription?.();
    cleanupSecondarySubscription?.();
    primaryController?.dispose();
    secondaryController?.dispose();
    staggerState.dispose();
  });
</script>

<BaseModal
  bind:open
  onclose={() => handleClose()}
  size="full"
  animation="pop"
  closeOnEscape={true}
  closeOnBackdrop={true}
  class="stagger-mode-modal"
>
  {#snippet header()}
    <header class="stagger-header">
      <button
        type="button"
        class="back-button"
        onclick={handleClose}
        aria-label="Close stagger mode"
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
      </button>
      <h2 class="stagger-title">Stagger Mode</h2>
      <div class="header-spacer"></div>
    </header>
  {/snippet}

  <div class="stagger-body-content">
    <div class="stagger-content">
      {#if loading}
        <div class="loading-state" aria-live="polite">
          <div class="spinner"></div>
          <p>Loading animation...</p>
        </div>
      {:else if error}
        <div class="error-state" role="alert">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <p>{error}</p>
        </div>
      {:else if servicesReady && staggerState.primaryState.sequenceData}
        <div class="canvas-container">
          <AnimatorCanvas
            blueProp={staggerState.primaryState.bluePropState}
            redProp={staggerState.primaryState.redPropState}
            secondaryBlueProp={staggerState.secondaryState.bluePropState}
            secondaryRedProp={staggerState.secondaryState.redPropState}
            gridVisible={true}
            gridMode={staggerState.primaryState.sequenceData.gridMode ?? null}
            currentStep={currentStepLocal}
            sequenceData={staggerState.primaryState.sequenceData}
            isPlaying={isPlayingLocal}
            hideTkaGlyph={true}
            hideStepNumbers={true}
          />
        </div>
      {:else}
        <div class="empty-state">
          <i class="fas fa-users" aria-hidden="true"></i>
          <p>Preparing stagger visualization...</p>
        </div>
      {/if}
    </div>
  </div>

  {#snippet footer()}
    <footer class="stagger-footer">
      <div class="preset-row">
        <StaggerPresetSelector
          preset={staggerState.preset}
          onPresetChange={handlePresetChange}
        />
      </div>

      {#if staggerState.preset === "custom"}
        <div class="slider-row">
          <StaggerOffsetSlider
            offsetBeats={staggerState.customOffsetBeats}
            maxBeats={staggerState.totalSteps}
            onOffsetChange={handleOffsetChange}
          />
        </div>
      {/if}

      <div class="transport-row">
        <TransportControls
          isPlaying={isPlayingLocal}
          onPlaybackToggle={handlePlaybackToggle}
          onStepHalfBeatBackward={() => primaryController?.stepHalfBeatBackward()}
          onStepHalfBeatForward={() => primaryController?.stepHalfBeatForward()}
          onStepFullBeatBackward={() => primaryController?.stepFullBeatBackward()}
          onStepFullBeatForward={() => primaryController?.stepFullBeatForward()}
        />
      </div>

      <div class="bpm-row">
        <BpmChips
          bpm={staggerState.bpm}
          variant="compact"
          onBpmChange={handleBpmChange}
        />
      </div>
    </footer>
  {/snippet}
</BaseModal>

<style>
  /* Header */
  .stagger-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: 18px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .back-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
  }

  .stagger-title {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, white);
    margin: 0;
  }

  .header-spacer {
    width: 48px;
  }

  /* Body wrapper - needs explicit dimensions for flex children */
  .stagger-body-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

  /* Content - MUST have explicit height for container queries to work */
  .stagger-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    height: 100%;
    padding: 16px;
    overflow: hidden;
  }

  .canvas-container {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    overflow: hidden;
    container-type: size;
    container-name: stagger-canvas;
    background: var(--color-background-primary, #1a1a1a);
  }

  /* Override canvas wrapper sizing to fit container */
  .canvas-container :global(.animation-container) {
    width: 100%;
    height: 100%;
  }

  .canvas-container :global(.content-wrapper) {
    width: min(100cqw, 100cqh);
    height: min(100cqw, 100cqh);
    max-width: 100%;
    max-height: 100%;
  }

  .canvas-container :global(.canvas-wrapper) {
    width: 100%;
    height: 100%;
    aspect-ratio: 1 / 1;
  }

  /* Loading/Error/Empty states */
  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-min, 14px);
  }

  .error-state {
    color: var(--semantic-error, #f87171);
  }

  .empty-state i {
    font-size: 48px;
    opacity: 0.3;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-color: var(--theme-accent, #6366f1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Footer */
  .stagger-footer {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .preset-row,
  .slider-row,
  .transport-row,
  .bpm-row {
    display: flex;
    justify-content: center;
  }

  /* Desktop: 85% viewport sizing */
  @media (min-width: 768px) {
    :global(.stagger-mode-modal.base-modal[data-size="full"]) {
      width: clamp(600px, 85vw, 1000px) !important;
      height: clamp(500px, 85vh, 800px) !important;
      max-width: 85vw !important;
      max-height: 85vh !important;
      border-radius: 16px !important;
      margin: auto !important;
    }

    .stagger-content {
      padding: 24px;
    }
  }

  /* Mobile: Full screen */
  @media (max-width: 767px) {
    :global(.stagger-mode-modal.base-modal[data-size="full"]) {
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      border-radius: 0 !important;
      margin: 0 !important;
    }

    .stagger-footer {
      padding: 12px;
      gap: 8px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }

    .back-button {
      transition: none;
    }
  }
</style>
