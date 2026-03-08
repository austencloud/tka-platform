<!--
  EffortLabPlaybackHost.svelte

  Core orchestration component for the Effort Lab. Manages a shared RAF loop
  that drives 7 synchronized animation canvases, each applying a different
  Laban-inspired effort quality (easing function) to the same sequence.

  Owns:
  - Sequence loading via SequencePickerModal
  - A custom RAF loop producing timePosition
  - Per-frame computation of 7 PropState pairs via PropInterpolator
  - Controls bar (pick sequence, BPM, play/pause)
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
  import EffortComparisonGrid from "./EffortComparisonGrid.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";

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

  // ─── Services (constructed fresh, not DI singletons) ──────────────────
  let propInterpolator: PropInterpolator;
  let stepCalculator: StepCalculator;

  // ─── Playback state ───────────────────────────────────────────────────
  let timePosition = $state(0);
  let isPlaying = $state(false);
  let bpm = $state(120);
  let rafId: number | null = null;
  let lastTime: number | null = null;

  // ─── Sequence state ───────────────────────────────────────────────────
  let showPicker = $state(false);
  let sequence = $state<SequenceData | null>(null);
  let steps = $state<readonly StepData[]>([]);
  let propStates = $state(createDefaultPropStates());
  let currentStepData = $state<StepData | null>(null);
  let currentStep = $state(0);
  let currentLetter = $state<Letter | null>(null);

  // ─── Derived ──────────────────────────────────────────────────────────
  let gridMode = $derived(sequence?.gridMode ?? GridMode.DIAMOND);
  let sequenceWord = $derived(sequence?.word ?? sequence?.name ?? null);
  let beatCount = $derived(steps.length);

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
      const easedProgress = applyEffortEasing(descriptor.id, stepProgress);
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
</script>

<div class="effort-playback-host">
  <!-- Controls Bar -->
  <div class="controls-bar">
    <div class="controls-left">
      <button
        class="pick-btn"
        onclick={() => (showPicker = true)}
        aria-label="Pick a sequence to load"
      >
        <i class="fas fa-folder-open" aria-hidden="true"></i>
        Pick Sequence
      </button>

      {#if sequence}
        <div class="sequence-info">
          <span class="sequence-name">{sequenceWord}</span>
          <span class="beat-count">{beatCount} beats</span>
        </div>
      {/if}
    </div>

    <div class="controls-right">
      <label class="bpm-control">
        <span class="bpm-label">BPM</span>
        <input
          type="range"
          min="30"
          max="240"
          step="1"
          bind:value={bpm}
          class="bpm-slider"
          aria-label="Beats per minute"
        />
        <span class="bpm-value">{bpm}</span>
      </label>

      <button
        class="play-btn"
        onclick={togglePlayback}
        disabled={steps.length === 0}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
      </button>
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
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .controls-left,
  .controls-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
  }

  .pick-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    min-height: var(--min-touch-target, 44px);
    padding: 8px 16px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: border-color 150ms ease;
  }

  .pick-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
  }

  .pick-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .sequence-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
  }

  .sequence-name {
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .beat-count {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.7;
  }

  .bpm-control {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
  }

  .bpm-label {
    font-weight: 500;
  }

  .bpm-slider {
    width: 100px;
    accent-color: var(--theme-accent, #8b5cf6);
  }

  .bpm-value {
    min-width: 2.5ch;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
  }

  .play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    min-height: var(--min-touch-target, 44px);
    min-width: var(--min-touch-target, 44px);
    border: none;
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-accent, #8b5cf6);
    color: white;
    font-size: 16px;
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .play-btn:hover:not(:disabled) {
    opacity: 0.85;
  }

  .play-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .play-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
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

  @media (prefers-reduced-motion: reduce) {
    .pick-btn,
    .play-btn {
      transition: none;
    }
  }
</style>
