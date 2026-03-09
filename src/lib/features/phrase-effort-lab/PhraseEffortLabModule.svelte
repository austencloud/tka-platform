<!--
  PhraseEffortLabModule.svelte

  Orchestrator for the Phrase Effort Lab. Lets the user pick a sequence,
  paint effort phrases onto a beat timeline, preview the result with
  phrase-based easing in an AnimatorCanvas, and save the effort timeline
  back to the sequence.

  Layout:
    [Header + Sequence Picker + Save]
    [AnimatorCanvas preview]
    [EffortPalette brush selector]
    [PhraseTimeline — paint phrases]
    [Transition toggle: Hard | Blend]
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";
  import type { EffortTimeline } from "./domain/effort-timeline-types";
  import {
    createEffortTimeline,
    findPhraseAtBeat,
    removePhrase,
  } from "./domain/effort-timeline-types";
  import { PhraseInterpolator } from "./services/implementations/PhraseInterpolator";

  import { AngleCalculator } from "$lib/features/compose/services/implementations/AngleCalculator";
  import { MotionCalculator } from "$lib/features/compose/services/implementations/MotionCalculator";
  import { EndpointCalculator } from "$lib/features/compose/services/implementations/EndpointCalculator";
  import { PropInterpolator } from "$lib/features/compose/services/implementations/PropInterpolator";
  import { StepCalculator } from "$lib/features/compose/services/implementations/StepCalculator";

  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { doc, setDoc, serverTimestamp } from "firebase/firestore";
  import { getFirestoreInstance, getAuthSync } from "$lib/shared/auth/firebase";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import EffortPalette from "./components/EffortPalette.svelte";
  import PhraseTimeline from "./components/PhraseTimeline.svelte";
  import PhraseEasingCurveOverlay from "./components/PhraseEasingCurveOverlay.svelte";
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
  import TempoControl from "$lib/shared/sequence-viewer/components/TempoControl.svelte";
  import { libraryState } from "$lib/features/library/state/library-state.svelte";

  const SESSION_KEY = "phrase-effort-lab-sequence-id";

  // ─── Default PropState ───────────────────────────────────────────────
  const DEFAULT_PROP_STATE: PropState = {
    centerPathAngle: 0,
    staffRotationAngle: 0,
  };

  // ─── Services (constructed in onMount) ───────────────────────────────
  let propInterpolator: PropInterpolator;
  let stepCalculator: StepCalculator;
  const phraseInterpolator = new PhraseInterpolator();

  // ─── Core state ──────────────────────────────────────────────────────
  let selectedEffort: EffortId = $state("linear");
  let timeline: EffortTimeline = $state(createEffortTimeline());
  let selectedPhraseId: string | null = $state(null);
  let isPlaying = $state(true);
  let playbackBeat = $state(0); // fractional beat position (0-based continuous)

  // ─── Sequence state ──────────────────────────────────────────────────
  let showPicker = $state(false);
  let sequence = $state<SequenceData | null>(null);
  let steps = $state<readonly StepData[]>([]);
  let blueProp = $state<PropState>({ ...DEFAULT_PROP_STATE });
  let redProp = $state<PropState>({ ...DEFAULT_PROP_STATE });
  let currentStep = $state(0);
  let currentLetter = $state<import("$lib/shared/foundation/domain/models/Letter").Letter | null>(null);
  let currentStepData = $state<StepData | null>(null);
  let saving = $state(false);
  let saveStatus = $state<"idle" | "saved" | "error">("idle");

  // ─── Playback ────────────────────────────────────────────────────────
  const visibilityManager = getAnimationVisibilityManager();
  let bpm = $state(visibilityManager.getBpm());
  let rafId: number | null = null;
  let lastTime: number | null = null;

  // ─── Derived ─────────────────────────────────────────────────────────
  let gridMode = $derived(sequence?.gridMode ?? GridMode.DIAMOND);
  let sequenceWord = $derived(sequence?.word ?? sequence?.name ?? null);
  let totalBeats = $derived(steps.length);
  // 1-based current beat for the timeline playhead
  let currentBeatForTimeline = $derived(Math.floor(playbackBeat) + 1);
  let hasUnsavedChanges = $derived(
    sequence !== null && timeline.phrases.length > 0
  );

  // ─── Service construction ───────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedPhraseId) {
      e.preventDefault();
      handleDeleteSelected();
    }
  }

  onMount(() => {
    const angleCalculator = new AngleCalculator();
    const motionCalculator = new MotionCalculator();
    const endpointCalculator = new EndpointCalculator(angleCalculator, motionCalculator);
    propInterpolator = new PropInterpolator(angleCalculator, endpointCalculator);
    stepCalculator = new StepCalculator();

    document.addEventListener("keydown", handleKeydown);
    rafId = requestAnimationFrame(onFrame);

    // Restore last-used sequence from session
    try {
      const savedId = sessionStorage.getItem(SESSION_KEY);
      if (savedId) {
        const saved = libraryState.getSequenceById(savedId);
        if (saved) handleSequenceSelected(saved as unknown as SequenceData);
      }
    } catch { /* ignore */ }
  });

  onDestroy(() => {
    document.removeEventListener("keydown", handleKeydown);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });

  // ─── RAF loop ────────────────────────────────────────────────────────
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
    playbackBeat += deltaMs * beatsPerMs;

    if (playbackBeat >= totalBeats) {
      playbackBeat = 0;
    }

    updatePropStates();
    rafId = requestAnimationFrame(onFrame);
  }

  // ─── Per-frame state computation ────────────────────────────────────
  function updatePropStates() {
    if (!propInterpolator || !stepCalculator || steps.length === 0) return;

    // Check if the current beat falls within a phrase
    const beat1Based = playbackBeat + 1; // timeline uses 1-based beats
    const activePhrase = findPhraseAtBeat(timeline, beat1Based);

    let stepIndex: number;
    let localProgress: number;

    if (activePhrase) {
      // Use phrase interpolator for eased playback within phrases
      const result = phraseInterpolator.interpolate(
        activePhrase,
        beat1Based,
        steps.length,
      );
      stepIndex = result.stepIndex;
      localProgress = result.localProgress;
    } else {
      // No phrase covering this beat — use linear playback
      const mapped = stepCalculator.mapTimePositionToBeat(playbackBeat, steps);
      stepIndex = mapped.stepIndex;
      localProgress = mapped.stepProgress;
    }

    const stepData = steps[stepIndex];
    if (!stepData?.motions?.blue && !stepData?.motions?.red) return;

    currentStepData = stepData;
    currentStep = stepIndex + 1;
    currentLetter = stepData?.letter ?? null;

    const result = propInterpolator.interpolatePropAngles(stepData!, localProgress);
    if (result.isValid) {
      blueProp = result.blueAngles ?? { ...DEFAULT_PROP_STATE };
      redProp = result.redAngles ?? { ...DEFAULT_PROP_STATE };
    }
  }

  // ─── Sequence loading ───────────────────────────────────────────────
  function handleSequenceSelected(seq: SequenceData) {
    showPicker = false;
    sequence = seq;
    steps = seq.steps ?? [];
    playbackBeat = 0;
    lastTime = null;
    saveStatus = "idle";

    // Persist selection for tab re-entry
    if (seq.id) {
      try { sessionStorage.setItem(SESSION_KEY, seq.id); } catch { /* ignore */ }
    }

    // Restore existing effort timeline from the sequence if present
    if (seq.effortTimeline) {
      timeline = seq.effortTimeline;
    } else {
      timeline = createEffortTimeline();
    }

    // Compute initial prop states
    if (steps.length > 0) {
      updatePropStates();
      isPlaying = true;
    }
  }

  // ─── Controls ────────────────────────────────────────────────────────
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

  function handleTimelineChange(updated: EffortTimeline) {
    timeline = updated;
    saveStatus = "idle";
  }

  function handlePhraseSelect(id: string | null) {
    selectedPhraseId = id;
  }

  function handleTransitionToggle() {
    timeline = {
      ...timeline,
      transition: timeline.transition === "hard" ? "blend" : "hard",
      ...(timeline.transition === "hard" ? { blendBeats: 1 } : {}),
    };
    saveStatus = "idle";
  }

  function handleDeleteSelected() {
    if (!selectedPhraseId) return;
    timeline = removePhrase(timeline, selectedPhraseId);
    selectedPhraseId = null;
    saveStatus = "idle";
  }

  function handleClearTimeline() {
    timeline = createEffortTimeline();
    selectedPhraseId = null;
    saveStatus = "idle";
  }

  // ─── Save ────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!sequence?.id || saving) return;

    const user = getAuthSync().currentUser;
    if (!user) {
      toast.error("Sign in to save effort timelines.");
      return;
    }

    saving = true;
    try {
      const firestore = await getFirestoreInstance();
      const sequenceRef = doc(
        firestore,
        `users/${user.uid}/sequences/${sequence.id}`,
      );
      await setDoc(
        sequenceRef,
        {
          effortTimeline: timeline,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      sequence = { ...sequence, effortTimeline: timeline };
      saveStatus = "saved";
      toast.success("Effort timeline saved.");
    } catch (err) {
      console.error("PhraseEffortLab: failed to save effort timeline:", err);
      saveStatus = "error";
      toast.error("Failed to save effort timeline.");
    } finally {
      saving = false;
    }
  }
</script>

<div class="phrase-effort-lab">
  <!-- Header bar -->
  <header class="lab-header">
    <div class="header-left">
      <h2 class="lab-title">Phrase Effort Lab</h2>
      <span class="experiment-badge">Experimental</span>
    </div>

    <div class="header-right">
      <button
        class="pick-btn"
        onclick={() => (showPicker = true)}
        type="button"
      >
        <i class="fas fa-search" aria-hidden="true"></i>
        {sequence ? (sequenceWord || "Sequence") : "Pick Sequence"}
      </button>

      {#if sequence}
        <button
          class="save-btn"
          class:saved={saveStatus === "saved"}
          class:error={saveStatus === "error"}
          onclick={handleSave}
          disabled={saving || timeline.phrases.length === 0}
          type="button"
        >
          {#if saving}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          {:else if saveStatus === "saved"}
            <i class="fas fa-check" aria-hidden="true"></i>
          {:else if saveStatus === "error"}
            <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-save" aria-hidden="true"></i>
          {/if}
          Save
        </button>
      {/if}
    </div>
  </header>

  {#if !sequence}
    <!-- Empty state -->
    <div class="empty-state">
      <i class="fas fa-paint-brush" aria-hidden="true"></i>
      <p>Pick a sequence to paint effort phrases</p>
      <button
        class="pick-cta"
        onclick={() => (showPicker = true)}
        type="button"
      >
        Choose Sequence
      </button>
    </div>
  {:else}
    <!-- Canvas preview area -->
    <div class="canvas-area">
      <AnimatorCanvas
        {blueProp}
        {redProp}
        {gridMode}
        letter={currentLetter}
        stepData={currentStepData}
        sequenceData={sequence}
        {currentStep}
        {isPlaying}
        word={sequenceWord}
        disableContextMenu={true}
      />
    </div>

    <!-- Transport controls -->
    <div class="transport-bar">
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

    <!-- Effort palette -->
    <div class="palette-section">
      <EffortPalette
        {selectedEffort}
        onSelect={(effort) => { selectedEffort = effort; }}
      />
    </div>

    <!-- Timeline -->
    <div class="timeline-section">
      <div class="timeline-actions">
        {#if selectedPhraseId}
          <button
            class="action-btn delete-btn"
            onclick={handleDeleteSelected}
            type="button"
          >
            <i class="fas fa-trash-alt" aria-hidden="true"></i>
            Delete
          </button>
        {/if}
        {#if timeline.phrases.length > 0}
          <button
            class="action-btn clear-btn"
            onclick={handleClearTimeline}
            type="button"
          >
            <i class="fas fa-eraser" aria-hidden="true"></i>
            Clear All
          </button>
        {/if}
      </div>

      <PhraseTimeline
        {timeline}
        {totalBeats}
        {selectedEffort}
        {selectedPhraseId}
        onTimelineChange={handleTimelineChange}
        onPhraseSelect={handlePhraseSelect}
        currentBeat={currentBeatForTimeline}
      />

      {#if timeline.phrases.length > 0}
        <PhraseEasingCurveOverlay {timeline} {totalBeats} />
      {/if}
    </div>

    <!-- Transition toggle -->
    <div class="transition-bar">
      <span class="transition-label">Transition:</span>
      <div class="transition-toggle" role="radiogroup" aria-label="Transition mode">
        <button
          class="toggle-btn"
          class:active={timeline.transition === "hard"}
          type="button"
          role="radio"
          aria-checked={timeline.transition === "hard"}
          onclick={handleTransitionToggle}
        >
          Hard
        </button>
        <button
          class="toggle-btn"
          class:active={timeline.transition === "blend"}
          type="button"
          role="radio"
          aria-checked={timeline.transition === "blend"}
          onclick={handleTransitionToggle}
        >
          Blend
        </button>
      </div>
    </div>
  {/if}
</div>

<!-- Sequence Picker Modal -->
<SequencePickerModal
  open={showPicker}
  onSelect={handleSequenceSelected}
  onClose={() => (showPicker = false)}
  title="Select Sequence for Phrase Effort Lab"
/>

<style>
  .phrase-effort-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  /* ─── Header ───────────────────────────────────────────────────── */

  .lab-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
    flex-shrink: 0;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
  }

  .lab-title {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    margin: 0;
  }

  .experiment-badge {
    font-size: var(--font-size-xs, 10px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  /* ─── Buttons ──────────────────────────────────────────────────── */

  .pick-btn,
  .save-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
    min-height: var(--min-touch-target, 44px);
    -webkit-tap-highlight-color: transparent;
  }

  .pick-btn {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
  }

  .pick-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    background: rgba(255, 255, 255, 0.06);
  }

  .save-btn {
    background: rgba(139, 92, 246, 0.15);
    border: 1.5px solid rgba(139, 92, 246, 0.3);
    color: #a78bfa;
  }

  .save-btn:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.5);
  }

  .save-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .save-btn.saved {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.3);
    color: #4ade80;
  }

  .save-btn.error {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  /* ─── Empty State ──────────────────────────────────────────────── */

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

  .pick-cta {
    padding: 10px 24px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    border-radius: 10px;
    background: rgba(139, 92, 246, 0.2);
    border: 1.5px solid rgba(139, 92, 246, 0.4);
    color: #a78bfa;
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
    min-height: var(--min-touch-target, 44px);
  }

  .pick-cta:hover {
    background: rgba(139, 92, 246, 0.3);
    border-color: rgba(139, 92, 246, 0.6);
  }

  /* ─── Canvas Area ──────────────────────────────────────────────── */

  .canvas-area {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  /* ─── Transport Bar ────────────────────────────────────────────── */

  .transport-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-xs, 4px) var(--spacing-md, 16px);
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  /* ─── Palette Section ──────────────────────────────────────────── */

  .palette-section {
    padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  /* ─── Timeline Section ─────────────────────────────────────────── */

  .timeline-section {
    padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .timeline-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    margin-bottom: var(--spacing-xs, 4px);
    min-height: 28px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    border-radius: 6px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
  }

  .action-btn:hover {
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .delete-btn:hover {
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.1);
  }

  /* ─── Transition Bar ───────────────────────────────────────────── */

  .transition-bar {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .transition-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .transition-toggle {
    display: flex;
    gap: 2px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 2px;
  }

  .toggle-btn {
    padding: 6px 14px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
    min-height: var(--min-touch-target, 44px);
    -webkit-tap-highlight-color: transparent;
  }

  .toggle-btn.active {
    background: rgba(139, 92, 246, 0.2);
    color: var(--theme-text, #ffffff);
  }

  .toggle-btn:hover:not(.active) {
    color: var(--theme-text, #ffffff);
    background: rgba(255, 255, 255, 0.04);
  }

  /* ─── Reduced Motion ───────────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .pick-btn,
    .save-btn,
    .pick-cta,
    .action-btn,
    .toggle-btn {
      transition: none;
    }
  }
</style>
