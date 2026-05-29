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
    [PhraseTimeline - paint phrases]
    [Transition toggle: Hard | Blend]
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { PropState } from "$lib/shared/foundation/domain/types/PropState";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { EffortId } from "$lib/shared/effort/domain/effort-types";
  import type { EffortTimeline, EffortPhrase } from "./domain/effort-timeline-types";
  import {
    createEffortTimeline,
    createEffortPhrase,
    findPhraseAtBeat,
    insertPhrase,
    removePhrase,
  } from "./domain/effort-timeline-types";
  import { interpolatePhrase } from "$lib/shared/phrase-effort-lab/services/phrase-interpolator";

  import { createAngleCalculator } from "$lib/shared/animation-engine/services/angle-calculator";
  import { EndpointCalculator } from "$lib/shared/animation-engine/services/endpoint-calculator";
  import { PropInterpolator } from "$lib/shared/animation-engine/services/prop-interpolator";
  import { mapTimePositionToBeat } from "$lib/shared/animation-engine/services/step-calculator";

  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { doc, setDoc, serverTimestamp } from "firebase/firestore";
  import { getFirestoreInstance, getAuthSync } from "$lib/shared/auth/firebase";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import EffortPalette from "$lib/shared/phrase-effort-lab/components/EffortPalette.svelte";
  import PhraseTimeline from "./components/PhraseTimeline.svelte";
  import PhraseEasingCurveOverlay from "./components/PhraseEasingCurveOverlay.svelte";
  import TransportControls from "$lib/shared/animation-engine/components/controls/TransportControls.svelte";
  import TempoControl from "$lib/shared/animation-panel/components/TempoControl.svelte";
  import { libraryState } from "$lib/features/library/state/library-state.svelte";
  import type { CreatorIntent } from "$lib/shared/foundation/domain/models/CreatorIntent";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { createPhraseEffortLabState } from "./state/phrase-effort-lab-state.svelte";
  import { persistTimeline as persistTimelineToSession, getPersistedSequenceId as getStoredSequenceId } from "./services/phrase-effort-lab-persister";

  const SESSION_KEY = "phrase-effort-lab-sequence-id";
  const SESSION_TIMELINE_KEY = "phrase-effort-lab-timeline";

  // ─── Default PropState ───────────────────────────────────────────────
  const DEFAULT_PROP_STATE: PropState = {
    centerPathAngle: 0,
    staffRotationAngle: 0,
  };

  // ─── Services (constructed in onMount) ───────────────────────────────
  let propInterpolator: PropInterpolator;

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
  let totalSteps = $derived(steps.length);
  // 1-based current beat for the timeline playhead
  let currentStepForTimeline = $derived(Math.floor(playbackBeat) + 1);
  let hasUnsavedChanges = $derived(
    sequence !== null && timeline.phrases.length > 0
  );

  // ─── Service construction ───────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedPhraseId) {
      e.preventDefault();
      handleDeleteSelected();
    }
    if (e.key === " " && sequence) {
      e.preventDefault();
      togglePlayback();
    }
  }

  // ─── Session restoration ─────────────────────────────────────────
  let hasRestored = false;

  function tryRestoreSession(): boolean {
    if (hasRestored || sequence) return false;
    if (libraryState.sequences.length === 0) return false;

    try {
      const savedId = sessionStorage.getItem(SESSION_KEY);
      if (!savedId) return false;

      const saved = libraryState.getSequenceById(savedId);
      if (!saved) return false;

      hasRestored = true;
      handleSequenceSelected(saved as unknown as SequenceData);

      // Restore persisted timeline (overrides what's on the sequence)
      const savedTimeline = sessionStorage.getItem(SESSION_TIMELINE_KEY);
      if (savedTimeline) {
        const parsed = JSON.parse(savedTimeline) as EffortTimeline;
        if (parsed?.phrases) {
          timeline = parsed;
        }
      }
      return true;
    } catch { return false; }
  }

  onMount(() => {
    const angleCalculator = createAngleCalculator();
    const endpointCalculator = new EndpointCalculator(angleCalculator);
    propInterpolator = new PropInterpolator(angleCalculator, endpointCalculator);

    document.addEventListener("keydown", handleKeydown);
    rafId = requestAnimationFrame(onFrame);

    // If we have a saved session but library isn't loaded yet, trigger load
    const savedId = sessionStorage.getItem(SESSION_KEY);
    if (savedId && libraryState.sequences.length === 0) {
      libraryState.loadSequences();
    }

    // Restore immediately if library is already loaded (HMR / tab re-entry)
    tryRestoreSession();
  });

  // Restore when library loads asynchronously (after loadSequences completes)
  $effect(() => {
    if (hasRestored || sequence) return;
    // Read reactively so effect re-runs when library populates
    const _seqs = libraryState.sequences;
    if (_seqs.length === 0) return;
    tryRestoreSession();
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

    if (playbackBeat >= totalSteps) {
      playbackBeat = playbackBeat % totalSteps;
    }

    updatePropStates();
    rafId = requestAnimationFrame(onFrame);
  }

  // ─── Per-frame state computation ────────────────────────────────────

  /**
   * Find the next phrase after the given beat, for blend crossfade.
   */
  function findNextPhrase(beat: number): EffortPhrase | null {
    for (const phrase of timeline.phrases) {
      if (phrase.startStep > beat) return phrase;
    }
    return null;
  }

  function updatePropStates() {
    if (!propInterpolator || steps.length === 0) return;

    const beat1Based = playbackBeat + 1;
    const activePhrase = findPhraseAtBeat(timeline, beat1Based);

    let stepIndex: number;
    let localProgress: number;

    if (activePhrase) {
      const result = interpolatePhrase(
        activePhrase,
        beat1Based,
        steps.length,
      );
      stepIndex = result.stepIndex;
      localProgress = result.localProgress;

      // ── Blend mode: crossfade near phrase boundaries ──
      if (timeline.transition === "blend" && timeline.blendSteps) {
        const halfBlend = (timeline.blendSteps ?? 1) / 2;

        // Check if we're near the END of this phrase (approaching next phrase)
        const phraseEnd = activePhrase.endStep + 1; // exclusive end
        const distToEnd = phraseEnd - beat1Based;
        const nextPhrase = distToEnd <= halfBlend ? findNextPhrase(beat1Based) : null;

        if (nextPhrase && distToEnd > 0) {
          // Blend: lerp between current phrase result and next phrase result
          const blendT = 1 - (distToEnd / halfBlend); // 0 at blend start → 1 at boundary
          const nextResult = interpolatePhrase(
            nextPhrase,
            beat1Based,
            steps.length,
          );
          // Lerp step positions
          const posA = stepIndex + localProgress;
          const posB = nextResult.stepIndex + nextResult.localProgress;
          const blended = posA + (posB - posA) * blendT;
          stepIndex = Math.min(Math.floor(blended), steps.length - 1);
          localProgress = blended - Math.floor(blended);
        }

        // Check if we're near the START of this phrase (coming from previous)
        const distFromStart = beat1Based - activePhrase.startStep;
        if (distFromStart < halfBlend && timeline.phrases.length > 0) {
          // Find previous phrase
          let prevPhrase: EffortPhrase | null = null;
          for (const p of timeline.phrases) {
            if (p.endStep + 1 <= activePhrase.startStep) prevPhrase = p;
            else break;
          }
          if (prevPhrase) {
            const blendT = distFromStart / halfBlend; // 0 at boundary → 1 at blend end
            const prevResult = interpolatePhrase(
              prevPhrase,
              beat1Based,
              steps.length,
            );
            const posA = prevResult.stepIndex + prevResult.localProgress;
            const posB = stepIndex + localProgress;
            const blended = posA + (posB - posA) * blendT;
            stepIndex = Math.min(Math.floor(blended), steps.length - 1);
            localProgress = blended - Math.floor(blended);
          }
        }
      }
    } else {
      // No phrase covering this beat - use linear playback
      const mapped = mapTimePositionToBeat(playbackBeat, steps);
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
    persistTimeline();
  }

  function persistTimeline() {
    try {
      sessionStorage.setItem(SESSION_TIMELINE_KEY, JSON.stringify(timeline));
    } catch { /* quota exceeded or private mode */ }
  }

  function handlePhraseSelect(id: string | null) {
    selectedPhraseId = id;
  }

  function handleTransitionToggle() {
    timeline = {
      ...timeline,
      transition: timeline.transition === "hard" ? "blend" : "hard",
      ...(timeline.transition === "hard" ? { blendSteps: 1 } : {}),
    };
    saveStatus = "idle";
    persistTimeline();
  }

  function handleRestart() {
    playbackBeat = 0;
    lastTime = null;
    if (!isPlaying) {
      isPlaying = true;
    }
    updatePropStates();
  }

  function handleDeleteSelected() {
    if (!selectedPhraseId) return;
    timeline = removePhrase(timeline, selectedPhraseId);
    selectedPhraseId = null;
    saveStatus = "idle";
    persistTimeline();
  }

  function handleClearTimeline() {
    timeline = createEffortTimeline();
    selectedPhraseId = null;
    saveStatus = "idle";
    persistTimeline();
  }

  // ─── Presets ───────────────────────────────────────────────────────
  let showPresetMenu = $state(false);

  /** 4x4 preset: divide beats into 4 equal sections, assign efforts */
  const PRESET_4X4_COMBOS: { label: string; efforts: [EffortId, EffortId, EffortId, EffortId] }[] = [
    { label: "Laban Cycle", efforts: ["glide", "dab", "press", "punch"] },
    { label: "Build Up", efforts: ["glide", "press", "dab", "punch"] },
    { label: "Wave", efforts: ["press", "glide", "press", "glide"] },
    { label: "Contrast", efforts: ["punch", "glide", "punch", "glide"] },
  ];

  function applyPreset4x4(efforts: [EffortId, EffortId, EffortId, EffortId]) {
    if (totalSteps < 4) return;

    const sectionSize = Math.floor(totalSteps / 4);
    let newTimeline = createEffortTimeline();

    for (let i = 0; i < 4; i++) {
      const startStep = i * sectionSize + 1;
      const endStep = i === 3 ? totalSteps : (i + 1) * sectionSize;
      const phrase = createEffortPhrase(efforts[i]!, startStep, endStep);
      newTimeline = insertPhrase(newTimeline, phrase);
    }

    // Preserve current transition setting
    newTimeline = { ...newTimeline, transition: timeline.transition, blendSteps: timeline.blendSteps };
    timeline = newTimeline;
    selectedPhraseId = null;
    saveStatus = "idle";
    showPresetMenu = false;
    persistTimeline();
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
      // JSON round-trip strips Svelte $state proxies - Firestore rejects them
      // and structuredClone can't handle proxy Symbols either.
      const plainTimeline = JSON.parse(JSON.stringify(timeline));
      const propConfig = sequence.creatorIntent?.propConfig
        ? JSON.parse(JSON.stringify(sequence.creatorIntent.propConfig))
        : {
            bluePropType: (settingsService.settings.bluePropType || PropType.STAFF) as PropType,
            redPropType: (settingsService.settings.redPropType || PropType.STAFF) as PropType,
            catDogMode: settingsService.settings.catDogMode ?? false,
          };
      const updatedIntent = {
        propConfig,
        effortTimeline: plainTimeline,
      };

      await setDoc(
        sequenceRef,
        {
          effortTimeline: plainTimeline,
          creatorIntent: updatedIntent,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      sequence = {
        ...sequence,
        effortTimeline: timeline,
        creatorIntent: updatedIntent,
      };
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
        disableContextMenu={false}
        fireConfig={{ disableFrameCache: true }}
      />
    </div>

    <!-- Transport controls -->
    <div class="transport-bar">
      <TempoControl
        {bpm}
        onBpmChange={handleBpmChange}
        showPresets={false}
        showPractice={false}
      />
      <button
        class="restart-btn"
        onclick={handleRestart}
        type="button"
        aria-label="Restart from beginning"
        title="Restart"
      >
        <i class="fas fa-undo" aria-hidden="true"></i>
      </button>
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
        <!-- Preset menu -->
        <div class="preset-wrapper">
          <button
            class="action-btn preset-btn"
            onclick={() => (showPresetMenu = !showPresetMenu)}
            type="button"
            disabled={totalSteps < 4}
          >
            <i class="fas fa-magic" aria-hidden="true"></i>
            4×4 Preset
          </button>
          {#if showPresetMenu}
            <div class="preset-menu">
              {#each PRESET_4X4_COMBOS as combo}
                <button
                  class="preset-option"
                  onclick={() => applyPreset4x4(combo.efforts)}
                  type="button"
                >
                  <span class="preset-option-label">{combo.label}</span>
                  <span class="preset-option-efforts">
                    {combo.efforts.join(" → ")}
                  </span>
                </button>
              {/each}
            </div>
          {/if}
        </div>

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
        {totalSteps}
        {selectedEffort}
        {selectedPhraseId}
        onTimelineChange={handleTimelineChange}
        onPhraseSelect={handlePhraseSelect}
        currentStep={currentStepForTimeline}
      />

      {#if timeline.phrases.length > 0}
        <PhraseEasingCurveOverlay {timeline} {totalSteps} />
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

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .delete-btn:hover {
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.1);
  }

  /* ─── Restart Button ─────────────────────────────────────────── */

  .restart-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
    font-size: var(--font-size-compact, 12px);
  }

  .restart-btn:hover {
    color: var(--theme-text, white);
    border-color: var(--theme-accent, #8b5cf6);
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
  }

  /* ─── Preset Menu ────────────────────────────────────────────── */

  .preset-wrapper {
    position: relative;
  }

  .preset-btn {
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(139, 92, 246, 0.25);
    color: #a78bfa;
  }

  .preset-btn:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
  }

  .preset-menu {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    min-width: 200px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: 10px;
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 10;
  }

  .preset-option {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text, white);
    cursor: pointer;
    text-align: left;
    transition: background var(--duration-fast, 100ms) ease;
  }

  .preset-option:hover {
    background: rgba(139, 92, 246, 0.15);
  }

  .preset-option-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
  }

  .preset-option-efforts {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: capitalize;
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
    .toggle-btn,
    .restart-btn,
    .preset-option {
      transition: none;
    }
  }
</style>
