<!--
  FlameLabTuningTab.svelte

  Extracted from FlameLabModule: sequence picker, playback controls,
  fire physics configuration, and the AnimatorCanvas preview.
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

  import { DEFAULT_FIRE_CONFIG, type FirePhysicsParams } from "$lib/shared/animation-engine/domain/types/FireTypes";
  import { FIRE_PRESETS } from "$lib/shared/animation-engine/domain/types/FirePresets";
  import type { FlameColorMode } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

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
  import type { IFireDefaultsPublisher } from "$lib/shared/animation-engine/services/contracts/IFireDefaultsPublisher";
  import type { IFirePointOverrideProvider } from "../services/contracts/IFirePointOverrideProvider";
  import { authState } from "$lib/shared/auth/state/authState.svelte";

  const DEFAULT_BPM = 60;
  const STORAGE_KEY = "flame-lab-state";
  const DEFAULT_PRESET_ID = "fire-spin";
  const visibilityManager = getAnimationVisibilityManager();

  let flameColorMode = $state<FlameColorMode>(visibilityManager.getFlameColorMode());

  function handleFlameColorModeChange(mode: FlameColorMode) {
    flameColorMode = mode;
    visibilityManager.setFlameColorMode(mode);
  }

  type SourceMode = "pick" | "library" | "infinite";

  interface FlameLabPersistedState {
    sequenceId: string | null;
    fireEnabled: boolean;
    intensity: number;
    flameHeight: number;
    trailLength: number;
    presetId: string;
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
        flameHeight,
        trailLength,
        presetId: activePresetId,
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
  let publishSuccessTimer: ReturnType<typeof setTimeout> | null = null;
  let showPicker = $state(false);
  let sequence = $state<SequenceData | null>(null);
  let isPlaying = $state(false);
  let bpm = $state(persisted.bpm ?? DEFAULT_BPM);

  // Fire starts disabled; restored after engine is ready to avoid the
  // race where the toggle shows ON but the WebGL renderer hasn't mounted.
  let fireEnabled = $state(false);
  let fireStateRestored = false;
  let intensity = $state(persisted.intensity ?? DEFAULT_FIRE_CONFIG.intensity);
  let flameHeight = $state(persisted.flameHeight ?? DEFAULT_FIRE_CONFIG.flameHeight);
  let trailLength = $state(persisted.trailLength ?? 1.0);
  let activePresetId = $state(persisted.presetId ?? DEFAULT_PRESET_ID);
  let sourceMode = $state<SourceMode>(persisted.sourceMode ?? "pick");

  // Auto-chaining state
  let spinnerOrchestrator: IEndlessSpinnerOrchestrator | null = null;
  let infiniteGenerator: IInfiniteSequenceGenerator | null = null;
  let preloadedSequence = $state<SequenceData | null>(null);
  let isPreloading = $state(false);
  let isChainingNow = $state(false);
  let lastStep = $state(-1);
  const propTypeApplier = new PropTypeApplier();

  // Publish-to-production state (admin only)
  let isAdmin = $derived(authState.isAdmin);
  let publishing = $state(false);
  let publishConfirm = $state(false);
  let publishSuccess = $state(false);

  let activePreset = $derived(FIRE_PRESETS.find(p => p.id === activePresetId) ?? FIRE_PRESETS[0]!);

  let adjustedPhysics = $derived.by((): FirePhysicsParams => {
    const base = activePreset.params;
    if (Math.abs(trailLength - 1.0) < 0.01) return base;

    const scaleDissipation = (d: number): number => {
      if (trailLength < 1.0) {
        const minD = d * 0.85;
        return minD + (d - minD) * trailLength;
      }
      const maxD = Math.min(d + (1.0 - d) * 0.5, 0.998);
      const t = trailLength - 1.0;
      return d + (maxD - d) * t;
    };

    const coolingScale = trailLength < 1.0
      ? 1.0 + (1.0 - trailLength) * 1.5
      : 1.0 / (1.0 + (trailLength - 1.0) * 0.8);

    return {
      ...base,
      velocityDissipation: scaleDissipation(base.velocityDissipation),
      temperatureDissipation: scaleDissipation(base.temperatureDissipation),
      fuelDissipation: scaleDissipation(base.fuelDissipation),
      coolingRate: base.coolingRate * coolingScale,
    };
  });

  let fireConfig = $derived({
    enabled: fireEnabled,
    intensity,
    flameHeight,
    velocityReactive: true,
    quality: 4,
    physicsPreset: adjustedPhysics,
  });

  const animationState = createAnimationPanelState();

  $effect(() => {
    visibilityManager.setFireEffect(fireEnabled);
  });

  // Restore persisted fire state AFTER the engine is ready and has a sequence.
  // This ensures the toggle change (false→true) fires after AnimatorCanvas has
  // mounted and the engine can actually create the WebGL fire overlay.
  $effect(() => {
    if (servicesReady && sequence && !fireStateRestored) {
      fireStateRestored = true;
      if (persisted.fireEnabled) {
        // Small delay lets the AnimatorCanvas $effect that passes fireConfig
        // to the engine settle before we flip the toggle.
        requestAnimationFrame(() => { fireEnabled = true; });
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
    void fireEnabled;
    void intensity;
    void flameHeight;
    void trailLength;
    void activePresetId;
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
      console.error("Flame Lab: preload failed:", err);
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
        console.error("Flame Lab: chain failed:", err);
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
      // generateInitial() uses no position constraint → random start
      const generated = await infiniteGenerator.generateInitial();
      if (generated) hotSwapSequence(generated.sequence);
    } catch (err) {
      console.error("Flame Lab: shuffle failed:", err);
      error = "Shuffle failed — could not generate a new sequence";
    } finally {
      isChainingNow = false;
    }
  }

  // Watch for sequence completion → chain to next (library/infinite modes only)
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
    visibilityManager.registerObserver(flameColorObserver);

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

  // Keep flameColorMode reactive state in sync with external changes
  // (e.g., if user changes it in the visibility tab while Flame Lab is open)
  const flameColorObserver = () => {
    flameColorMode = visibilityManager.getFlameColorMode();
  };

  onDestroy(() => {
    if (playbackStartTimer !== null) clearTimeout(playbackStartTimer);
    if (publishSuccessTimer !== null) clearTimeout(publishSuccessTimer);
    visibilityManager.setFireEffect(false);
    visibilityManager.unregisterObserver(flameColorObserver);
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
    preloadedSequence = null;
    lastStep = -1;

    if (mode === "pick") {
      // Stop auto-chaining, keep current sequence
      return;
    }
    // Start auto mode (library or infinite)
    startAutoMode();
  }

  async function publishToProduction() {
    publishing = true;
    try {
      const publisher = container.items.fireDefaultsPublisher as IFireDefaultsPublisher;
      const overrideProvider = container.items.firePointOverrideProvider as IFirePointOverrideProvider;

      await publisher.publish({
        firePoints: overrideProvider.exportAll(),
        propPhysics: {},
        globalPhysics: adjustedPhysics,
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
            <span class="active-preset-label">{activePreset.name}</span>
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
          <div class="color-mode-section">
            <span class="section-label">Color</span>
            <div class="color-mode-row">
              <button
                class="color-mode-btn"
                class:active={flameColorMode === "natural"}
                aria-pressed={flameColorMode === "natural"}
                aria-label="Use natural flame colors"
                onclick={() => handleFlameColorModeChange("natural")}
                type="button"
              >
                Natural
              </button>
              <button
                class="color-mode-btn"
                class:active={flameColorMode === "colored"}
                aria-pressed={flameColorMode === "colored"}
                aria-label="Use colored flame tints based on prop colors"
                onclick={() => handleFlameColorModeChange("colored")}
                type="button"
              >
                Colored
              </button>
            </div>
          </div>

          <div class="preset-grid">
            {#each FIRE_PRESETS as preset (preset.id)}
              <button
                class="preset-card"
                class:active={activePresetId === preset.id}
                onclick={() => (activePresetId = preset.id)}
                aria-pressed={activePresetId === preset.id}
                aria-label="Select {preset.name} fire preset"
              >
                <span class="preset-name">{preset.name}</span>
                <span class="preset-desc">{preset.description}</span>
              </button>
            {/each}
          </div>

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
              <label for="trail-slider">Trail Length</label>
              <input
                id="trail-slider"
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                bind:value={trailLength}
              />
              <span class="slider-value">{trailLength.toFixed(1)}x</span>
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

  .color-mode-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: var(--spacing-sm, 8px) 0 var(--spacing-md, 16px);
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .color-mode-row {
    display: flex;
    gap: 6px;
  }

  .color-mode-btn {
    flex: 1;
    padding: 7px 10px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: center;
  }

  .color-mode-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .color-mode-btn.active {
    background: var(--flame-orange-mid);
    border-color: var(--flame-orange-border-strong);
    color: var(--flame-orange-bright);
  }

  .color-mode-btn.active:hover {
    background: color-mix(in srgb, var(--flame-orange) 22%, transparent);
    border-color: color-mix(in srgb, var(--flame-orange) 65%, transparent);
  }

  .color-mode-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
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

  .active-preset-label {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--flame-orange-bright);
    opacity: 0.7;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-bottom: var(--spacing-md, 16px);
  }

  .preset-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 8px 10px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .preset-card:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .preset-card.active {
    background: var(--flame-orange-dim);
    border-color: var(--flame-orange-border-strong);
  }

  .preset-card:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .preset-name {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, white);
    line-height: 1.2;
  }

  .preset-card.active .preset-name {
    color: var(--flame-orange-bright);
  }

  .preset-desc {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    line-height: 1.2;
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
    min-width: 100px;
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
    .preset-card,
    .publish-btn,
    .confirm-btn,
    .cancel-btn {
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
