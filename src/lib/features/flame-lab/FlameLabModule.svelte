<!--
  FlameLabModule.svelte

  Dedicated lab for developing and tuning the WebGL fire shader overlay.
  Isolated from the main compose/animation pipeline so we can iterate
  on flame quality, momentum response, and visual fidelity without
  affecting production code.

  Architecture:
  - Embeds a standalone animation player (same pattern as InlineAnimationPlayer)
  - Fire overlay controlled independently from global visibility state
  - Parameter sliders for real-time shader tuning
  - Sequence picker to test with any sequence
-->
<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { ISequenceRepository } from "$lib/features/create/shared/services/contracts/ISequenceRepository";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { container } from "$lib/shared/di";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  // Per-instance playback stack
  import { AnimationPlaybackController } from "$lib/features/compose/services/implementations/AnimationPlaybackController";
  import { SequenceAnimationOrchestrator } from "$lib/features/compose/services/implementations/SequenceAnimationOrchestrator";
  import { AnimationStateManager } from "$lib/features/compose/services/implementations/AnimationStateManager";
  import { AnimationLoop } from "$lib/features/compose/services/implementations/AnimationLoop";
  import { StepCalculator } from "$lib/features/compose/services/implementations/StepCalculator";

  // Fire configuration
  import { DEFAULT_FIRE_CONFIG } from "$lib/shared/animation-engine/domain/types/FireTypes";

  const DEFAULT_BPM = 60;
  const visibilityManager = getAnimationVisibilityManager();

  // State
  let sequenceService: ISequenceRepository | null = null;
  let playbackController: IAnimationPlaybackController | null = null;
  let servicesReady = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let showPicker = $state(false);
  let sequence = $state<SequenceData | null>(null);
  let isPlaying = $state(false);
  let bpm = $state(DEFAULT_BPM);

  // Fire state — local to lab, bypasses global visibility
  let fireEnabled = $state(false);
  let intensity = $state(DEFAULT_FIRE_CONFIG.intensity);
  let flameHeight = $state(DEFAULT_FIRE_CONFIG.flameHeight);
  let quality = $state(DEFAULT_FIRE_CONFIG.quality);

  // Compiled fire config passed to AnimatorCanvas → AnimationEngine
  let fireConfig = $derived({
    enabled: fireEnabled,
    intensity,
    flameHeight,
    velocityReactive: true,
    quality,
  });

  // Animation state — per-instance
  const animationState = createAnimationPanelState();

  // Sync fire state to visibility manager
  $effect(() => {
    visibilityManager.setFireEffect(fireEnabled);
  });

  // Sync playing state
  $effect(() => {
    const check = () => {
      const current = animationState.isPlaying;
      if (current !== isPlaying) isPlaying = current;
    };
    check();
    const interval = setInterval(check, 50);
    return () => clearInterval(interval);
  });

  // Derived canvas state
  let currentLetter = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const step = animationState.currentStep;
    if (step < 1 && sequence?.startingPositionGroup) {
      const group = sequence.startingPositionGroup.toLowerCase();
      if (group === "alpha") return Letter.ALPHA;
      if (group === "beta") return Letter.BETA;
      if (group === "gamma") return Letter.GAMMA;
    }
    if (animationState.sequenceData.steps?.length > 0) {
      const idx = Math.max(0, Math.floor(step) - 1);
      const clamped = Math.min(idx, animationState.sequenceData.steps.length - 1);
      return animationState.sequenceData.steps[clamped]?.letter || null;
    }
    return null;
  });

  let currentStepData = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const step = animationState.currentStep;
    if (step < 1 && animationState.sequenceData.startPosition) {
      return animationState.sequenceData.startPosition;
    }
    if (animationState.sequenceData.steps?.length > 0) {
      const idx = Math.max(0, Math.floor(step) - 1);
      const clamped = Math.min(idx, animationState.sequenceData.steps.length - 1);
      return animationState.sequenceData.steps[clamped] || null;
    }
    return null;
  });

  let gridMode = $derived(
    sequence?.gridMode ?? animationState.sequenceData?.gridMode
  );

  // Initialize services
  onMount(() => {
    try {
      sequenceService = container.items.sequenceRepository;
      const propInterpolator = container.items.propInterpolationService;
      const loopabilityChecker = container.items.sequenceLoopabilityChecker;
      const stateManager = new AnimationStateManager();
      const stepCalculator = new StepCalculator();
      const loop = new AnimationLoop();
      const orchestrator = new SequenceAnimationOrchestrator(
        stateManager, stepCalculator, propInterpolator
      );
      playbackController = new AnimationPlaybackController(
        orchestrator, loop, loopabilityChecker
      );
      servicesReady = true;
    } catch (err) {
      console.error("Flame Lab: failed to initialize:", err);
      error = "Failed to initialize animation services";
    }
  });

  onDestroy(() => {
    // Disable fire on exit so it doesn't bleed into other modules
    visibilityManager.setFireEffect(false);
    playbackController?.dispose();
    animationState.dispose();
  });

  async function handleSequenceSelected(seq: SequenceData) {
    showPicker = false;
    sequence = seq;
    await loadAnimation();
  }

  async function loadAnimation() {
    if (!sequenceService || !playbackController || !sequence) return;
    loading = true;
    error = null;

    try {
      const full = await loadSequenceData(sequence);
      if (!full) throw new Error("No motion data");

      animationState.setShouldLoop(true);
      const ok = playbackController.initialize(full, animationState);
      if (!ok) throw new Error("Playback init failed");

      // Auto-play
      setTimeout(() => playbackController?.togglePlayback(), 300);
    } catch (err) {
      console.error("Flame Lab: load failed:", err);
      error = err instanceof Error ? err.message : "Load failed";
    } finally {
      loading = false;
    }
  }

  async function loadSequenceData(seq: SequenceData): Promise<SequenceData | null> {
    if (!sequenceService) return null;
    const hasMotion = (s: SequenceData) =>
      Array.isArray(s.steps) && s.steps.length > 0 &&
      s.steps.some((b) => b?.motions?.blue && b?.motions?.red);
    if (hasMotion(seq)) return seq;
    const id = seq.word || seq.name || seq.id;
    if (id) {
      const loaded = await sequenceService.getSequence(id);
      if (loaded && hasMotion(loaded)) return loaded;
    }
    return seq;
  }

  function togglePlayback() {
    playbackController?.togglePlayback();
  }

  function handleBpmChange(newBpm: number) {
    bpm = newBpm;
    playbackController?.setSpeed(newBpm / DEFAULT_BPM);
  }
</script>

<div class="flame-lab">
  <header class="header">
    <div class="title-row">
      <h1>
        <i class="fas fa-fire" aria-hidden="true"></i>
        Flame Lab
      </h1>
      <span class="badge">Experimental</span>
    </div>
    <p class="description">
      WebGL fire shader overlay. Load a sequence, toggle fire, tune parameters.
    </p>
  </header>

  <div class="content">
    <!-- Canvas Area -->
    <div class="canvas-area">
      {#if !sequence}
        <div class="empty-state">
          <i class="fas fa-fire" aria-hidden="true"></i>
          <p>Load a sequence to start</p>
          <button class="pick-btn" onclick={() => (showPicker = true)}>
            <i class="fas fa-folder-open" aria-hidden="true"></i>
            Pick Sequence
          </button>
        </div>
      {:else if loading}
        <div class="loading-state">
          <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          <span>Loading...</span>
        </div>
      {:else if error}
        <div class="error-state">
          <span>{error}</span>
          <button class="pick-btn" onclick={() => loadAnimation()}>Retry</button>
        </div>
      {:else}
        <div class="canvas-wrapper">
          <AnimatorCanvas
            blueProp={animationState.bluePropState}
            redProp={animationState.redPropState}
            gridVisible={true}
            {gridMode}
            letter={currentLetter}
            stepData={currentStepData}
            sequenceData={animationState.sequenceData}
            {isPlaying}
            onPlaybackToggle={togglePlayback}
            trailSettings={animationSettings.trail}
            word={sequence?.word || sequence?.name || null}
            {fireConfig}
            previewDarkMode={true}
          />
        </div>
      {/if}
    </div>

    <!-- Controls Panel -->
    <div class="controls-panel themed-scrollbar">
      <!-- Sequence Picker -->
      <div class="control-section">
        <h3>Sequence</h3>
        <button class="action-btn" onclick={() => (showPicker = true)}>
          <i class="fas fa-folder-open" aria-hidden="true"></i>
          {sequence ? "Change Sequence" : "Pick Sequence"}
        </button>
        {#if sequence}
          <div class="sequence-info">
            <span class="seq-name">{sequence.word || sequence.name || "Unnamed"}</span>
            <span class="seq-beats">{sequence.steps?.length || 0} beats</span>
          </div>
        {/if}
      </div>

      <!-- Playback -->
      {#if sequence && !loading && !error}
        <div class="control-section">
          <h3>Playback</h3>
          <div class="playback-row">
            <button class="play-btn" onclick={togglePlayback}>
              <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <div class="bpm-control">
              <label for="bpm-slider">BPM</label>
              <input
                id="bpm-slider"
                type="range"
                min="15"
                max="240"
                step="5"
                bind:value={bpm}
                oninput={() => handleBpmChange(bpm)}
              />
              <span class="bpm-value">{bpm}</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Fire Controls -->
      <div class="control-section fire-section">
        <h3>
          <i class="fas fa-fire" aria-hidden="true"></i>
          Fire Effect
        </h3>

        <div class="toggle-row">
          <span>Enabled</span>
          <button
            class="toggle-btn"
            class:active={fireEnabled}
            onclick={() => (fireEnabled = !fireEnabled)}
            aria-label={fireEnabled ? "Disable fire" : "Enable fire"}
          >
            {fireEnabled ? "ON" : "OFF"}
          </button>
        </div>

        {#if fireEnabled}
          <div class="slider-group">
            <div class="slider-row">
              <label for="intensity-slider">Intensity</label>
              <input
                id="intensity-slider"
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                bind:value={intensity}
              />
              <span class="slider-value">{intensity.toFixed(1)}</span>
            </div>

            <div class="slider-row">
              <label for="height-slider">Flame Height</label>
              <input
                id="height-slider"
                type="range"
                min="0.3"
                max="3.0"
                step="0.1"
                bind:value={flameHeight}
              />
              <span class="slider-value">{flameHeight.toFixed(1)}x</span>
            </div>

            <div class="slider-row">
              <label for="quality-slider">Quality (octaves)</label>
              <input
                id="quality-slider"
                type="range"
                min="2"
                max="4"
                step="1"
                bind:value={quality}
              />
              <span class="slider-value">{quality}</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Debug Info -->
      {#if fireEnabled && animationState.bluePropState}
        <div class="control-section debug-section">
          <h3>Debug</h3>
          <div class="debug-info">
            <div class="debug-row">
              <span>Blue prop</span>
              <span class="debug-val">
                {animationState.bluePropState
                  ? `angle: ${(animationState.bluePropState.centerPathAngle * 180 / Math.PI).toFixed(0)}deg`
                  : "null"}
              </span>
            </div>
            <div class="debug-row">
              <span>Red prop</span>
              <span class="debug-val">
                {animationState.redPropState
                  ? `angle: ${(animationState.redPropState.centerPathAngle * 180 / Math.PI).toFixed(0)}deg`
                  : "null"}
              </span>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Sequence Picker Modal -->
<SequencePickerModal
  open={showPicker}
  onSelect={handleSequenceSelected}
  onClose={() => (showPicker = false)}
  title="Select Sequence for Flame Lab"
/>

<style>
  .flame-lab {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  /* Header */
  .header {
    flex-shrink: 0;
    padding: var(--spacing-md, 16px) var(--spacing-lg, 24px);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
  }

  .title-row h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, white);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
  }

  .title-row h1 i {
    color: #f97316;
  }

  .badge {
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    background: rgba(249, 115, 22, 0.15);
    color: #f97316;
    border: 1px solid rgba(249, 115, 22, 0.3);
  }

  .description {
    margin: var(--spacing-xs, 4px) 0 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* Content: split layout */
  .content {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-md, 16px);
    min-height: 0;
    overflow: hidden;
  }

  /* Canvas area */
  .canvas-area {
    position: relative;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    min-height: 0;
  }

  .canvas-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Empty / Loading / Error states */
  .empty-state,
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md, 16px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .empty-state i {
    font-size: 3rem;
    color: rgba(249, 115, 22, 0.3);
  }

  .empty-state p,
  .loading-state span,
  .error-state span {
    font-size: var(--font-size-min, 14px);
    margin: 0;
  }

  .pick-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    padding: 10px 20px;
    border: 1.5px solid rgba(249, 115, 22, 0.4);
    border-radius: var(--border-radius-md, 8px);
    background: rgba(249, 115, 22, 0.1);
    color: #f97316;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .pick-btn:hover {
    background: rgba(249, 115, 22, 0.2);
    border-color: rgba(249, 115, 22, 0.6);
  }

  .pick-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* Controls panel */
  .controls-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 16px);
    overflow-y: auto;
    min-height: 0;
  }

  .control-section {
    padding: var(--spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
  }

  .control-section h3 {
    margin: 0 0 var(--spacing-sm, 8px);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
  }

  .control-section h3 i {
    color: #f97316;
  }

  /* Action button */
  .action-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs, 4px);
    padding: 10px 16px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .sequence-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--spacing-sm, 8px);
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    background: rgba(255, 255, 255, 0.03);
    border-radius: var(--border-radius-sm, 4px);
  }

  .seq-name {
    font-weight: 500;
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
  }

  .seq-beats {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* Playback */
  .playback-row {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
  }

  .play-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs, 4px);
    padding: 10px 16px;
    border: 1.5px solid rgba(16, 185, 129, 0.3);
    border-radius: var(--border-radius-md, 8px);
    background: rgba(16, 185, 129, 0.1);
    color: rgb(16, 185, 129);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .play-btn:hover {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.5);
  }

  .bpm-control {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
  }

  .bpm-control label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }

  .bpm-control input[type="range"] {
    flex: 1;
    accent-color: #f97316;
  }

  .bpm-value {
    min-width: 32px;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
  }

  /* Fire controls */
  .fire-section {
    border-color: rgba(249, 115, 22, 0.2);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .toggle-btn {
    padding: 6px 16px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.05);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    min-width: 56px;
  }

  .toggle-btn.active {
    background: linear-gradient(135deg, rgba(251, 146, 60, 0.3), rgba(239, 68, 68, 0.3));
    border-color: rgba(251, 146, 60, 0.5);
    color: rgb(251, 146, 60);
  }

  .toggle-btn:hover {
    border-color: rgba(255, 255, 255, 0.3);
  }

  .toggle-btn.active:hover {
    border-color: rgba(251, 146, 60, 0.7);
  }

  /* Sliders */
  .slider-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
    margin-top: var(--spacing-md, 16px);
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
  }

  .slider-row label {
    min-width: 100px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .slider-row input[type="range"] {
    flex: 1;
    accent-color: #f97316;
  }

  .slider-value {
    min-width: 44px;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
  }

  /* Debug */
  .debug-section {
    border-color: rgba(255, 255, 255, 0.05);
  }

  .debug-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .debug-row {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .debug-val {
    font-family: var(--font-mono, monospace);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .pick-btn,
    .action-btn,
    .play-btn,
    .toggle-btn {
      transition: none;
    }
  }

  /* Responsive: stack on narrow screens */
  @media (max-width: 900px) {
    .content {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr auto;
    }

    .canvas-area {
      min-height: 300px;
    }
  }
</style>
