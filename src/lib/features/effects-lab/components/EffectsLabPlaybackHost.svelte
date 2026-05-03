<!--
  EffectsLabPlaybackHost.svelte

  Single persistent component that owns all shared playback infrastructure
  for the Effects Lab. Canvas, playback services, and sequence state live here.
  The unified EffectsPanel handles effect selection and customization.
  The animation engine reads effect state directly from the visibility manager.
-->
<script lang="ts">

import { getPropInterpolator } from "$lib/features/compose/getPropInterpolator";
import { getGenerationOrchestrator } from "$lib/features/create/generate/shared/getGenerationOrchestrator";
import { getSequenceTransformer } from "$lib/features/create/shared/getSequenceTransformer";
  import { onMount, onDestroy, untrack } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { AnimationPlaybackController } from "$lib/features/compose/services/implementations/AnimationPlaybackController";
  import type { SequenceRepository } from "$lib/features/create/shared/services/implementations/SequenceRepository";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { getSequenceRepository } from "$lib/features/create/shared/getSequenceRepository";
  import { getSequenceLoopabilityChecker } from "$lib/features/compose/getSequenceLoopabilityChecker";
  import { getBrowseLoader } from "$lib/features/browse/sequences/display/getBrowseLoader";
  import { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";

  import { AnimationPlaybackController } from "$lib/features/compose/services/implementations/AnimationPlaybackController";
  import { SequenceAnimationOrchestrator } from "$lib/features/compose/services/implementations/SequenceAnimationOrchestrator";
  import { AnimationStateManager } from "$lib/features/compose/services/implementations/AnimationStateManager";
  import { AnimationLoop } from "$lib/features/compose/services/implementations/AnimationLoop";
  import { StepCalculator } from "$lib/features/compose/services/implementations/StepCalculator";

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

  import { getEffectDescriptor } from "../domain/EffectDescriptor";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";

  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
  import SourceControls from "$lib/shared/animation-engine/components/SourceControls.svelte";

  const DEFAULT_BPM = 60;
  const STORAGE_KEY = "effects-lab-state";
  const visibilityManager = getAnimationVisibilityManager();

  // Shared effects config state - single source of truth for per-effect intents
  // (zap, sparkles, echo, bloom today). The Customize panels write here via
  // getEffectsConfigContext(); the AnimatorCanvas reads the same state each
  // frame so slider changes flow straight to the canvas.
  const effectsConfigState = createEffectsConfigState();
  setEffectsConfigContext(effectsConfigState);

  // ─── Persisted state (playback only - effect params managed by VM) ────
  interface EffectsLabPersistedState {
    sequenceId: string | null;
    bpm: number;
    sourceMode: SourceMode;
  }

  function loadPersistedState(): Partial<EffectsLabPersistedState> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  }

  function savePersistedState() {
    try {
      const state: EffectsLabPersistedState = {
        sequenceId: sequence?.word || sequence?.name || sequence?.id || null,
        bpm,
        sourceMode,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }

  const persisted = loadPersistedState();

  // ─── Shared playback state ────────────────────────────────────────────
  let sequenceService: SequenceRepository | null = null;
  let playbackController: AnimationPlaybackController | null = null;
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

  // ─── Derive active mode from visibility manager for canvas/UI hints ────
  // The EffectsPanel writes to the VM; we read from it to know which mode
  // is active for the canvas conditional props and accent color theming.
  let vmActiveMode = $state<
    "fire" | "charcoal" | "led" | "trails" | "zap" | "sparkles" | "echo" | "bloom" | "water" | "bubbles" | "petals" | "smoke" | "ink" | "frost" | "silk" | "pulse" | "none"
  >("none");

  function syncActiveMode() {
    const active = visibilityManager.getActiveEffect();
    vmActiveMode = active === "none" ? "none" : active;
  }

  // Poll the VM to keep vmActiveMode in sync (the VM uses an observer
  // pattern but $effect doesn't auto-track method calls on plain objects).
  $effect(() => {
    syncActiveMode();
    visibilityManager.registerObserver(syncActiveMode);
    return () => visibilityManager.unregisterObserver(syncActiveMode);
  });

  let descriptor = $derived(getEffectDescriptor(
    vmActiveMode === "none" ? "trails" : vmActiveMode
  ));

  // ─── Animation state ──────────────────────────────────────────────────
  const animationState = createAnimationPanelState();

  // Save global effect states so we can restore them when leaving the Effects Lab.
  const savedEffectMap = { ...visibilityManager.getTipEffectMap() };

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
    void bpm;
    void sequence;
    void sourceMode;
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
      sequenceService = getSequenceRepository();
      const propInterpolator = getPropInterpolator();
      const loopabilityChecker = getSequenceLoopabilityChecker();
      const stateManager = new AnimationStateManager();
      const stepCalculator = new StepCalculator();
      const loop = new AnimationLoop();
      const animOrchestrator = new SequenceAnimationOrchestrator(
        stateManager, stepCalculator, propInterpolator
      );
      playbackController = new AnimationPlaybackController(
        animOrchestrator, loop, loopabilityChecker
      );

      const browseLoader = getBrowseLoader();
      const generationOrchestrator = getGenerationOrchestrator();
      const sequenceTransformer = getSequenceTransformer();

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
    visibilityManager.setTipEffectMap(savedEffectMap);
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

  let wasPlayingBeforeScrub = false;
  function handleScrubStart() {
    wasPlayingBeforeScrub = isPlaying;
    if (wasPlayingBeforeScrub) playbackController?.togglePlayback();
  }
  function handleScrubEnd() {
    if (wasPlayingBeforeScrub) playbackController?.togglePlayback();
    wasPlayingBeforeScrub = false;
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
          <span>Loading playback...</span>
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
            onProgressBarSeek={(step) => playbackController?.seekToStep(step)}
            onProgressBarScrubStart={handleScrubStart}
            onProgressBarScrubEnd={handleScrubEnd}
            word={sequence?.word || sequence?.name || null}
            backgroundAlpha={0}
            focused={true}
            trailSettings={animationSettings.trail}
            {effectsConfigState}
          />
        </div>
      {/if}
    </div>

    <!-- Controls Panel -->
    <div class="controls-panel themed-scrollbar">
      <SourceControls
        {sourceMode}
        {sequence}
        isChainingNow={chainingOrchestrator?.isChainingNow ?? false}
        onSourceChange={handleSourceChange}
        onPick={() => (showPicker = true)}
        onSkip={handleSkip}
        onShuffle={handleShuffle}
      />

      <EffectsPanel
        {bpm}
        onBpmChange={handleBpmChange}
        {isPlaying}
        onPlaybackToggle={togglePlayback}
        showTransport={false}
      />
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
    grid-template-columns: 1fr clamp(360px, 32vw, 520px);
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
    position: relative;
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
