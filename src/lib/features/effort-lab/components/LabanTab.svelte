<!--
  LabanTab.svelte

  Core orchestration component for the Laban tab. Drives 4 synchronized
  animation canvases (one per Weight x Time quadrant) through a shared RAF loop.
  Each quadrant applies applyLabanEasing(stepProgress, weight, time) to get its
  own eased progress before interpolation.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import SourceControls from "$lib/features/effects-lab/components/SourceControls.svelte";
  import TempoControl from "$lib/shared/sequence-viewer/components/TempoControl.svelte";
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
  import type { SourceMode } from "$lib/features/effects-lab/services/contracts/ISequenceChainingOrchestrator";

  import { AngleCalculator } from "$lib/features/compose/services/implementations/AngleCalculator";
  import { MotionCalculator } from "$lib/features/compose/services/implementations/MotionCalculator";
  import { EndpointCalculator } from "$lib/features/compose/services/implementations/EndpointCalculator";
  import { PropInterpolator } from "$lib/features/compose/services/implementations/PropInterpolator";
  import { StepCalculator } from "$lib/features/compose/services/implementations/StepCalculator";

  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/implementations/EndlessSpinnerOrchestrator";
  import { InfiniteSequenceGenerator } from "$lib/features/landing/services/implementations/InfiniteSequenceGenerator";
  import { SpinnerMetricsRepository } from "$lib/features/landing/services/implementations/SpinnerMetricsRepository";
  import { orientationCycleExtender } from "$lib/features/create/generate/circular/services/implementations/OrientationCycleExtender";
  import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
  import { container } from "$lib/shared/di";
  import type { IEndlessSpinnerOrchestrator, EndState } from "$lib/features/landing/services/contracts/IEndlessSpinnerOrchestrator";
  import type { IInfiniteSequenceGenerator } from "$lib/features/landing/services/contracts/IInfiniteSequenceGenerator";
  import { MotionColor, type Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  import { LABAN_QUADRANTS, analyzeSequenceLabanProfile, getBeatSpaceQuality } from "../domain/laban-actions";
  import type { SpaceQuality, SequenceLabanProfile } from "../domain/laban-actions";
  import { applyLabanEasing } from "../domain/laban-easing";
  import LabanMatrixGrid from "./LabanMatrixGrid.svelte";
  import SequenceAnalysisBar from "./SequenceAnalysisBar.svelte";

  // ─── Persistence ─────────────────────────────────────────────────────
  const STORAGE_KEY = "effort-lab-laban-state";

  interface LabanPersistedState {
    sequenceId: string | null;
    bpm: number;
    sourceMode: SourceMode;
    quadrantParams: Record<string, { weight: number; time: number }>;
  }

  function loadPersistedState(): Partial<LabanPersistedState> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  }

  function savePersistedState() {
    try {
      const state: LabanPersistedState = {
        sequenceId: sequence?.word || sequence?.name || sequence?.id || null,
        bpm,
        sourceMode,
        quadrantParams,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }

  const persisted = loadPersistedState();

  // ─── Default PropState (all zeroes) ───────────────────────────────────
  const DEFAULT_PROP_STATE: PropState = {
    centerPathAngle: 0,
    staffRotationAngle: 0,
  };

  // ─── Services (constructed fresh, not DI singletons) ──────────────────
  let propInterpolator: PropInterpolator;
  let stepCalculator: StepCalculator;

  // ─── Playback state ───────────────────────────────────────────────────
  let timePosition = $state(0);
  let isPlaying = $state(false);
  let bpm = $state(persisted.bpm ?? 60);
  let rafId: number | null = null;
  let lastTime: number | null = null;

  // ─── Source mode ──────────────────────────────────────────────────────
  let sourceMode = $state<SourceMode>(persisted.sourceMode ?? "pick");
  let loading = $state(false);
  let isChainingNow = $state(false);

  // ─── Sequence source services (initialized in onMount) ──────────────
  let spinnerOrchestrator: IEndlessSpinnerOrchestrator | null = null;
  let infiniteGenerator: IInfiniteSequenceGenerator | null = null;

  // ─── Sequence state ───────────────────────────────────────────────────
  let showPicker = $state(false);
  let sequence = $state<SequenceData | null>(null);
  let steps = $state<readonly StepData[]>([]);
  let currentStepData = $state<StepData | null>(null);
  let currentStep = $state(0);
  let currentLetter = $state<Letter | null>(null);

  // ─── Laban-specific state ─────────────────────────────────────────────
  const defaultQuadrantParams = Object.fromEntries(
    LABAN_QUADRANTS.map(q => [q.id, { weight: q.defaultWeight, time: q.defaultTime }])
  );
  let quadrantParams = $state<Record<string, { weight: number; time: number }>>(
    persisted.quadrantParams
      ? { ...defaultQuadrantParams, ...persisted.quadrantParams }
      : defaultQuadrantParams
  );

  let quadrantPropStates = $state<Record<string, { blue: PropState; red: PropState }>>(
    Object.fromEntries(
      LABAN_QUADRANTS.map(q => [q.id, { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE } }])
    )
  );

  let currentSpace = $state<SpaceQuality>("neutral");
  let labanProfile = $state<SequenceLabanProfile | null>(null);

  // ─── Derived ──────────────────────────────────────────────────────────
  let gridMode = $derived(sequence?.gridMode ?? GridMode.DIAMOND);
  let sequenceWord = $derived(sequence?.word ?? sequence?.name ?? null);

  // ─── Auto-save on state changes ──────────────────────────────────────
  $effect(() => {
    void bpm;
    void sourceMode;
    void quadrantParams;
    void sequence;
    savePersistedState();
  });

  // ─── Restore sequence by ID ─────────────────────────────────────────
  async function restoreSequence(id: string) {
    try {
      const sequenceRepository = container.items.sequenceRepository;
      const loaded = await sequenceRepository.getSequence(id);
      if (loaded) {
        handleSequenceSelected(loaded);
      }
    } catch (err) {
      console.error("Laban Tab: failed to restore sequence:", err);
    }
  }

  // ─── Service construction ─────────────────────────────────────────────
  onMount(async () => {
    const angleCalculator = new AngleCalculator();
    const motionCalculator = new MotionCalculator();
    const endpointCalculator = new EndpointCalculator(angleCalculator, motionCalculator);
    propInterpolator = new PropInterpolator(angleCalculator, endpointCalculator);
    stepCalculator = new StepCalculator();

    const browseLoader = container.items.browseLoader;
    const generationOrchestrator = container.items.generationOrchestrator;
    const sequenceTransformer = container.items.sequenceTransformer;

    spinnerOrchestrator = new EndlessSpinnerOrchestrator(
      browseLoader,
      generationOrchestrator,
      sequenceTransformer,
      startPositionDeriver,
      orientationCalculator,
      gridPositionDeriver
    );
    await spinnerOrchestrator.initialize();

    const metricsRepo = new SpinnerMetricsRepository();
    infiniteGenerator = new InfiniteSequenceGenerator(
      generationOrchestrator,
      metricsRepo,
      orientationCycleExtender
    );

    rafId = requestAnimationFrame(onFrame);

    // Restore previous session state
    if (persisted.sequenceId) {
      restoreSequence(persisted.sequenceId);
    } else if (sourceMode !== "pick") {
      loadNextSequence();
    }
  });

  onDestroy(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });

  // ─── RAF loop ─────────────────────────────────────────────────────────
  function onFrame(timestamp: number) {
    if (!isPlaying || steps.length === 0) {
      lastTime = null;
      rafId = requestAnimationFrame(onFrame);
      return;
    }

    if (lastTime === null) {
      lastTime = timestamp;
      rafId = requestAnimationFrame(onFrame);
      return;
    }

    const deltaMs = timestamp - lastTime;
    lastTime = timestamp;

    const beatsPerMs = bpm / 60000;
    timePosition += deltaMs * beatsPerMs;

    const totalDur = stepCalculator.calculateTotalDuration(steps);
    if (timePosition >= totalDur) {
      timePosition = 0;

      if (sourceMode !== "pick") {
        loadNextSequence();
      }
    }

    updatePropStates();
    rafId = requestAnimationFrame(onFrame);
  }

  // ─── Per-frame state computation ──────────────────────────────────────
  function updatePropStates() {
    if (!propInterpolator || !stepCalculator) return;

    const { stepIndex, stepProgress } = stepCalculator.mapTimePositionToBeat(timePosition, steps);
    const stepData = steps[stepIndex];

    if (!stepData?.motions?.blue && !stepData?.motions?.red) return;

    currentStepData = stepData ?? null;
    currentStep = stepIndex + 1;
    currentLetter = stepData?.letter ?? null;

    // Update per-beat Space quality
    currentSpace = getBeatSpaceQuality(stepData);

    const updated = { ...quadrantPropStates };

    for (const quadrant of LABAN_QUADRANTS) {
      const params = quadrantParams[quadrant.id];
      if (!params) continue;
      const easedProgress = applyLabanEasing(stepProgress, params.weight, params.time);
      const result = propInterpolator.interpolatePropAngles(stepData!, easedProgress);

      if (result.isValid) {
        updated[quadrant.id] = {
          blue: result.blueAngles ?? { ...DEFAULT_PROP_STATE },
          red: result.redAngles ?? { ...DEFAULT_PROP_STATE },
        };
      }
    }

    quadrantPropStates = updated;
  }

  // ─── End-state extraction ─────────────────────────────────────────────
  function extractEndState(): EndState {
    if (!sequence || !steps.length) {
      return { position: null, blueOrientation: null, redOrientation: null };
    }

    const finalStep = steps[steps.length - 1];
    let position = finalStep?.endPosition ?? null;

    if (!position && finalStep?.motions) {
      const blueMotion = finalStep.motions[MotionColor.BLUE];
      const redMotion = finalStep.motions[MotionColor.RED];
      if (blueMotion?.endLocation && redMotion?.endLocation) {
        try {
          position = gridPositionDeriver.getGridPositionFromLocations(
            blueMotion.endLocation,
            redMotion.endLocation
          );
        } catch {
          /* silently fail */
        }
      }
    }

    if (!position && sequence.isCircular) {
      const startPos = sequence.startPosition ?? sequence.startingPosition;
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

  // ─── Sequence loading ─────────────────────────────────────────────────
  function handleSequenceSelected(seq: SequenceData) {
    showPicker = false;
    sequence = seq;
    steps = seq.steps ?? [];
    timePosition = 0;
    lastTime = null;

    // Analyze Laban profile
    labanProfile = analyzeSequenceLabanProfile(steps as StepData[]);

    if (steps.length > 0) {
      updatePropStates();
      isPlaying = true;
    }
  }

  async function loadNextSequence(): Promise<void> {
    if (loading || isChainingNow) return;

    loading = true;
    isChainingNow = true;
    try {
      let nextSeq: SequenceData | null = null;

      if (sourceMode === "library" && spinnerOrchestrator) {
        if (!sequence) {
          nextSeq = await spinnerOrchestrator.getInitialSequence();
        } else {
          const endState = extractEndState();
          nextSeq = await spinnerOrchestrator.getNextSequence(endState);
          if (!nextSeq) {
            nextSeq = await spinnerOrchestrator.getInitialSequence();
          }
        }
      } else if (sourceMode === "infinite" && infiniteGenerator) {
        if (!sequence) {
          const generated = await infiniteGenerator.generateInitial();
          nextSeq = generated?.sequence ?? null;
        } else {
          const endState = extractEndState();
          const generated = await infiniteGenerator.generateFromEndState(endState);
          nextSeq = generated?.sequence ?? null;
        }
      }

      if (nextSeq) {
        handleSequenceSelected(nextSeq);
      }
    } catch (err) {
      console.error("Laban Tab: failed to load next sequence:", err);
    } finally {
      loading = false;
      isChainingNow = false;
    }
  }

  async function handleShuffle(): Promise<void> {
    if (sourceMode === "pick" || !infiniteGenerator) return;

    loading = true;
    isChainingNow = true;
    try {
      const generated = await infiniteGenerator.generateInitial();
      if (generated) {
        handleSequenceSelected(generated.sequence);
      }
    } catch (err) {
      console.error("Laban Tab: shuffle failed:", err);
    } finally {
      loading = false;
      isChainingNow = false;
    }
  }

  function handleSkip(): void {
    if (sourceMode === "pick") return;
    loadNextSequence();
  }

  // ─── Controls ─────────────────────────────────────────────────────────
  function togglePlayback() {
    if (steps.length === 0) return;
    isPlaying = !isPlaying;
    if (!isPlaying) {
      lastTime = null;
    }
  }

  function handleBpmChange(newBpm: number) {
    bpm = newBpm;
  }

  function handleSourceChange(mode: SourceMode) {
    sourceMode = mode;

    if (mode !== "pick") {
      loadNextSequence();
    }
  }

  function handleQuadrantParamChange(quadrantId: string, key: "weight" | "time", value: number) {
    const existing = quadrantParams[quadrantId];
    if (!existing) return;
    quadrantParams = {
      ...quadrantParams,
      [quadrantId]: { weight: existing.weight, time: existing.time, [key]: value },
    };
  }

  function resetToDefaults() {
    quadrantParams = { ...defaultQuadrantParams };
  }

  let hasCustomParams = $derived(
    LABAN_QUADRANTS.some(q => {
      const current = quadrantParams[q.id];
      return current && (current.weight !== q.defaultWeight || current.time !== q.defaultTime);
    })
  );
</script>

<div class="laban-tab">
  <!-- Controls Bar -->
  <div class="controls-bar">
    <div class="controls-left">
      <SourceControls
        {sourceMode}
        {sequence}
        {isChainingNow}
        onSourceChange={handleSourceChange}
        onPick={() => (showPicker = true)}
        onSkip={handleSkip}
        onShuffle={handleShuffle}
      />
    </div>

    <div class="controls-right">
      {#if hasCustomParams}
        <button class="reset-btn" onclick={resetToDefaults} title="Reset sliders to defaults">
          <i class="fas fa-undo" aria-hidden="true"></i>
          Reset
        </button>
      {/if}
      <TempoControl
        {bpm}
        onBpmChange={handleBpmChange}
        showPresets={false}
        showRamp={false}
      />
      <TransportControls
        {isPlaying}
        onPlaybackToggle={togglePlayback}
      />
    </div>
  </div>

  <!-- Content -->
  {#if !sequence && sourceMode === "pick"}
    <div class="empty-state">
      <i class="fas fa-layer-group" aria-hidden="true"></i>
      <p>Pick a sequence to explore Laban effort actions</p>
    </div>
  {:else if !sequence && loading}
    <div class="empty-state">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <p>Loading sequence...</p>
    </div>
  {:else if !sequence}
    <div class="empty-state">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <p>Loading first sequence...</p>
    </div>
  {:else}
    <div class="content-area">
      <SequenceAnalysisBar profile={labanProfile} />
      <LabanMatrixGrid
        {quadrantPropStates}
        {gridMode}
        letter={currentLetter}
        stepData={currentStepData}
        {currentStep}
        {isPlaying}
        word={sequenceWord}
        {quadrantParams}
        onQuadrantParamChange={handleQuadrantParamChange}
      />
    </div>
  {/if}
</div>

<!-- Sequence Picker Modal -->
<SequencePickerModal
  open={showPicker}
  onSelect={handleSequenceSelected}
  onClose={() => (showPicker = false)}
  title="Select Sequence for Laban Actions"
/>

<style>
  .laban-tab {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .controls-bar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .reset-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reset-btn:hover {
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    background: rgba(255, 255, 255, 0.04);
  }

  .controls-left {
    flex-shrink: 0;
  }

  .controls-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 16px);
    flex-wrap: wrap;
  }

  .content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    overflow: hidden;
    padding: 12px 16px 0;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md, 16px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .empty-state i {
    font-size: 3rem;
    opacity: 0.4;
  }

  .empty-state p {
    font-size: var(--font-size-min, 14px);
    margin: 0;
  }
</style>
