<!--
  LedTuningTab.svelte

  LED effect tuning: sequence picker, playback controls,
  LED overlay configuration, and the AnimatorCanvas preview.
  Uses SequenceChainingOrchestrator for auto-chaining (shared with FireTuningTab).
-->
<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import LedControlPanel from "./LedControlPanel.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { ISequenceRepository } from "$lib/features/create/shared/services/contracts/ISequenceRepository";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { container } from "$lib/shared/di";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { simplifyAndTruncate } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";

  import { AnimationPlaybackController } from "$lib/features/compose/services/implementations/AnimationPlaybackController";
  import { SequenceAnimationOrchestrator } from "$lib/features/compose/services/implementations/SequenceAnimationOrchestrator";
  import { AnimationStateManager } from "$lib/features/compose/services/implementations/AnimationStateManager";
  import { AnimationLoop } from "$lib/features/compose/services/implementations/AnimationLoop";
  import { StepCalculator } from "$lib/features/compose/services/implementations/StepCalculator";

  import { DEFAULT_LED_CONFIG, ledBrightnessToFloat, type LedOverlayConfig } from "$lib/shared/animation-engine/domain/types/LedTypes";

  // Auto-chaining (shared with FireTuningTab)
  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/implementations/EndlessSpinnerOrchestrator";
  import { InfiniteSequenceGenerator } from "$lib/features/landing/services/implementations/InfiniteSequenceGenerator";
  import { SpinnerMetricsRepository } from "$lib/features/landing/services/implementations/SpinnerMetricsRepository";
  import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
  import { SequenceChainingOrchestrator } from "../services/implementations/SequenceChainingOrchestrator";
  import type { ISequenceChainingOrchestrator, SourceMode } from "../services/contracts/ISequenceChainingOrchestrator";

  const DEFAULT_BPM = 60;
  const STORAGE_KEY = "led-lab-state";
  const visibilityManager = getAnimationVisibilityManager();

  interface LedLabPersistedState {
    sequenceId: string | null;
    ledEnabled: boolean;
    brightness: number;
    patternId: string;
    primaryColor: string;
    patternSpeed: number;
    glowRadius: number;
    bloomIntensity: number;
    trailFadeRate: number;
    bpm: number;
    sourceMode: SourceMode;
  }

  function loadPersistedState(): Partial<LedLabPersistedState> {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  }

  function savePersistedState() {
    try {
      const state: LedLabPersistedState = {
        sequenceId: sequence?.word || sequence?.name || sequence?.id || null,
        ledEnabled,
        brightness,
        patternId,
        primaryColor,
        patternSpeed,
        glowRadius,
        bloomIntensity,
        trailFadeRate,
        bpm,
        sourceMode,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }

  const persisted = loadPersistedState();

  let sequenceService: ISequenceRepository | null = null;
  let playbackController: IAnimationPlaybackController | null = null;
  let chainingOrchestrator = $state<ISequenceChainingOrchestrator | null>(null);
  let servicesReady = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let playbackStartTimer: ReturnType<typeof setTimeout> | null = null;
  let showPicker = $state(false);
  let sequence = $state<SequenceData | null>(null);
  let isPlaying = $state(false);
  let bpm = $state(persisted.bpm ?? DEFAULT_BPM);

  // LED starts disabled; restored after engine is ready to avoid the
  // race where the toggle shows ON but the WebGL renderer hasn't mounted.
  let ledEnabled = $state(false);
  let ledStateRestored = false;
  let brightness = $state(persisted.brightness ?? 5);
  let patternId = $state(persisted.patternId ?? DEFAULT_LED_CONFIG.patternId);
  let primaryColor = $state(persisted.primaryColor ?? DEFAULT_LED_CONFIG.primaryColor);
  let patternSpeed = $state(persisted.patternSpeed ?? DEFAULT_LED_CONFIG.patternSpeed);
  let glowRadius = $state(persisted.glowRadius ?? DEFAULT_LED_CONFIG.glowRadius);
  let bloomIntensity = $state(persisted.bloomIntensity ?? DEFAULT_LED_CONFIG.bloomIntensity);
  let trailFadeRate = $state(persisted.trailFadeRate ?? DEFAULT_LED_CONFIG.trailFadeRate);
  let sourceMode = $state<SourceMode>(persisted.sourceMode ?? "pick");

  let ledConfig = $derived<LedOverlayConfig>({
    enabled: ledEnabled,
    glowRadius,
    bloomIntensity,
    trailFadeRate,
    patternId,
    patternSpeed,
    primaryColor,
    brightness: ledBrightnessToFloat(brightness),
  });

  const animationState = createAnimationPanelState();

  $effect(() => {
    visibilityManager.setLedEffect(ledEnabled);
  });

  // Restore persisted LED state AFTER the engine is ready and has a sequence.
  $effect(() => {
    if (servicesReady && sequence && !ledStateRestored) {
      ledStateRestored = true;
      if (persisted.ledEnabled) {
        requestAnimationFrame(() => { ledEnabled = true; });
      }
    }
  });

  $effect(() => {
    const check = () => {
      const current = animationState.isPlaying;
      if (current !== isPlaying) isPlaying = current;
    };
    check();
    const interval = setInterval(check, 50);
    return () => clearInterval(interval);
  });

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

  $effect(() => {
    void ledEnabled;
    void brightness;
    void patternId;
    void primaryColor;
    void patternSpeed;
    void glowRadius;
    void bloomIntensity;
    void trailFadeRate;
    void bpm;
    void sequence;
    void sourceMode;
    untrack(() => savePersistedState());
  });

  // Watch for sequence completion -> chain to next (library/infinite modes only)
  $effect(() => {
    if (sourceMode === "pick" || !chainingOrchestrator) return;
    chainingOrchestrator.checkAndChain(
      Math.floor(animationState.currentStep),
      animationState.totalSteps,
      sourceMode,
      servicesReady,
      !!sequence
    );
  });

  // Preload next sequence (library + infinite modes)
  $effect(() => {
    if (sourceMode === "pick" || !chainingOrchestrator) return;
    chainingOrchestrator.checkAndPreload(
      Math.floor(animationState.currentStep),
      animationState.totalSteps,
      sourceMode,
      servicesReady,
      !!sequence
    );
  });

  onMount(async () => {
    try {
      sequenceService = container.items.sequenceRepository;
      const propInterpolator = container.items.propInterpolationService;
      const loopabilityChecker = container.items.sequenceLoopabilityChecker;
      const stateManager = new AnimationStateManager();
      const stepCalculator = new StepCalculator();
      const loop = new AnimationLoop();
      const animOrchestrator = new SequenceAnimationOrchestrator(
        stateManager, stepCalculator, propInterpolator
      );
      playbackController = new AnimationPlaybackController(
        animOrchestrator, loop, loopabilityChecker
      );

      // Initialize auto-chaining services
      const browseLoader = container.items.browseLoader;
      const generationOrchestrator = container.items.generationOrchestrator;
      const sequenceTransformer = container.items.sequenceTransformer;

      const spinnerOrch = new EndlessSpinnerOrchestrator(
        browseLoader,
        generationOrchestrator,
        sequenceTransformer,
        startPositionDeriver,
        orientationCalculator,
        gridPositionDeriver
      );

      const metricsRepo = new SpinnerMetricsRepository();
      const infiniteGen = new InfiniteSequenceGenerator(
        generationOrchestrator,
        metricsRepo
      );

      chainingOrchestrator = new SequenceChainingOrchestrator(spinnerOrch, infiniteGen);
      chainingOrchestrator.onSequenceSwapped((seq) => { sequence = seq; });
      chainingOrchestrator.onError((msg) => { error = msg; });
      await chainingOrchestrator.initialize(playbackController, animationState);

      servicesReady = true;

      // Restore or auto-start based on source mode
      if (sourceMode === "pick") {
        const savedId = persisted.sequenceId;
        if (savedId && sequenceService) {
          restoreSequence(savedId);
        }
      } else {
        chainingOrchestrator.startAutoMode(sourceMode);
      }
    } catch (err) {
      console.error("LED Lab: failed to initialize:", err);
      error = "Failed to initialize animation services";
    }
  });

  async function restoreSequence(id: string) {
    if (!sequenceService || !playbackController) return;
    loading = true;
    error = null;
    try {
      const loaded = await sequenceService.getSequence(id);
      if (loaded) {
        sequence = loaded;
        await loadAnimation();
      }
    } catch (err) {
      console.error("LED Lab: failed to restore sequence:", err);
      error = "Could not restore the previous session's sequence";
    } finally {
      loading = false;
    }
  }

  onDestroy(() => {
    if (playbackStartTimer !== null) clearTimeout(playbackStartTimer);
    // NOTE: We intentionally do NOT call visibilityManager.setLedEffect(false) here.
    // This component unmounts when switching to the "Points" inner tab within the same
    // LED mode. Disabling the LED effect would kill the overlay. The EffectsLabModule
    // handles cleanup when the mode changes or the module unmounts.
    chainingOrchestrator?.dispose();
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

      if (playbackStartTimer !== null) clearTimeout(playbackStartTimer);
      playbackStartTimer = setTimeout(() => { playbackController?.togglePlayback(); playbackStartTimer = null; }, 300);
    } catch (err) {
      console.error("LED Lab: load failed:", err);
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

  function handleSourceChange(mode: SourceMode) {
    if (mode === sourceMode) return;
    sourceMode = mode;

    if (mode === "pick") {
      // Stop auto-chaining, keep current sequence
      return;
    }
    // Start auto mode (library or infinite)
    chainingOrchestrator?.startAutoMode(mode);
  }

  function handleSkip() {
    if (sourceMode === "pick") return;
    chainingOrchestrator?.skip();
  }

  async function handleShuffle() {
    if (sourceMode === "pick") return;
    await chainingOrchestrator?.shuffle();
  }
</script>

<div class="tuning-tab">
  <div class="content">
    <!-- Canvas Area -->
    <div class="canvas-area">
      {#if !sequence && sourceMode === "pick"}
        <div class="empty-state">
          <i class="fas fa-lightbulb" aria-hidden="true"></i>
          <p>Load a sequence to start</p>
          <button class="pick-btn" onclick={() => (showPicker = true)} aria-label="Pick a sequence to load">
            <i class="fas fa-folder-open" aria-hidden="true"></i>
            Pick Sequence
          </button>
        </div>
      {:else if !sequence}
        <div class="loading-state">
          <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          <span>Generating...</span>
        </div>
      {:else if loading}
        <div class="loading-state">
          <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          <span>Loading...</span>
        </div>
      {:else if error}
        <div class="error-state">
          <span>{error}</span>
          <button class="pick-btn" onclick={() => loadAnimation()} aria-label="Retry loading the sequence">Retry</button>
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
            currentStep={animationState.currentStep}
            {isPlaying}
            onPlaybackToggle={togglePlayback}
            trailSettings={animationSettings.trail}
            word={sequence?.word || sequence?.name || null}
            {ledConfig}
            backgroundAlpha={0}
            focused={true}
          />
        </div>
      {/if}
    </div>

    <!-- Controls Panel -->
    <div class="controls-panel themed-scrollbar">
      <!-- Source Mode -->
      <div class="control-section">
        <h3>Source</h3>
        <div class="source-toggle" role="radiogroup" aria-label="Sequence source">
          <button
            role="radio"
            class="source-btn"
            class:active={sourceMode === "pick"}
            aria-checked={sourceMode === "pick"}
            onclick={() => handleSourceChange("pick")}
          >
            <i class="fas fa-hand-pointer" aria-hidden="true"></i>
            Pick
          </button>
          <button
            role="radio"
            class="source-btn"
            class:active={sourceMode === "library"}
            aria-checked={sourceMode === "library"}
            onclick={() => handleSourceChange("library")}
          >
            <i class="fas fa-book" aria-hidden="true"></i>
            Library
          </button>
          <button
            role="radio"
            class="source-btn"
            class:active={sourceMode === "infinite"}
            aria-checked={sourceMode === "infinite"}
            onclick={() => handleSourceChange("infinite")}
          >
            <i class="fas fa-infinity" aria-hidden="true"></i>
            Infinite
          </button>
        </div>

        {#if sourceMode === "pick"}
          <button class="action-btn" onclick={() => (showPicker = true)} aria-label={sequence ? "Change the current sequence" : "Pick a sequence to load"}>
            <i class="fas fa-folder-open" aria-hidden="true"></i>
            {sequence ? "Change Sequence" : "Pick Sequence"}
          </button>
        {:else}
          <div class="auto-actions">
            <button class="action-btn skip-btn" onclick={handleSkip} disabled={chainingOrchestrator?.isChainingNow || !sequence} aria-label="Skip to the next sequence">
              <i class="fas fa-forward" aria-hidden="true"></i>
              Skip
            </button>
            {#if sourceMode === "infinite"}
              <button class="action-btn shuffle-btn" onclick={handleShuffle} disabled={chainingOrchestrator?.isChainingNow || !sequence} aria-label="Shuffle to a random sequence">
                <i class="fas fa-random" aria-hidden="true"></i>
                Shuffle
              </button>
            {/if}
          </div>
        {/if}

        {#if sequence}
          <div class="sequence-info">
            <span class="seq-name">{simplifyAndTruncate(sequence.word || sequence.name || "Unnamed")}</span>
            <span class="seq-beats">{sequence.steps?.length || 0} beats</span>
          </div>
        {/if}
      </div>

      <!-- Playback -->
      {#if sequence && !loading && !error}
        <div class="control-section">
          <h3>Playback</h3>
          <div class="playback-row">
            <button class="play-btn" onclick={togglePlayback} aria-label={isPlaying ? "Pause playback" : "Play sequence"}>
              <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <div class="bpm-control">
              <label for="led-bpm-slider">BPM</label>
              <input
                id="led-bpm-slider"
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

      <!-- LED Controls -->
      <div class="control-section">
        <LedControlPanel
          bind:ledEnabled
          bind:brightness
          bind:patternId
          bind:primaryColor
          bind:patternSpeed
          bind:glowRadius
          bind:bloomIntensity
          bind:trailFadeRate
        />
      </div>

      <!-- Debug Info -->
      {#if ledEnabled && animationState.bluePropState}
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
  title="Select Sequence for LED Lab"
/>

<style>
  .tuning-tab {
    /* LED Lab domain color tokens */
    --led-green: #00ff88;
    --led-green-bright: #33ffaa;
    --led-green-dim: rgba(0, 255, 136, 0.08);
    --led-green-mid: rgba(0, 255, 136, 0.15);
    --led-green-border: rgba(0, 255, 136, 0.3);
    --led-green-border-strong: rgba(0, 255, 136, 0.5);

    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .content {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-md, 16px);
    min-height: 0;
    overflow: hidden;
  }

  .canvas-area {
    position: relative;
    background: var(--theme-surface-dark, #0a0a0f);
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
    color: var(--led-green-border);
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
    border: 1.5px solid var(--led-green-border);
    border-radius: var(--border-radius-md, 8px);
    background: var(--led-green-dim);
    color: var(--led-green);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .pick-btn:hover {
    background: var(--led-green-mid);
    border-color: var(--led-green-border-strong);
  }

  .pick-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

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
    background: color-mix(in srgb, var(--theme-text) 10%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .sequence-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--spacing-sm, 8px);
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    background: color-mix(in srgb, var(--theme-text) 3%, transparent);
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

  /* Source mode toggle */
  .source-toggle {
    display: flex;
    gap: 2px;
    background: color-mix(in srgb, var(--theme-text) 3%, transparent);
    border-radius: var(--border-radius-md, 8px);
    padding: 3px;
    margin-bottom: var(--spacing-sm, 8px);
  }

  .source-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    min-height: 36px;
  }

  .source-btn:hover {
    color: var(--theme-text, white);
    background: color-mix(in srgb, var(--theme-text) 6%, transparent);
  }

  .source-btn.active {
    background: var(--led-green-mid);
    color: var(--led-green-bright);
    box-shadow: 0 1px 3px var(--theme-overlay-dark, rgba(0, 0, 0, 0.2));
  }

  .source-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: -2px;
  }

  .source-btn i {
    font-size: var(--font-size-compact, 12px);
  }

  .auto-actions {
    display: flex;
    gap: 6px;
  }

  .auto-actions .action-btn {
    flex: 1;
  }

  .skip-btn:disabled,
  .shuffle-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

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
    border: 1.5px solid var(--led-green-border);
    border-radius: var(--border-radius-md, 8px);
    background: var(--led-green-dim);
    color: var(--led-green);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .play-btn:hover {
    background: color-mix(in srgb, var(--led-green) 20%, transparent);
    border-color: var(--led-green-border-strong);
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
    accent-color: var(--led-green);
  }

  .bpm-value {
    min-width: 32px;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
  }

  .debug-section {
    border-color: color-mix(in srgb, var(--theme-text) 5%, transparent);
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

  @media (prefers-reduced-motion: reduce) {
    .pick-btn,
    .action-btn,
    .play-btn {
      transition: none;
    }
  }

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
