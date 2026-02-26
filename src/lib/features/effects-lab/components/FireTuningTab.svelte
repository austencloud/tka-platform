<!--
  FireTuningTab.svelte

  Fire effect tuning: sequence picker, playback controls,
  fire physics configuration, and the AnimatorCanvas preview.
  Moved from flame-lab to effects-lab.
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
  import { simplifyAndTruncate } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";

  import { AnimationPlaybackController } from "$lib/features/compose/services/implementations/AnimationPlaybackController";
  import { SequenceAnimationOrchestrator } from "$lib/features/compose/services/implementations/SequenceAnimationOrchestrator";
  import { AnimationStateManager } from "$lib/features/compose/services/implementations/AnimationStateManager";
  import { AnimationLoop } from "$lib/features/compose/services/implementations/AnimationLoop";
  import { StepCalculator } from "$lib/features/compose/services/implementations/StepCalculator";

  import {
    BASE_FIRE_PHYSICS,
    BASE_COLOR_CURVE,
    DEFAULT_CHARCOAL_PARAMS,
    intensityToPhysics,
    smokeLevelToPhysics,
    smokeLevelToOpacity,
  } from "$lib/shared/animation-engine/domain/types/FireTypes";

  // Auto-chaining
  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/implementations/EndlessSpinnerOrchestrator";
  import { InfiniteSequenceGenerator } from "$lib/features/landing/services/implementations/InfiniteSequenceGenerator";
  import { SpinnerMetricsRepository } from "$lib/features/landing/services/implementations/SpinnerMetricsRepository";
  import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
  import { SequenceChainingOrchestrator } from "../services/implementations/SequenceChainingOrchestrator";
  import type { ISequenceChainingOrchestrator, SourceMode } from "../services/contracts/ISequenceChainingOrchestrator";

  import { authState } from "$lib/shared/auth/state/authState.svelte";

  const DEFAULT_BPM = 60;
  const STORAGE_KEY = "flame-lab-state";
  const visibilityManager = getAnimationVisibilityManager();

  interface FlameLabPersistedState {
    sequenceId: string | null;
    fireEnabled: boolean;
    intensity: number;
    colorBlend: number;
    smokeLevel: number;
    useCharcoal: boolean;
    bpm: number;
    sourceMode: SourceMode;
  }

  function loadPersistedState(): Partial<FlameLabPersistedState> {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  }

  function savePersistedState() {
    try {
      const state: FlameLabPersistedState = {
        sequenceId: sequence?.word || sequence?.name || sequence?.id || null,
        fireEnabled,
        intensity,
        colorBlend,
        smokeLevel,
        useCharcoal,
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
  let publishSuccessTimer: ReturnType<typeof setTimeout> | null = null;
  let showPicker = $state(false);
  let sequence = $state<SequenceData | null>(null);
  let isPlaying = $state(false);
  let bpm = $state(persisted.bpm ?? DEFAULT_BPM);

  // Initialize directly from persisted state. The WebGL renderer creation
  // is deferred via rAF inside syncFireOverlay, so there's no race — the
  // toggle shows the correct state immediately and the renderer catches up.
  let fireEnabled = $state(persisted.fireEnabled ?? false);
  let intensity = $state(persisted.intensity ?? 0.7);
  let colorBlend = $state(persisted.colorBlend ?? 0.5);
  let smokeLevel = $state(persisted.smokeLevel ?? 0.1);
  let useCharcoal = $state(persisted.useCharcoal ?? false);
  let sourceMode = $state<SourceMode>(persisted.sourceMode ?? "pick");

  function applyPreset(preset: { intensity: number; smokeLevel: number; colorBlend: number }) {
    intensity = preset.intensity;
    smokeLevel = preset.smokeLevel;
    colorBlend = preset.colorBlend;
  }

  // Publish-to-production state (admin only)
  let isAdmin = $derived(authState.isAdmin);
  let publishing = $state(false);
  let publishConfirm = $state(false);
  let publishSuccess = $state(false);

  let fireConfig = $derived.by(() => {
    const mergedPhysics = {
      ...BASE_FIRE_PHYSICS,
      ...intensityToPhysics(intensity),
      ...smokeLevelToPhysics(smokeLevel),
    };
    return {
      enabled: fireEnabled,
      intensity: 1.0,
      flameHeight: 1.0,
      velocityReactive: true,
      quality: 4,
      fuelRendererType: useCharcoal ? "particle" as const : "fluid" as const,
      physicsPreset: useCharcoal ? undefined : mergedPhysics,
      colorCurve: useCharcoal ? undefined : BASE_COLOR_CURVE,
      charcoalParams: useCharcoal ? DEFAULT_CHARCOAL_PARAMS : undefined,
      colorBlend,
      smokeOpacity: smokeLevelToOpacity(smokeLevel),
    };
  });

  const animationState = createAnimationPanelState();

  $effect(() => {
    visibilityManager.setFireEffect(fireEnabled);
  });

  // Sync back from visibility manager (e.g. hotkey Shift+F toggled it externally)
  $effect(() => {
    const syncBack = () => {
      const managerState = visibilityManager.isFireEffectEnabled();
      if (managerState !== fireEnabled) {
        fireEnabled = managerState;
      }
    };
    visibilityManager.registerObserver(syncBack);
    return () => visibilityManager.unregisterObserver(syncBack);
  });

  // Sync slider state to the global visibility manager
  $effect(() => {
    visibilityManager.setFireIntensity(intensity);
  });
  $effect(() => {
    visibilityManager.setFireColorBlend(colorBlend);
  });
  $effect(() => {
    visibilityManager.setFireSmokeLevel(smokeLevel);
  });
  $effect(() => {
    visibilityManager.setFireUseCharcoal(useCharcoal);
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
    void fireEnabled;
    void intensity;
    void colorBlend;
    void smokeLevel;
    void useCharcoal;
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
      console.error("Flame Lab: failed to initialize:", err);
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
      console.error("Flame Lab: failed to restore sequence:", err);
      error = "Could not restore the previous session's sequence";
    } finally {
      loading = false;
    }
  }

  onDestroy(() => {
    if (playbackStartTimer !== null) clearTimeout(playbackStartTimer);
    if (publishSuccessTimer !== null) clearTimeout(publishSuccessTimer);
    // NOTE: We intentionally do NOT call visibilityManager.setFireEffect(false) here.
    // This component unmounts when switching to the "Points" inner tab within the same
    // fire mode. Disabling the fire effect would kill the overlay. The EffectsLabModule
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

  async function publishToProduction() {
    publishing = true;
    try {
      const publisher = container.items.fireDefaultsPublisher;
      const overrideProvider = container.items.firePointOverrideProvider;

      // Publish fire point overrides as global defaults
      const mergedPhysics = {
        ...BASE_FIRE_PHYSICS,
        ...intensityToPhysics(intensity),
        ...smokeLevelToPhysics(smokeLevel),
      };
      await publisher.publish({
        firePoints: overrideProvider.exportAll(),
        propPhysics: {},
        globalPhysics: mergedPhysics,
      });

      publishConfirm = false;
      publishSuccess = true;
      if (publishSuccessTimer !== null) clearTimeout(publishSuccessTimer);
      publishSuccessTimer = setTimeout(() => { publishSuccess = false; publishSuccessTimer = null; }, 3000);
    } catch (err) {
      console.error("[FlameLabTuningTab] Publish failed:", err);
    } finally {
      publishing = false;
    }
  }
</script>

<div class="tuning-tab">
  <div class="content">
    <!-- Canvas Area -->
    <div class="canvas-area">
      {#if !sequence && sourceMode === "pick"}
        <div class="empty-state">
          <i class="fas fa-fire" aria-hidden="true"></i>
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
            {fireConfig}
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
          {#if fireEnabled}
            <span class="active-fuel-label">{useCharcoal ? "Charcoal" : "Fire"}</span>
          {/if}
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
          <!-- Fire / Charcoal toggle -->
          <div class="renderer-toggle-section">
            <span class="section-label">Type</span>
            <div class="renderer-toggle" role="radiogroup" aria-label="Fire renderer type">
              <button
                role="radio"
                class="renderer-btn"
                class:active={!useCharcoal}
                aria-checked={!useCharcoal}
                onclick={() => (useCharcoal = false)}
                type="button"
              >
                <i class="fas fa-fire" aria-hidden="true"></i>
                Fire
              </button>
              <button
                role="radio"
                class="renderer-btn"
                class:active={useCharcoal}
                aria-checked={useCharcoal}
                onclick={() => (useCharcoal = true)}
                type="button"
              >
                <i class="fas fa-meteor" aria-hidden="true"></i>
                Charcoal
              </button>
            </div>
          </div>

          <!-- Intensity slider -->
          <div class="slider-group">
            <div class="slider-row">
              <label for="intensity-slider">Intensity</label>
              <input
                id="intensity-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                bind:value={intensity}
                aria-label="Fire intensity"
              />
              <span class="slider-value">{(intensity * 100).toFixed(0)}%</span>
            </div>
          </div>

          <!-- Smoke slider (fluid fire only) -->
          {#if !useCharcoal}
            <div class="slider-group">
              <div class="slider-row">
                <label for="smoke-slider">Smoke</label>
                <input
                  id="smoke-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  bind:value={smokeLevel}
                  aria-label="Smoke level"
                />
                <span class="slider-value">{(smokeLevel * 100).toFixed(0)}%</span>
              </div>
            </div>
          {/if}

          <!-- Color blend slider -->
          <div class="slider-group">
            <div class="slider-row">
              <label for="color-blend-slider">Color</label>
              <input
                id="color-blend-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                bind:value={colorBlend}
                aria-label="Flame color blend: natural to prop-colored"
              />
              <span class="slider-value">{colorBlend < 0.1 ? "Natural" : colorBlend > 0.9 ? "Colored" : `${(colorBlend * 100).toFixed(0)}%`}</span>
            </div>
          </div>

          <!-- Quick presets -->
          <div class="presets-section">
            <span class="section-label">Presets</span>
            <div class="presets-row">
              <button
                class="preset-btn"
                onclick={() => applyPreset({ intensity: 0.8, smokeLevel: 0.05, colorBlend: 0 })}
                type="button"
                aria-label="Apply clean burn preset"
              >
                Clean Burn
              </button>
              <button
                class="preset-btn"
                onclick={() => applyPreset({ intensity: 0.6, smokeLevel: 0.7, colorBlend: 0 })}
                type="button"
                aria-label="Apply smoky fire preset"
              >
                Smoky
              </button>
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

      <!-- Publish to Production (admin only) -->
      {#if isAdmin}
        <div class="publish-section">
          {#if publishSuccess}
            <div class="publish-success">
              <i class="fas fa-check-circle" aria-hidden="true"></i>
              Published to all users
            </div>
          {:else if !publishConfirm}
            <button class="publish-btn" onclick={() => publishConfirm = true} aria-label="Publish fire settings to production">
              <i class="fas fa-upload" aria-hidden="true"></i>
              Publish to Production
            </button>
          {:else}
            <div class="publish-confirm">
              <span class="publish-confirm-text">Push these fire settings to all users?</span>
              <button class="confirm-btn" onclick={publishToProduction} disabled={publishing} aria-label={publishing ? "Publishing in progress" : "Confirm publish to production"}>
                {publishing ? "Publishing..." : "Yes, Publish"}
              </button>
              <button class="cancel-btn" onclick={() => publishConfirm = false} aria-label="Cancel publish">Cancel</button>
            </div>
          {/if}
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
  .tuning-tab {
    /* Flame Lab domain color tokens */
    --flame-orange: #f97316;
    --flame-orange-bright: #fb923c;
    --flame-orange-dim: rgba(249, 115, 22, 0.08);
    --flame-orange-mid: rgba(249, 115, 22, 0.15);
    --flame-orange-border: rgba(249, 115, 22, 0.3);
    --flame-orange-border-strong: rgba(249, 115, 22, 0.5);
    --flame-green: rgb(16, 185, 129);
    --flame-green-dim: rgba(16, 185, 129, 0.1);
    --flame-green-border: rgba(16, 185, 129, 0.3);
    --flame-green-border-strong: rgba(16, 185, 129, 0.5);
    /* Text color for buttons with solid semantic backgrounds (accessibility) */
    --color-on-semantic: #000000;

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
    color: var(--flame-orange-border);
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
    border: 1.5px solid var(--flame-orange-border);
    border-radius: var(--border-radius-md, 8px);
    background: var(--flame-orange-dim);
    color: var(--flame-orange);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .pick-btn:hover {
    background: var(--flame-orange-mid);
    border-color: var(--flame-orange-border-strong);
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
    color: var(--flame-orange);
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
    background: var(--flame-orange-mid);
    color: var(--flame-orange-bright);
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
    border: 1.5px solid var(--flame-green-border);
    border-radius: var(--border-radius-md, 8px);
    background: var(--flame-green-dim);
    color: var(--flame-green);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .play-btn:hover {
    background: color-mix(in srgb, var(--flame-green) 20%, transparent);
    border-color: var(--flame-green-border-strong);
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
    accent-color: var(--flame-orange);
  }

  .bpm-value {
    min-width: 32px;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
  }

  .fire-section {
    border-color: var(--flame-orange-dim);
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
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
    background: color-mix(in srgb, var(--theme-text) 5%, transparent);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    min-width: 56px;
  }

  .toggle-btn.active {
    background: linear-gradient(135deg, color-mix(in srgb, var(--flame-orange) 30%, transparent), var(--semantic-error-dim, rgba(239, 68, 68, 0.3)));
    border-color: var(--flame-orange-border-strong);
    color: var(--flame-orange-bright);
  }

  .toggle-btn:hover {
    border-color: color-mix(in srgb, var(--theme-text) 30%, transparent);
  }

  .toggle-btn.active:hover {
    border-color: color-mix(in srgb, var(--flame-orange) 70%, transparent);
  }

  .active-fuel-label {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--flame-orange-bright);
    opacity: 0.7;
  }

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
    background: var(--flame-orange-mid);
    border-color: var(--flame-orange-border-strong);
    color: var(--flame-orange-bright);
  }

  .renderer-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .presets-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: var(--spacing-sm, 8px);
  }

  .presets-row {
    display: flex;
    gap: 6px;
  }

  .preset-btn {
    flex: 1;
    padding: 8px 10px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .preset-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .preset-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

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
    min-width: 120px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .slider-row input[type="range"] {
    flex: 1;
    accent-color: var(--flame-orange);
  }

  .slider-value {
    min-width: 44px;
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

  .publish-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .publish-btn {
    width: 100%;
    padding: 10px 16px;
    background: var(--semantic-warning, #f59e0b);
    color: var(--color-on-semantic, #000000);
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: opacity 150ms ease;
  }

  .publish-btn:hover {
    opacity: 0.9;
  }

  .publish-success {
    padding: 10px 16px;
    background: var(--semantic-success-dim, rgba(34, 197, 94, 0.15));
    color: var(--semantic-success, #22c55e);
    border: 1px solid var(--semantic-success, #22c55e);
    border-radius: 8px;
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .publish-confirm {
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }

  .publish-confirm-text {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
  }

  .confirm-btn {
    padding: 10px;
    background: var(--semantic-success, #22c55e);
    color: var(--color-on-semantic, #000000);
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .confirm-btn:hover {
    opacity: 0.9;
  }

  .confirm-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .cancel-btn {
    padding: 8px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .cancel-btn:hover {
    opacity: 0.8;
  }

  @media (prefers-reduced-motion: reduce) {
    .pick-btn,
    .action-btn,
    .play-btn,
    .toggle-btn,
    .publish-btn,
    .confirm-btn,
    .cancel-btn,
    .renderer-btn,
    .preset-btn {
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
