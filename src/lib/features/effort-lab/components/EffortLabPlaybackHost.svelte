<!--
  EffortLabPlaybackHost.svelte

  Core orchestration component for the Effort Lab. Manages a shared RAF loop
  that drives 7 synchronized animation canvases, each applying a different
  Laban-inspired effort quality (easing function) to the same sequence.

  Owns:
  - Sequence loading via SequencePickerModal
  - A custom RAF loop producing timePosition
  - Per-frame computation of 7 PropState pairs via PropInterpolator
  - Controls bar (source picker, tempo, transport)
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { EffortQuality } from "../domain/effort-qualities";
  import { EFFORT_QUALITIES } from "../domain/effort-qualities";
  import { applyEffortEasing } from "../domain/effort-easing";
  import type { EffortParams } from "../domain/effort-easing";
  import EffortComparisonGrid from "./EffortComparisonGrid.svelte";
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

  // ─── Default PropState (all zeroes) ───────────────────────────────────
  const DEFAULT_PROP_STATE: PropState = {
    centerPathAngle: 0,
    staffRotationAngle: 0,
  };

  function createDefaultPropStates(): Record<EffortQuality, { blue: PropState; red: PropState }> {
    const result = {} as Record<EffortQuality, { blue: PropState; red: PropState }>;
    for (const descriptor of EFFORT_QUALITIES) {
      result[descriptor.id] = {
        blue: { ...DEFAULT_PROP_STATE },
        red: { ...DEFAULT_PROP_STATE },
      };
    }
    return result;
  }

  function createDefaultQualityParams(): Record<EffortQuality, EffortParams> {
    const result = {} as Record<EffortQuality, EffortParams>;
    for (const descriptor of EFFORT_QUALITIES) {
      const defaults: EffortParams = {};
      for (const p of descriptor.params) {
        defaults[p.key] = p.defaultValue;
      }
      result[descriptor.id] = defaults;
    }
    return result;
  }

  // ─── Services (constructed fresh, not DI singletons) ──────────────────
  let propInterpolator: PropInterpolator;
  let stepCalculator: StepCalculator;

  // ─── Playback state ───────────────────────────────────────────────────
  let timePosition = $state(0);
  let isPlaying = $state(false);
  let bpm = $state(120);
  let rafId: number | null = null;
  let lastTime: number | null = null;

  // ─── Source mode ──────────────────────────────────────────────────────
  let sourceMode = $state<SourceMode>("pick");

  // ─── Sequence state ───────────────────────────────────────────────────
  let showPicker = $state(false);
  let sequence = $state<SequenceData | null>(null);
  let steps = $state<readonly StepData[]>([]);
  let propStates = $state(createDefaultPropStates());
  let currentStepData = $state<StepData | null>(null);
  let currentStep = $state(0);
  let currentLetter = $state<Letter | null>(null);

  // ─── Quality params ───────────────────────────────────────────────────
  let qualityParams = $state(createDefaultQualityParams());

  // ─── Derived ──────────────────────────────────────────────────────────
  let gridMode = $derived(sequence?.gridMode ?? GridMode.DIAMOND);
  let sequenceWord = $derived(sequence?.word ?? sequence?.name ?? null);

  // ─── Service construction ─────────────────────────────────────────────
  onMount(() => {
    const angleCalculator = new AngleCalculator();
    const motionCalculator = new MotionCalculator();
    const endpointCalculator = new EndpointCalculator(angleCalculator, motionCalculator);
    propInterpolator = new PropInterpolator(angleCalculator, endpointCalculator);
    stepCalculator = new StepCalculator();

    rafId = requestAnimationFrame(onFrame);
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

    const updated = { ...propStates };

    for (const descriptor of EFFORT_QUALITIES) {
      const easedProgress = applyEffortEasing(descriptor.id, stepProgress, qualityParams[descriptor.id]);
      const result = propInterpolator.interpolatePropAngles(stepData!, easedProgress);

      if (result.isValid) {
        updated[descriptor.id] = {
          blue: result.blueAngles ?? { ...DEFAULT_PROP_STATE },
          red: result.redAngles ?? { ...DEFAULT_PROP_STATE },
        };
      }
    }

    propStates = updated;
  }

  // ─── Sequence loading ─────────────────────────────────────────────────
  function handleSequenceSelected(seq: SequenceData) {
    showPicker = false;
    sequence = seq;
    steps = seq.steps ?? [];
    timePosition = 0;
    lastTime = null;

    // Compute initial prop states from the first step
    if (steps.length > 0) {
      updatePropStates();
      isPlaying = true;
    }
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
    if (mode !== "pick") {
      console.warn(`Source mode "${mode}" not yet implemented in Effort Lab`);
    }
    sourceMode = mode;
  }

  function handleQualityParamsChange(quality: EffortQuality, params: EffortParams) {
    qualityParams = { ...qualityParams, [quality]: params };
  }
</script>

<div class="effort-playback-host">
  <!-- Controls Bar -->
  <div class="controls-bar">
    <div class="controls-left">
      <SourceControls
        {sourceMode}
        {sequence}
        isChainingNow={false}
        onSourceChange={handleSourceChange}
        onPick={() => (showPicker = true)}
        onSkip={() => console.warn("Skip not yet implemented in Effort Lab")}
        onShuffle={() => console.warn("Shuffle not yet implemented in Effort Lab")}
      />
    </div>

    <div class="controls-right">
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

  <!-- Grid Area -->
  <div class="grid-area">
    {#if !sequence}
      <div class="empty-state">
        <i class="fas fa-layer-group" aria-hidden="true"></i>
        <p>Pick a sequence to compare effort qualities</p>
      </div>
    {:else}
      <EffortComparisonGrid
        {propStates}
        {gridMode}
        letter={currentLetter}
        stepData={currentStepData}
        {currentStep}
        {isPlaying}
        word={sequenceWord}
        {qualityParams}
        onQualityParamsChange={handleQualityParamsChange}
      />
    {/if}
  </div>
</div>

<!-- Sequence Picker Modal -->
<SequencePickerModal
  open={showPicker}
  onSelect={handleSequenceSelected}
  onClose={() => (showPicker = false)}
  title="Select Sequence for Effort Lab"
/>

<style>
  .effort-playback-host {
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

  .controls-left {
    flex-shrink: 0;
  }

  .controls-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 16px);
    flex-wrap: wrap;
  }

  .grid-area {
    flex: 1;
    min-height: 0;
    display: flex;
    overflow: hidden;
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
