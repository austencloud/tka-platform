<!--
  TrailsTuningTab.svelte

  Trail effect tuning with live preview: sequence picker/auto-chaining,
  TempoControl + TransportControls for playback, appearance (line width,
  opacity, glow), and behavior (fade duration, tracking mode, hide props).
  Two-column layout matching Fire/LED tabs. Settings persist via the shared
  animationSettings singleton.
-->
<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import TempoControl from "$lib/shared/sequence-viewer/components/TempoControl.svelte";
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { ISequenceRepository } from "$lib/features/create/shared/services/contracts/ISequenceRepository";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { container } from "$lib/shared/di";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import { TrackingMode } from "$lib/shared/animation-engine/domain/types/TrailTypes";
  import { simplifyAndTruncate } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";

  import { AnimationPlaybackController } from "$lib/features/compose/services/implementations/AnimationPlaybackController";
  import { SequenceAnimationOrchestrator } from "$lib/features/compose/services/implementations/SequenceAnimationOrchestrator";
  import { AnimationStateManager } from "$lib/features/compose/services/implementations/AnimationStateManager";
  import { AnimationLoop } from "$lib/features/compose/services/implementations/AnimationLoop";
  import { StepCalculator } from "$lib/features/compose/services/implementations/StepCalculator";

  // Auto-chaining
  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/implementations/EndlessSpinnerOrchestrator";
  import { InfiniteSequenceGenerator } from "$lib/features/landing/services/implementations/InfiniteSequenceGenerator";
  import { SpinnerMetricsRepository } from "$lib/features/landing/services/implementations/SpinnerMetricsRepository";
  import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
  import { SequenceChainingOrchestrator } from "../services/implementations/SequenceChainingOrchestrator";
  import type { ISequenceChainingOrchestrator, SourceMode } from "../services/contracts/ISequenceChainingOrchestrator";

  const DEFAULT_BPM = 60;
  const STORAGE_KEY = "trail-lab-state";

  interface TrailLabPersistedState {
    sequenceId: string | null;
    bpm: number;
    sourceMode: SourceMode;
  }

  function loadPersistedState(): Partial<TrailLabPersistedState> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  }

  function savePersistedState() {
    try {
      const state: TrailLabPersistedState = {
        sequenceId: sequence?.word || sequence?.name || sequence?.id || null,
        bpm,
        sourceMode,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }

  const persisted = loadPersistedState();

  // Reactive reads from the shared settings singleton
  let trail = $derived(animationSettings.trail);
  let enabled = $derived(trail.enabled);

  // Local reactive copies for slider binding (sliders need writable state)
  let fadeDuration = $state(animationSettings.trail.fadeDurationMs);
  let lineWidth = $state(animationSettings.trail.lineWidth);
  let minOpacity = $state(animationSettings.trail.minOpacity);
  let maxOpacity = $state(animationSettings.trail.maxOpacity);
  let glowBlur = $state(animationSettings.trail.glowBlur);

  // Sync local state back from the singleton when it changes externally
  $effect(() => {
    fadeDuration = animationSettings.trail.fadeDurationMs;
    lineWidth = animationSettings.trail.lineWidth;
    minOpacity = animationSettings.trail.minOpacity;
    maxOpacity = animationSettings.trail.maxOpacity;
    glowBlur = animationSettings.trail.glowBlur;
  });

  // Sequence + playback state
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
  let sourceMode = $state<SourceMode>(persisted.sourceMode ?? "infinite");

  const animationState = createAnimationPanelState();

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

  // Persist sequence/bpm/sourceMode
  $effect(() => {
    void bpm;
    void sequence;
    void sourceMode;
    untrack(() => savePersistedState());
  });

  // Watch for sequence completion → chain to next (library/infinite modes only)
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
      console.error("Trail Lab: failed to initialize:", err);
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
      console.error("Trail Lab: failed to restore sequence:", err);
      error = "Could not restore the previous session's sequence";
    } finally {
      loading = false;
    }
  }

  onDestroy(() => {
    if (playbackStartTimer !== null) clearTimeout(playbackStartTimer);
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
      console.error("Trail Lab: load failed:", err);
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

    if (mode === "pick") return;
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

  // Trail-specific handlers
  function handleEnabledToggle() {
    animationSettings.setTrailEnabled(!enabled);
  }

  function handleFadeDuration(ms: number) {
    fadeDuration = ms;
    animationSettings.setFadeDuration(ms);
  }

  function handleLineWidth(width: number) {
    lineWidth = width;
    animationSettings.setTrailAppearance({ lineWidth: width });
  }

  function handleMinOpacity(opacity: number) {
    minOpacity = opacity;
    animationSettings.setTrailAppearance({ minOpacity: opacity });
  }

  function handleMaxOpacity(opacity: number) {
    maxOpacity = opacity;
    animationSettings.setTrailAppearance({ maxOpacity: opacity });
  }

  function handleGlowBlur(blur: number) {
    glowBlur = blur;
    animationSettings.setTrailAppearance({ glowBlur: blur });
  }

  function handleTrackingMode(mode: TrackingMode) {
    animationSettings.setTrackingMode(mode);
  }

  function handleHideProps(hide: boolean) {
    animationSettings.setHideProps(hide);
  }

  const TRACKING_OPTIONS: { mode: TrackingMode; label: string; aria: string }[] = [
    { mode: TrackingMode.LEFT_END, label: "Left", aria: "Track left end only" },
    { mode: TrackingMode.RIGHT_END, label: "Right", aria: "Track right end only" },
    { mode: TrackingMode.BOTH_ENDS, label: "Both", aria: "Track both ends" },
  ];
</script>

<div class="tuning-tab">
  <div class="content">
    <!-- Canvas Area -->
    <div class="canvas-area">
      {#if !sequence && sourceMode === "pick"}
        <div class="empty-state">
          <i class="fas fa-wave-square" aria-hidden="true"></i>
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
          <TempoControl {bpm} onBpmChange={handleBpmChange} showPresets={false} showRamp={false} />
          <TransportControls
            {isPlaying}
            onPlaybackToggle={togglePlayback}
            onStepHalfBeatBackward={() => playbackController?.stepHalfBeatBackward()}
            onStepHalfBeatForward={() => playbackController?.stepHalfBeatForward()}
            onStepFullBeatBackward={() => playbackController?.stepFullBeatBackward()}
            onStepFullBeatForward={() => playbackController?.stepFullBeatForward()}
          />
        </div>
      {/if}

      <!-- Trail Effect Controls -->
      <div class="control-section trail-section">
        <h3>
          <i class="fas fa-wave-square" aria-hidden="true"></i>
          Trail Effect
          {#if enabled}
            <span class="active-label">Active</span>
          {/if}
        </h3>

        <div class="toggle-row">
          <span>Enabled</span>
          <button
            class="toggle-btn"
            class:active={enabled}
            onclick={handleEnabledToggle}
            aria-label={enabled ? "Disable trail effect" : "Enable trail effect"}
            aria-pressed={enabled}
          >
            {enabled ? "ON" : "OFF"}
          </button>
        </div>

        {#if enabled}
          <!-- Tracking mode -->
          <div class="renderer-toggle-section">
            <span class="section-label">Track end</span>
            <div class="renderer-toggle" role="radiogroup" aria-label="Tracking mode">
              {#each TRACKING_OPTIONS as opt (opt.mode)}
                <button
                  role="radio"
                  class="renderer-btn"
                  class:active={trail.trackingMode === opt.mode}
                  aria-checked={trail.trackingMode === opt.mode}
                  aria-label={opt.aria}
                  onclick={() => handleTrackingMode(opt.mode)}
                >
                  {opt.label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Hide props toggle -->
          <div class="toggle-row">
            <span>Hide props</span>
            <button
              class="toggle-btn"
              class:active={trail.hideProps}
              onclick={() => handleHideProps(!trail.hideProps)}
              aria-label={trail.hideProps ? "Show props" : "Hide props — trails only"}
              aria-pressed={trail.hideProps}
            >
              {trail.hideProps ? "ON" : "OFF"}
            </button>
          </div>
        {/if}
      </div>

      {#if enabled}
        <!-- Appearance card -->
        <div class="control-section">
          <h3>Appearance</h3>

          <div class="slider-group">
            <div class="slider-row">
              <label for="trail-line-width">Line width</label>
              <input
                id="trail-line-width"
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={lineWidth}
                oninput={(e) => handleLineWidth(parseFloat(e.currentTarget.value))}
                aria-label="Trail line width"
              />
              <span class="slider-value">{lineWidth.toFixed(1)}</span>
            </div>
          </div>

          <div class="slider-group">
            <div class="slider-row">
              <label for="trail-min-opacity">Min opacity</label>
              <input
                id="trail-min-opacity"
                type="range"
                min="0.0"
                max="0.5"
                step="0.05"
                value={minOpacity}
                oninput={(e) => handleMinOpacity(parseFloat(e.currentTarget.value))}
                aria-label="Trail minimum opacity (tail)"
              />
              <span class="slider-value">{(minOpacity * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div class="slider-group">
            <div class="slider-row">
              <label for="trail-max-opacity">Max opacity</label>
              <input
                id="trail-max-opacity"
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={maxOpacity}
                oninput={(e) => handleMaxOpacity(parseFloat(e.currentTarget.value))}
                aria-label="Trail maximum opacity (head)"
              />
              <span class="slider-value">{(maxOpacity * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div class="slider-group">
            <div class="slider-row">
              <label for="trail-glow-blur">Glow blur</label>
              <input
                id="trail-glow-blur"
                type="range"
                min="0"
                max="10"
                step="1"
                value={glowBlur}
                oninput={(e) => handleGlowBlur(parseInt(e.currentTarget.value, 10))}
                aria-label="Trail glow blur radius"
              />
              <span class="slider-value">{glowBlur}</span>
            </div>
          </div>
        </div>

        <!-- Behavior card -->
        <div class="control-section">
          <h3>Behavior</h3>

          <div class="slider-group">
            <div class="slider-row">
              <label for="trail-fade-duration">Fade duration</label>
              <input
                id="trail-fade-duration"
                type="range"
                min="500"
                max="5000"
                step="100"
                value={fadeDuration}
                oninput={(e) => handleFadeDuration(parseInt(e.currentTarget.value, 10))}
                aria-label="Trail fade duration in milliseconds"
              />
              <span class="slider-value">{(fadeDuration / 1000).toFixed(1)}s</span>
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
  title="Select Sequence for Trail Lab"
/>

<style>
  .tuning-tab {
    /* Trail domain color tokens */
    --trail-blue: #3b82f6;
    --trail-blue-bright: #60a5fa;
    --trail-blue-dim: rgba(59, 130, 246, 0.08);
    --trail-blue-mid: rgba(59, 130, 246, 0.15);
    --trail-blue-border: rgba(59, 130, 246, 0.3);
    --trail-blue-border-strong: rgba(59, 130, 246, 0.5);

    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .content {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 360px;
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
    color: var(--trail-blue-border);
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
    border: 1.5px solid var(--trail-blue-border);
    border-radius: var(--border-radius-md, 8px);
    background: var(--trail-blue-dim);
    color: var(--trail-blue);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .pick-btn:hover {
    background: var(--trail-blue-mid);
    border-color: var(--trail-blue-border-strong);
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

  .control-section h3 i {
    color: var(--trail-blue);
  }

  .control-section :global(.tempo-control) {
    justify-content: center;
  }

  .trail-section {
    border-color: var(--trail-blue-dim);
  }

  .active-label {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--trail-blue-bright);
    opacity: 0.7;
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
    background: var(--trail-blue-mid);
    color: var(--trail-blue-bright);
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

  /* Toggle rows */
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
    background: color-mix(in srgb, var(--theme-text) 5%, transparent);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    min-width: 56px;
    min-height: 44px;
  }

  .toggle-btn.active {
    background: linear-gradient(135deg, color-mix(in srgb, var(--trail-blue) 30%, transparent), color-mix(in srgb, var(--trail-blue) 15%, transparent));
    border-color: var(--trail-blue-border-strong);
    color: var(--trail-blue-bright);
  }

  .toggle-btn:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--theme-text) 30%, transparent);
  }

  .toggle-btn.active:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--trail-blue) 70%, transparent);
  }

  .toggle-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* Section label */
  .section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* Segmented toggle (tracking mode) */
  .renderer-toggle-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: var(--spacing-sm, 8px) 0;
  }

  .renderer-toggle {
    display: flex;
    gap: 6px;
  }

  .renderer-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 10px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    min-height: 36px;
  }

  .renderer-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .renderer-btn.active {
    background: var(--trail-blue-mid);
    border-color: var(--trail-blue-border-strong);
    color: var(--trail-blue-bright);
  }

  .renderer-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* Slider groups */
  .slider-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
    margin-top: var(--spacing-sm, 8px);
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    min-height: 44px;
  }

  .slider-row label {
    min-width: 120px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }

  .slider-row input[type="range"] {
    flex: 1;
    accent-color: var(--trail-blue);
    cursor: pointer;
  }

  .slider-value {
    min-width: 44px;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
  }

  @media (prefers-reduced-motion: reduce) {
    .pick-btn,
    .action-btn,
    .toggle-btn,
    .renderer-btn,
    .source-btn {
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
