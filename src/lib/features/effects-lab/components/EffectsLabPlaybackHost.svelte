<!--
  EffectsLabPlaybackHost.svelte

  Single persistent component that owns all shared playback infrastructure
  for the Effects Lab. Canvas, playback services, and sequence state live here.
  Mode switching swaps only the controls panel — the animation continues
  uninterrupted.
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

  import { AnimationPlaybackController } from "$lib/features/compose/services/implementations/AnimationPlaybackController";
  import { SequenceAnimationOrchestrator } from "$lib/features/compose/services/implementations/SequenceAnimationOrchestrator";
  import { AnimationStateManager } from "$lib/features/compose/services/implementations/AnimationStateManager";
  import { AnimationLoop } from "$lib/features/compose/services/implementations/AnimationLoop";
  import { StepCalculator } from "$lib/features/compose/services/implementations/StepCalculator";

  import TempoControl from "$lib/shared/sequence-viewer/components/TempoControl.svelte";
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";

  // Fire
  import {
    BASE_FIRE_PHYSICS,
    BASE_COLOR_CURVE,
    intensityToPhysics,
  } from "$lib/shared/animation-engine/domain/types/FireTypes";

  // LED
  import { DEFAULT_LED_CONFIG, ledBrightnessToFloat, type LedOverlayConfig, type LedColorMode } from "$lib/shared/animation-engine/domain/types/LedTypes";

  // Charcoal
  import type { CharcoalSparkParams } from "$lib/shared/animation-engine/domain/types/CharcoalSparkTypes";
  import { DEFAULT_CHARCOAL_PARAMS } from "$lib/shared/animation-engine/domain/types/CharcoalSparkTypes";

  // Auto-chaining
  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/implementations/EndlessSpinnerOrchestrator";
  import { InfiniteSequenceGenerator } from "$lib/features/landing/services/implementations/InfiniteSequenceGenerator";
  import { SpinnerMetricsRepository } from "$lib/features/landing/services/implementations/SpinnerMetricsRepository";
  import { orientationCycleExtender } from "$lib/features/create/generate/circular/services/implementations/OrientationCycleExtender";
  import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
  import { SequenceChainingOrchestrator } from "$lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator";
  import type { ISequenceChainingOrchestrator, SourceMode } from "$lib/shared/animation-engine/services/contracts/ISequenceChainingOrchestrator";

  import { getEffectDescriptor, type EffectMode } from "../domain/EffectDescriptor";

  // Child control panels
  import FireControlsPanel from "./FireControlsPanel.svelte";
  import CharcoalControlsPanel from "./CharcoalControlsPanel.svelte";
  import LedControlPanel from "./LedControlPanel.svelte";
  import TrailControlsPanel from "./TrailControlsPanel.svelte";
  import SourceControls from "$lib/shared/animation-engine/components/SourceControls.svelte";
  import EffectModeBar from "./EffectModeBar.svelte";

  interface Props {
    activeMode: EffectMode;
    onModeChange: (mode: EffectMode) => void;
  }

  let { activeMode, onModeChange }: Props = $props();

  const DEFAULT_BPM = 60;
  const STORAGE_KEY = "effects-lab-state";
  const visibilityManager = getAnimationVisibilityManager();

  // ─── Unified persisted state ──────────────────────────────────────────
  interface EffectsLabPersistedState {
    sequenceId: string | null;
    bpm: number;
    sourceMode: SourceMode;
    // Fire
    fireIntensity: number;
    fireColorBlend: number;
    // LED
    ledBrightness: number;
    ledPatternId: string;
    ledPrimaryColor: string;
    ledPatternSpeed: number;
    ledGlowRadius: number;
    ledBloomIntensity: number;
    ledTrailFadeRate: number;
    ledColorMode: LedColorMode;
    ledBlueHandColor: string;
    ledRedHandColor: string;
  }

  function loadPersistedState(): Partial<EffectsLabPersistedState> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }

    // Migration: merge old per-mode keys into unified key
    return migrateOldKeys();
  }

  function migrateOldKeys(): Partial<EffectsLabPersistedState> {
    const merged: Partial<EffectsLabPersistedState> = {};
    try {
      const fireRaw = localStorage.getItem("flame-lab-state");
      if (fireRaw) {
        const fire = JSON.parse(fireRaw);
        merged.sequenceId = fire.sequenceId ?? null;
        merged.bpm = fire.bpm;
        merged.sourceMode = fire.sourceMode;
        merged.fireIntensity = fire.intensity;
        merged.fireColorBlend = fire.colorBlend;
      }

      const ledRaw = localStorage.getItem("led-lab-state");
      if (ledRaw) {
        const led = JSON.parse(ledRaw);
        merged.ledBrightness = led.brightness;
        merged.ledPatternId = led.patternId;
        merged.ledPrimaryColor = led.primaryColor;
        merged.ledPatternSpeed = led.patternSpeed;
        merged.ledGlowRadius = led.glowRadius;
        merged.ledBloomIntensity = led.bloomIntensity;
        merged.ledTrailFadeRate = led.trailFadeRate;
        merged.ledColorMode = led.colorMode;
        merged.ledBlueHandColor = led.blueHandColor;
        merged.ledRedHandColor = led.redHandColor;
        if (!merged.bpm && led.bpm) merged.bpm = led.bpm;
        if (!merged.sourceMode && led.sourceMode) merged.sourceMode = led.sourceMode;
        if (!merged.sequenceId && led.sequenceId) merged.sequenceId = led.sequenceId;
      }

      const trailRaw = localStorage.getItem("trail-lab-state");
      if (trailRaw) {
        const trail = JSON.parse(trailRaw);
        if (!merged.bpm && trail.bpm) merged.bpm = trail.bpm;
        if (!merged.sourceMode && trail.sourceMode) merged.sourceMode = trail.sourceMode;
        if (!merged.sequenceId && trail.sequenceId) merged.sequenceId = trail.sequenceId;
      }

      const charcoalRaw = localStorage.getItem("charcoal-lab-state");
      if (charcoalRaw) {
        const charcoal = JSON.parse(charcoalRaw);
        if (!merged.bpm && charcoal.bpm) merged.bpm = charcoal.bpm;
        if (!merged.sourceMode && charcoal.sourceMode) merged.sourceMode = charcoal.sourceMode;
        if (!merged.sequenceId && charcoal.sequenceId) merged.sequenceId = charcoal.sequenceId;
      }

      // Remove old keys after migration
      if (fireRaw || ledRaw || trailRaw || charcoalRaw) {
        localStorage.removeItem("flame-lab-state");
        localStorage.removeItem("led-lab-state");
        localStorage.removeItem("trail-lab-state");
        localStorage.removeItem("charcoal-lab-state");
        // Save merged state immediately
        if (Object.keys(merged).length > 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }
      }
    } catch { /* ignore migration errors */ }

    return merged;
  }

  function savePersistedState() {
    try {
      const state: EffectsLabPersistedState = {
        sequenceId: sequence?.word || sequence?.name || sequence?.id || null,
        bpm,
        sourceMode,
        fireIntensity: intensity,
        fireColorBlend: colorBlend,
        ledBrightness: ledBrightness,
        ledPatternId,
        ledPrimaryColor,
        ledPatternSpeed,
        ledGlowRadius,
        ledBloomIntensity,
        ledTrailFadeRate,
        ledColorMode,
        ledBlueHandColor,
        ledRedHandColor,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }

  const persisted = loadPersistedState();

  // ─── Shared playback state ────────────────────────────────────────────
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

  // ─── Fire state ───────────────────────────────────────────────────────
  let fireEnabled = $state(true);
  let intensity = $state(persisted.fireIntensity ?? 0.7);
  let colorBlend = $state(persisted.fireColorBlend ?? 0.5);

  let fireConfig = $derived.by(() => {
    const mergedPhysics = {
      ...BASE_FIRE_PHYSICS,
      ...intensityToPhysics(intensity),
    };
    return {
      enabled: fireEnabled,
      intensity: intensity * 0.8,
      flameHeight: intensity * 0.8,
      velocityReactive: true,
      quality: 4,
      fuelRendererType: "fluid" as const,
      physicsPreset: mergedPhysics,
      colorCurve: BASE_COLOR_CURVE,
      colorBlend,
    };
  });

  // ─── LED state ────────────────────────────────────────────────────────
  let ledBrightness = $state(persisted.ledBrightness ?? 5);
  let ledPatternId = $state(persisted.ledPatternId ?? DEFAULT_LED_CONFIG.patternId);
  let ledPrimaryColor = $state(persisted.ledPrimaryColor ?? DEFAULT_LED_CONFIG.primaryColor);
  let ledPatternSpeed = $state(persisted.ledPatternSpeed ?? DEFAULT_LED_CONFIG.patternSpeed);
  let ledGlowRadius = $state(persisted.ledGlowRadius ?? DEFAULT_LED_CONFIG.glowRadius);
  let ledBloomIntensity = $state(persisted.ledBloomIntensity ?? DEFAULT_LED_CONFIG.bloomIntensity);
  let ledTrailFadeRate = $state(persisted.ledTrailFadeRate ?? DEFAULT_LED_CONFIG.trailFadeRate);
  let ledColorMode = $state<LedColorMode>(persisted.ledColorMode ?? DEFAULT_LED_CONFIG.colorMode);
  let ledBlueHandColor = $state(persisted.ledBlueHandColor ?? DEFAULT_LED_CONFIG.blueHandColor);
  let ledRedHandColor = $state(persisted.ledRedHandColor ?? DEFAULT_LED_CONFIG.redHandColor);

  let ledConfig = $derived<LedOverlayConfig>({
    enabled: true,
    glowRadius: ledGlowRadius,
    bloomIntensity: ledBloomIntensity,
    trailFadeRate: ledTrailFadeRate,
    patternId: ledPatternId,
    patternSpeed: ledPatternSpeed,
    primaryColor: ledPrimaryColor,
    secondaryColor: "#ffffff",
    brightness: ledBrightnessToFloat(ledBrightness),
    colorMode: ledColorMode,
    blueHandColor: ledBlueHandColor,
    redHandColor: ledRedHandColor,
  });

  // ─── Charcoal state ───────────────────────────────────────────────────
  let charcoalParams = $state<CharcoalSparkParams>(visibilityManager.getCharcoalParams());

  // Sync charcoal params to visibility manager
  $effect(() => {
    const params = charcoalParams;
    untrack(() => visibilityManager.setCharcoalParams(params));
  });

  // ─── Derived descriptor for accent colors ─────────────────────────────
  let descriptor = $derived(getEffectDescriptor(activeMode));

  // ─── Animation state ──────────────────────────────────────────────────
  const animationState = createAnimationPanelState();

  // Save global effect states so we can restore them when leaving the Effects Lab.
  // The Effects Lab takes exclusive control of fire/LED/trail visibility.
  const savedFireEnabled = visibilityManager.isFireEffectEnabled();
  const savedCharcoalEnabled = visibilityManager.isCharcoalEffectEnabled();
  const savedLedEnabled = visibilityManager.isLedEffectEnabled();
  const savedTrailStyle = visibilityManager.getTrailStyle();

  // Suppress effects not matching the active mode.
  // The engine reads from the visibility manager independently of the config props,
  // so we must turn effects off at the source to prevent bleed-through.
  // Uses untrack() for writes because notifyObservers() triggers observer callbacks
  // that write to $state, causing infinite loops.
  $effect(() => {
    const mode = activeMode;
    untrack(() => {
      // Trails
      if (mode === "trails") {
        visibilityManager.setTrailStyle("on");
        animationSettings.setTrailEnabled(true);
      } else {
        visibilityManager.setTrailStyle("off");
      }

      // Fire
      if (mode === "fire") {
        visibilityManager.setFireEffect(true);
        visibilityManager.setCharcoalEffect(false);
        visibilityManager.setFireIntensity(intensity);
        visibilityManager.setFireColorBlend(colorBlend);
      } else if (mode === "charcoal") {
        visibilityManager.setCharcoalEffect(true);
        visibilityManager.setFireEffect(false);
      } else {
        visibilityManager.setFireEffect(false);
        visibilityManager.setCharcoalEffect(false);
      }

      // LED
      if (mode === "led") {
        visibilityManager.setLedEffect(true);
      } else {
        visibilityManager.setLedEffect(false);
      }
    });
  });

  // Fire visibility syncs — only push values when in fire mode.
  // Without the mode guard, fireEnabled ($state(true)) would re-enable fire
  // even after the mode-switch effect disables it for non-fire modes.
  $effect(() => {
    const val = fireEnabled;
    const mode = activeMode;
    if (mode === "fire") {
      untrack(() => visibilityManager.setFireEffect(val));
    }
  });
  $effect(() => {
    const mode = activeMode;
    if (mode !== "fire") return;
    const syncBack = () => {
      const managerState = visibilityManager.isFireEffectEnabled();
      if (managerState !== fireEnabled) fireEnabled = managerState;
    };
    visibilityManager.registerObserver(syncBack);
    return () => visibilityManager.unregisterObserver(syncBack);
  });
  $effect(() => {
    const val = intensity;
    const mode = activeMode;
    if (mode !== "fire") return;
    untrack(() => visibilityManager.setFireIntensity(val));
  });
  $effect(() => {
    const val = colorBlend;
    const mode = activeMode;
    if (mode !== "fire") return;
    untrack(() => visibilityManager.setFireColorBlend(val));
  });
  // Playback state polling
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

  // ─── Persistence ──────────────────────────────────────────────────────
  $effect(() => {
    // Touch all persisted values to track them
    void bpm;
    void sequence;
    void sourceMode;
    void intensity;
    void colorBlend;
    void ledBrightness;
    void ledPatternId;
    void ledPrimaryColor;
    void ledPatternSpeed;
    void ledGlowRadius;
    void ledBloomIntensity;
    void ledTrailFadeRate;
    void ledColorMode;
    void ledBlueHandColor;
    void ledRedHandColor;
    untrack(() => savePersistedState());
  });

  // ─── Auto-chaining ────────────────────────────────────────────────────
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

  // ─── Initialization ───────────────────────────────────────────────────
  onMount(async () => {
    window.addEventListener("keydown", handleKeydown);
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
        metricsRepo,
        orientationCycleExtender
      );

      chainingOrchestrator = new SequenceChainingOrchestrator(spinnerOrch, infiniteGen);
      chainingOrchestrator.onSequenceSwapped((seq) => { sequence = seq; });
      chainingOrchestrator.onError((msg) => { error = msg; });
      await chainingOrchestrator.initialize(playbackController, animationState);

      servicesReady = true;

      if (sourceMode === "pick") {
        const savedId = persisted.sequenceId;
        if (savedId && sequenceService) {
          restoreSequence(savedId);
        }
      } else {
        chainingOrchestrator.startAutoMode(sourceMode);
      }
    } catch (err) {
      console.error("Effects Lab: failed to initialize:", err);
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
      console.error("Effects Lab: failed to restore sequence:", err);
      error = "Could not restore the previous session's sequence";
    } finally {
      loading = false;
    }
  }

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeydown);
    if (playbackStartTimer !== null) clearTimeout(playbackStartTimer);
    chainingOrchestrator?.dispose();
    playbackController?.dispose();
    animationState.dispose();

    // Restore global effect states that were active before the Effects Lab took over
    visibilityManager.setFireEffect(savedFireEnabled);
    visibilityManager.setCharcoalEffect(savedCharcoalEnabled);
    visibilityManager.setLedEffect(savedLedEnabled);
    visibilityManager.setTrailStyle(savedTrailStyle);
  });

  // ─── Sequence loading ─────────────────────────────────────────────────
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
      console.error("Effects Lab: load failed:", err);
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

  // ─── Playback controls ────────────────────────────────────────────────
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

  // ─── Charcoal controls ────────────────────────────────────────────────
  function handleCharcoalParamChange(key: keyof CharcoalSparkParams, value: number | boolean) {
    charcoalParams = { ...charcoalParams, [key]: value };
  }

  function handleCharcoalReset() {
    charcoalParams = { ...DEFAULT_CHARCOAL_PARAMS };
  }

  // ─── Debug: copy current sequence data to clipboard ─────────────
  let debugToast = $state<string | null>(null);
  let debugToastTimer: ReturnType<typeof setTimeout> | null = null;

  function captureSequenceDebugData() {
    const seqData = animationState.sequenceData;
    if (!seqData) {
      showDebugToast("No sequence loaded");
      return;
    }

    const debugPayload = {
      word: seqData.word ?? seqData.name ?? "unknown",
      stepCount: seqData.steps?.length ?? 0,
      gridMode: seqData.gridMode,
      startPosition: seqData.startPosition,
      steps: seqData.steps?.map((step, i) => ({
        beat: i,
        letter: step.letter,
        startPosition: step.startPosition,
        endPosition: step.endPosition,
        motions: step.motions,
      })),
    };

    const json = JSON.stringify(debugPayload, null, 2);
    navigator.clipboard.writeText(json).then(
      () => showDebugToast(`Copied ${debugPayload.stepCount} steps`),
      () => showDebugToast("Clipboard write failed"),
    );
  }

  function showDebugToast(msg: string) {
    debugToast = msg;
    if (debugToastTimer) clearTimeout(debugToastTimer);
    debugToastTimer = setTimeout(() => { debugToast = null; }, 2000);
  }

  // ─── Keyboard shortcuts ────────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.code === "Space" && !e.repeat) {
      e.preventDefault();
      togglePlayback();
    }

    // Press D to capture current sequence data to clipboard for debugging
    if (e.code === "KeyD" && !e.repeat) {
      e.preventDefault();
      captureSequenceDebugData();
    }
  }
</script>

<div class="playback-host">
  <div class="content">
    <!-- Canvas Area -->
    <div class="canvas-area">
      {#if !sequence && sourceMode === "pick"}
        <div class="empty-state">
          <i class="{descriptor.icon}" style="color: {descriptor.accentColorBorder}" aria-hidden="true"></i>
          <p>Load a sequence to start</p>
          <button
            class="pick-btn"
            style="--accent: {descriptor.accentColor}; --accent-dim: {descriptor.accentColorMid}; --accent-border: {descriptor.accentColorBorder}"
            onclick={() => (showPicker = true)}
            aria-label="Pick a sequence to load"
          >
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
          <button
            class="pick-btn"
            style="--accent: {descriptor.accentColor}; --accent-dim: {descriptor.accentColorMid}; --accent-border: {descriptor.accentColorBorder}"
            onclick={() => loadAnimation()}
            aria-label="Retry loading the sequence"
          >
            Retry
          </button>
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
            trailSettings={activeMode === "trails" ? animationSettings.trail : undefined}
            word={sequence?.word || sequence?.name || null}
            fireConfig={activeMode === "fire" || activeMode === "charcoal" ? fireConfig : undefined}
            ledConfig={activeMode === "led" ? ledConfig : undefined}
            backgroundAlpha={0}
            focused={true}
          />
        </div>
      {/if}
    </div>

    <!-- Controls Panel -->
    <div class="controls-panel themed-scrollbar">
      <EffectModeBar {activeMode} onModeChange={onModeChange} />

      <SourceControls
        {sourceMode}
        {sequence}
        isChainingNow={chainingOrchestrator?.isChainingNow ?? false}
        onSourceChange={handleSourceChange}
        onPick={() => (showPicker = true)}
        onSkip={handleSkip}
        onShuffle={handleShuffle}
      />

      <!-- Playback -->
      {#if sequence && !loading && !error}
        <div class="control-section">
          <h3>Playback</h3>
          <TempoControl {bpm} onBpmChange={handleBpmChange} showPresets={false} showPractice={false} />
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

      <!-- Mode-specific controls -->
      {#if activeMode === "fire"}
        <FireControlsPanel
          {intensity}
          {colorBlend}
          onIntensityChange={(v) => (intensity = v)}
          onColorBlendChange={(v) => (colorBlend = v)}
        />
      {:else if activeMode === "charcoal"}
        <CharcoalControlsPanel
          params={charcoalParams}
          onParamChange={handleCharcoalParamChange}
          onParamsReplace={(p) => { charcoalParams = { ...p }; }}
          onReset={handleCharcoalReset}
        />
      {:else if activeMode === "led"}
        <div class="control-section led-host">
          <LedControlPanel
            bind:brightness={ledBrightness}
            bind:patternId={ledPatternId}
            bind:primaryColor={ledPrimaryColor}
            bind:patternSpeed={ledPatternSpeed}
            bind:glowRadius={ledGlowRadius}
            bind:bloomIntensity={ledBloomIntensity}
            bind:trailFadeRate={ledTrailFadeRate}
            bind:colorMode={ledColorMode}
            bind:blueHandColor={ledBlueHandColor}
            bind:redHandColor={ledRedHandColor}
          />
        </div>
      {:else if activeMode === "trails"}
        <TrailControlsPanel />
      {/if}

    </div>
  </div>
</div>

<!-- Debug toast -->
{#if debugToast}
  <div class="debug-toast">{debugToast}</div>
{/if}

<!-- Sequence Picker Modal -->
<SequencePickerModal
  open={showPicker}
  onSelect={handleSequenceSelected}
  onClose={() => (showPicker = false)}
  title="Select Sequence for Effects Lab"
/>

<style>
  .playback-host {
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
    min-height: var(--min-touch-target);
    padding: 10px 20px;
    border: 1.5px solid var(--accent-border, rgba(255, 255, 255, 0.3));
    border-radius: var(--border-radius-md, 8px);
    background: var(--accent-dim, rgba(255, 255, 255, 0.08));
    color: var(--accent, white);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .pick-btn:hover {
    opacity: 0.85;
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
  }

  .control-section :global(.tempo-control) {
    justify-content: center;
  }

  /* LED host needs the color tokens for the child panel */
  .led-host {
    --led-green: #00ff88;
    --led-green-bright: #33ffaa;
    --led-green-dim: rgba(0, 255, 136, 0.08);
    --led-green-mid: rgba(0, 255, 136, 0.15);
    --led-green-border: rgba(0, 255, 136, 0.3);
    --led-green-border-strong: rgba(0, 255, 136, 0.5);
  }

  @media (prefers-reduced-motion: reduce) {
    .pick-btn {
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

  .debug-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85);
    color: #4fc3f7;
    padding: 8px 20px;
    border-radius: 8px;
    font-size: var(--font-size-sm, 14px);
    font-family: monospace;
    z-index: 9999;
    pointer-events: none;
    border: 1px solid rgba(79, 195, 247, 0.3);
  }
</style>
