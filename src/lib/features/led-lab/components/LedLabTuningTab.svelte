<!--
  LedLabTuningTab.svelte

  LED version of FlameLabTuningTab: sequence picker, playback controls,
  LED overlay configuration, and the AnimatorCanvas preview.
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

  import { DEFAULT_LED_CONFIG, type LedOverlayConfig } from "$lib/shared/animation-engine/domain/types/LedTypes";
  import { LED_PATTERNS } from "$lib/shared/animation-engine/domain/types/LedPatterns";

  // Auto-chaining imports (Endless Spinner integration)
  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/implementations/EndlessSpinnerOrchestrator";
  import { InfiniteSequenceGenerator } from "$lib/features/landing/services/implementations/InfiniteSequenceGenerator";
  import { SpinnerMetricsRepository } from "$lib/features/landing/services/implementations/SpinnerMetricsRepository";
  import { PropTypeApplier } from "$lib/features/landing/services/implementations/PropTypeApplier";
  import type { IEndlessSpinnerOrchestrator, EndState } from "$lib/features/landing/services/contracts/IEndlessSpinnerOrchestrator";
  import type { IInfiniteSequenceGenerator } from "$lib/features/landing/services/contracts/IInfiniteSequenceGenerator";
  import type { IGenerationOrchestrator } from "$lib/features/create/generate/shared/services/contracts/IGenerationOrchestrator";
  import type { ISequenceTransformer } from "$lib/features/create/shared/services/contracts/ISequenceTransformer";
  import type { IBrowseLoader } from "$lib/features/browse/sequences/display/services/contracts/IBrowseLoader";
  import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  const DEFAULT_BPM = 60;
  const STORAGE_KEY = "led-lab-state";
  const visibilityManager = getAnimationVisibilityManager();

  type SourceMode = "pick" | "library" | "infinite";

  interface LedLabPersistedState {
    sequenceId: string | null;
    ledEnabled: boolean;
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
  let patternId = $state(persisted.patternId ?? DEFAULT_LED_CONFIG.patternId);
  let primaryColor = $state(persisted.primaryColor ?? DEFAULT_LED_CONFIG.primaryColor);
  let patternSpeed = $state(persisted.patternSpeed ?? DEFAULT_LED_CONFIG.patternSpeed);
  let glowRadius = $state(persisted.glowRadius ?? DEFAULT_LED_CONFIG.glowRadius);
  let bloomIntensity = $state(persisted.bloomIntensity ?? DEFAULT_LED_CONFIG.bloomIntensity);
  let trailFadeRate = $state(persisted.trailFadeRate ?? DEFAULT_LED_CONFIG.trailFadeRate);
  let sourceMode = $state<SourceMode>(persisted.sourceMode ?? "pick");

  // Auto-chaining state
  let spinnerOrchestrator: IEndlessSpinnerOrchestrator | null = null;
  let infiniteGenerator: IInfiniteSequenceGenerator | null = null;
  let preloadedSequence = $state<SequenceData | null>(null);
  let isPreloading = $state(false);
  let isChainingNow = $state(false);
  let lastStep = $state(-1);
  const propTypeApplier = new PropTypeApplier();

  let ledConfig = $derived<LedOverlayConfig>({
    enabled: ledEnabled,
    glowRadius,
    bloomIntensity,
    trailFadeRate,
    patternId,
    patternSpeed,
    primaryColor,
  });

  const animationState = createAnimationPanelState();

  $effect(() => {
    visibilityManager.setLedEffect(ledEnabled);
  });

  // Restore persisted LED state AFTER the engine is ready and has a sequence.
  // This ensures the toggle change (false->true) fires after AnimatorCanvas has
  // mounted and the engine can actually create the WebGL LED overlay.
  $effect(() => {
    if (servicesReady && sequence && !ledStateRestored) {
      ledStateRestored = true;
      if (persisted.ledEnabled) {
        // Small delay lets the AnimatorCanvas $effect that passes ledConfig
        // to the engine settle before we flip the toggle.
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

  // --- Auto-chaining logic (borrowed from Endless Spinner) ---

  function extractEndState(seq: SequenceData): EndState {
    const finalStep = seq.steps?.[seq.steps.length - 1];
    let position = finalStep?.endPosition ?? null;

    // Fallback 1: derive from motion end locations
    if (!position && gridPositionDeriver && finalStep?.motions) {
      const blueMotion = finalStep.motions[MotionColor.BLUE];
      const redMotion = finalStep.motions[MotionColor.RED];
      if (blueMotion?.endLocation && redMotion?.endLocation) {
        try {
          position = gridPositionDeriver.getGridPositionFromLocations(
            blueMotion.endLocation,
            redMotion.endLocation
          );
        } catch { /* silently fail */ }
      }
    }

    // Fallback 2: for circular sequences (LOOPs), end position = start position.
    // Use the sequence's start position data if available.
    if (!position && seq.isCircular) {
      const startPos = seq.startPosition ?? seq.startingPosition;
      if (startPos) {
        position = startPos.gridPosition ?? startPos.startPosition ?? null;
      }
    }

    return {
      position,
      blueOrientation: (finalStep?.motions?.blue?.endOrientation ?? null) as Orientation | null,
      redOrientation: (finalStep?.motions?.red?.endOrientation ?? null) as Orientation | null,
    };
  }

  function hotSwapSequence(sequenceData: SequenceData) {
    if (!playbackController) return;

    sequence = sequenceData;
    lastStep = -1;

    const applied = propTypeApplier.applyToSequence(sequenceData, PropType.STAFF);

    animationState.setShouldLoop(true);
    const ok = playbackController.initialize(applied, animationState);
    if (!ok) return;

    animationState.setPlaybackMode("continuous");
    // seekToStep syncs BOTH currentStep AND the controller's internal timePosition.
    // Using setCurrentStep(1) alone gets overridden by the animation loop which
    // reads from timePosition (still 0 after initialize), causing step 0 to flash.
    playbackController.seekToStep(1);

    if (!animationState.isPlaying) {
      playbackController.togglePlayback();
    }
  }

  async function preloadNextSequence() {
    if (!sequence || isPreloading || preloadedSequence) return;
    isPreloading = true;
    try {
      const endState = extractEndState(sequence);

      if (sourceMode === "infinite" && infiniteGenerator) {
        // Generate the next LOOP constrained to start at the current end position
        const generated = await infiniteGenerator.generateFromEndState(endState);
        preloadedSequence = generated?.sequence ?? null;
      } else if (sourceMode === "library" && spinnerOrchestrator) {
        const nextSeq = await spinnerOrchestrator.getNextSequence(endState);
        preloadedSequence = nextSeq ?? (await spinnerOrchestrator.getInitialSequence());
      }
    } catch (err) {
      console.error("LED Lab: preload failed:", err);
    } finally {
      isPreloading = false;
    }
  }

  function chainToNextSequence() {
    if (!playbackController || isChainingNow) return;

    // Synchronous swap from preloaded sequence — no visible step 0 gap
    if (preloadedSequence) {
      isChainingNow = true;
      hotSwapSequence(preloadedSequence);
      preloadedSequence = null;
      isChainingNow = false;
      // Immediately start preloading the NEXT sequence
      preloadNextSequence();
      return;
    }

    // Fallback: async generation if preload wasn't ready (rare)
    isChainingNow = true;
    (async () => {
      try {
        if (sourceMode === "infinite" && infiniteGenerator) {
          const endState = sequence ? extractEndState(sequence) : null;
          const generated = endState
            ? await infiniteGenerator.generateFromEndState(endState)
            : await infiniteGenerator.generateInitial();
          if (generated) hotSwapSequence(generated.sequence);
        } else if (sourceMode === "library" && spinnerOrchestrator) {
          if (sequence) {
            const endState = extractEndState(sequence);
            const nextSeq = await spinnerOrchestrator.getNextSequence(endState);
            if (nextSeq) hotSwapSequence(nextSeq);
          }
        }
      } catch (err) {
        console.error("LED Lab: chain failed:", err);
        error = "Failed to load next sequence";
      } finally {
        isChainingNow = false;
        // Start preloading for the next chain
        preloadNextSequence();
      }
    })();
  }

  async function startAutoMode() {
    if (sourceMode === "library" && spinnerOrchestrator) {
      const initial = await spinnerOrchestrator.getInitialSequence();
      if (initial) {
        hotSwapSequence(initial);
        preloadNextSequence();
      }
    } else if (sourceMode === "infinite" && infiniteGenerator) {
      const generated = await infiniteGenerator.generateInitial();
      if (generated) {
        hotSwapSequence(generated.sequence);
        preloadNextSequence();
      }
    }
  }

  function handleSkip() {
    if (sourceMode === "pick") return;
    chainToNextSequence();
  }

  /** Generate a new sequence from a random position, breaking the chain. */
  async function handleShuffle() {
    if (sourceMode === "pick" || !infiniteGenerator) return;
    isChainingNow = true;
    try {
      // generateInitial() uses no position constraint -> random start
      const generated = await infiniteGenerator.generateInitial();
      if (generated) hotSwapSequence(generated.sequence);
    } catch (err) {
      console.error("LED Lab: shuffle failed:", err);
      error = "Shuffle failed — could not generate a new sequence";
    } finally {
      isChainingNow = false;
    }
  }

  // Watch for sequence completion -> chain to next (library/infinite modes only)
  $effect(() => {
    if (sourceMode === "pick") return;

    const currentStep = Math.floor(animationState.currentStep);
    const totalSteps = animationState.totalSteps;

    if (
      servicesReady &&
      !isChainingNow &&
      sequence &&
      lastStep >= totalSteps - 1 &&
      currentStep <= 1 &&
      totalSteps > 0
    ) {
      chainToNextSequence();
    }

    lastStep = currentStep;
  });

  // Preload next sequence (library + infinite modes)
  // Start generation early so the swap is synchronous when the sequence ends.
  $effect(() => {
    if (sourceMode === "pick") return;

    const currentStep = Math.floor(animationState.currentStep);
    const totalSteps = animationState.totalSteps;

    const shouldPreload =
      servicesReady &&
      !isPreloading &&
      !preloadedSequence &&
      sequence &&
      totalSteps > 2 &&
      currentStep >= 2 &&
      currentStep < totalSteps - 1;

    if (shouldPreload) preloadNextSequence();
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
      const browseLoader = container.items.browseLoader as IBrowseLoader;
      const generationOrchestrator = container.items.generationOrchestrator as IGenerationOrchestrator;
      const sequenceTransformer = container.items.sequenceTransformer as ISequenceTransformer;

      spinnerOrchestrator = new EndlessSpinnerOrchestrator(
        browseLoader,
        generationOrchestrator,
        sequenceTransformer,
        startPositionDeriver,
        orientationCalculator,
        gridPositionDeriver
      );

      const metricsRepo = new SpinnerMetricsRepository();
      infiniteGenerator = new InfiniteSequenceGenerator(
        generationOrchestrator,
        metricsRepo
      );

      await spinnerOrchestrator.initialize();
      servicesReady = true;

      // Restore or auto-start based on source mode
      if (sourceMode === "pick") {
        const savedId = persisted.sequenceId;
        if (savedId && sequenceService) {
          restoreSequence(savedId);
        }
      } else {
        startAutoMode();
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
    visibilityManager.setLedEffect(false);
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
    preloadedSequence = null;
    lastStep = -1;

    if (mode === "pick") {
      // Stop auto-chaining, keep current sequence
      return;
    }
    // Start auto mode (library or infinite)
    startAutoMode();
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
            <button class="action-btn skip-btn" onclick={handleSkip} disabled={isChainingNow || !sequence} aria-label="Skip to the next sequence">
              <i class="fas fa-forward" aria-hidden="true"></i>
              Skip
            </button>
            {#if sourceMode === "infinite"}
              <button class="action-btn shuffle-btn" onclick={handleShuffle} disabled={isChainingNow || !sequence} aria-label="Shuffle to a random sequence">
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
      <div class="control-section led-section">
        <h3>
          <i class="fas fa-lightbulb" aria-hidden="true"></i>
          LED Effect
        </h3>

        <div class="toggle-row">
          <span>Enabled</span>
          <button
            class="toggle-btn"
            class:active={ledEnabled}
            onclick={() => (ledEnabled = !ledEnabled)}
            aria-label={ledEnabled ? "Disable LED effect" : "Enable LED effect"}
          >
            {ledEnabled ? "ON" : "OFF"}
          </button>
        </div>

        {#if ledEnabled}
          <div class="pattern-grid">
            {#each LED_PATTERNS as pattern (pattern.id)}
              <button
                class="pattern-card"
                class:active={patternId === pattern.id}
                onclick={() => (patternId = pattern.id)}
                aria-pressed={patternId === pattern.id}
                aria-label="Select {pattern.name} LED pattern"
              >
                <span class="pattern-name">{pattern.name}</span>
              </button>
            {/each}
          </div>

          <div class="slider-group">
            <div class="slider-row">
              <label for="color-picker">Color</label>
              <input id="color-picker" type="color" bind:value={primaryColor} />
              <span class="slider-value">{primaryColor}</span>
            </div>

            <div class="slider-row">
              <label for="pattern-speed-slider">Pattern Speed</label>
              <input
                id="pattern-speed-slider"
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                bind:value={patternSpeed}
              />
              <span class="slider-value">{patternSpeed.toFixed(1)}x</span>
            </div>

            <div class="slider-row">
              <label for="glow-radius-slider">Glow Radius</label>
              <input
                id="glow-radius-slider"
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                bind:value={glowRadius}
              />
              <span class="slider-value">{glowRadius.toFixed(1)}</span>
            </div>

            <div class="slider-row">
              <label for="bloom-intensity-slider">Bloom Intensity</label>
              <input
                id="bloom-intensity-slider"
                type="range"
                min="0"
                max="0.15"
                step="0.01"
                bind:value={bloomIntensity}
              />
              <span class="slider-value">{bloomIntensity.toFixed(2)}</span>
            </div>

            <div class="slider-row">
              <label for="trail-fade-slider">Trail Persistence</label>
              <input
                id="trail-fade-slider"
                type="range"
                min="0.80"
                max="0.98"
                step="0.01"
                bind:value={trailFadeRate}
              />
              <span class="slider-value">{trailFadeRate.toFixed(2)}</span>
            </div>
          </div>
        {/if}
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

  .control-section h3 i {
    color: var(--led-green);
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

  .led-section {
    border-color: var(--led-green-dim);
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
    background: linear-gradient(135deg, color-mix(in srgb, var(--led-green) 30%, transparent), color-mix(in srgb, var(--led-green) 15%, transparent));
    border-color: var(--led-green-border-strong);
    color: var(--led-green-bright);
  }

  .toggle-btn:hover {
    border-color: color-mix(in srgb, var(--theme-text) 30%, transparent);
  }

  .toggle-btn.active:hover {
    border-color: color-mix(in srgb, var(--led-green) 70%, transparent);
  }

  .pattern-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
    margin: var(--spacing-sm, 8px) 0 var(--spacing-md, 16px);
  }

  .pattern-card {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 10px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
    cursor: pointer;
    transition: all 150ms ease;
    text-align: center;
  }

  .pattern-card:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .pattern-card.active {
    background: var(--led-green-dim);
    border-color: var(--led-green-border-strong);
  }

  .pattern-card:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .pattern-name {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, white);
    line-height: 1.2;
  }

  .pattern-card.active .pattern-name {
    color: var(--led-green-bright);
  }

  .slider-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
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
    accent-color: var(--led-green);
  }

  .slider-row input[type="color"] {
    width: 36px;
    height: 28px;
    padding: 0;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: var(--border-radius-sm, 4px);
    background: transparent;
    cursor: pointer;
  }

  .slider-row input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  .slider-row input[type="color"]::-webkit-color-swatch {
    border: none;
    border-radius: 2px;
  }

  .slider-value {
    min-width: 54px;
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
    .play-btn,
    .toggle-btn,
    .pattern-card {
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
