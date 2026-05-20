<!--
  PlayWithItInner.svelte

  The heavy inner component for the Play With It section. Dynamically imported
  by PlayWithItSection when scrolled into view. Contains the full animation
  engine integration: EndlessSpinnerOrchestrator, AnimatorCanvas, effect
  controls, and prop switching.
-->
<script lang="ts">

import { createAnimationPlaybackController } from "$lib/features/compose/services/animation-playback-controller-factory";
import { getSequenceTransformer } from "$lib/shared/create/getSequenceTransformer";
  import { onMount, onDestroy } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
  import { createEndlessPlayback, type EndlessPlaybackState } from "$lib/shared/animation-engine/state/endless-playback-state.svelte";
  import * as propTypeApplier from "$lib/shared/landing/services/prop-type-applier";
  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/EndlessSpinnerOrchestrator";
  import { getBrowseLoader } from "$lib/shared/browse/getBrowseLoader";
  import { gridPositionDeriver as gridPositionDeriverInstance } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
  import { orientationCalculator as orientationCalculatorInstance } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
  import { startPositionDeriver as startPositionDeriverInstance } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import { generationOrchestrator } from "$lib/shared/create/services/GenerationOrchestrator";
  import {
    animationSettings,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { createStartPositionFromBeatStart } from "$lib/shared/create/services/sequence-transforms";
  import { RANDOM_PROPS } from "../landing-content";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import TempoControl from "$lib/shared/sequence-viewer/components/TempoControl.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { EFFORTS, type EffortId as EffortPresetId } from "$lib/shared/effort/domain/effort-types";

  // ── Effect definitions ──────────────────────────────────────────────────────
  type EffectId = "clean" | "trails" | "fire" | "leds" | "charcoal";

  interface EffectDef {
    id: EffectId;
    label: string;
    icon: string;
    activeColor: string;
  }

  const EFFECTS: EffectDef[] = [
    { id: "clean", label: "Clean", icon: "fas fa-circle", activeColor: "#a3a3a3" },
    { id: "trails", label: "Trails", icon: "fas fa-wind", activeColor: "#818cf8" },
    { id: "fire", label: "Fire", icon: "fas fa-fire", activeColor: "#f59e0b" },
    { id: "charcoal", label: "Charcoal", icon: "fas fa-smog", activeColor: "#78716c" },
    { id: "leds", label: "LEDs", icon: "fas fa-lightbulb", activeColor: "#00ff88" },
  ];

  // ── Prop type display names ─────────────────────────────────────────────────
  const PROP_LABELS: Record<string, string> = {
    [PropType.STAFF]: "Staff",
    [PropType.BUUGENG]: "Buugeng",
    [PropType.FAN]: "Fan",
    [PropType.TRIAD]: "Triad",
    [PropType.CLUB]: "Club",
    [PropType.MINIHOOP]: "Mini Hoop",
  };

  // ── Factory state ──────────────────────────────────────────────────────────
  let playback = $state<EndlessPlaybackState | null>(null);
  let animationReady = $state(false);
  let animationError = $state(false);
  let isLoading = $state(false);

  // Prop state
  let currentPropType = $state<PropType>(PropType.STAFF);

  // Effect state
  let activeEffect = $state<EffectId>("trails");
  // Per-instance visibility manager so this player's effect/dark-mode settings
  // don't conflict with other AnimatorCanvas instances on the same page.
  // Ephemeral: no localStorage persistence, no global dark-class sync.
  const visibilityManager = new AnimationVisibilityStateManager({ ephemeral: true });

  // BPM state - local to this landing section
  let bpm = $state(60);

  // Effort state - cycles through available effort presets
  let activeEffort = $state<EffortPresetId>("linear");
  const EFFORT_CYCLE: EffortPresetId[] = EFFORTS.map((e) => e.id);
  const EFFORT_COLORS: Record<EffortPresetId, string> = Object.fromEntries(
    EFFORTS.map((e) => [e.id, e.color])
  ) as Record<EffortPresetId, string>;

  // Sync toolbar buttons when the context menu (or anything else) changes the
  // visibility manager directly. Without this, the buttons show stale state
  // because they only tracked their own local $state variables.
  function deriveEffectFromManager(): EffectId {
    const active = visibilityManager.getActiveEffect();
    if (active === "fire") return "fire";
    if (active === "charcoal") return "charcoal";
    if (active === "led") return "leds";
    if (active === "trails") return "trails";
    return "clean";
  }

  $effect(() => {
    function onVisibilityChange() {
      activeEffect = deriveEffectFromManager();
      activeEffort = visibilityManager.getEffortPreset();
    }

    visibilityManager.registerObserver(onVisibilityChange);
    return () => visibilityManager.unregisterObserver(onVisibilityChange);
  });

  // ── Sequence history & copy ──────────────────────────────────────────────
  let showHistory = $state(false);
  let copyFeedback = $state<string | null>(null);
  let copyFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  async function copySequenceData() {
    if (!playback) return;
    const result = await playback.copyForAI();
    showCopyFeedback(result.success ? "Copied!" : "Copy failed");
  }

  async function copyHistoryEntry(index: number) {
    if (!playback) return;
    const result = await playback.copyHistoryEntry(index);
    showCopyFeedback(result.success ? "Copied!" : "Copy failed");
  }

  function showCopyFeedback(msg: string) {
    copyFeedback = msg;
    if (copyFeedbackTimeout) clearTimeout(copyFeedbackTimeout);
    copyFeedbackTimeout = setTimeout(() => {
      copyFeedback = null;
    }, 1500);
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  let currentStepNumber = $derived(Math.floor(playback?.animationState?.currentStep ?? 0));

  // ── Initialize animation engine ─────────────────────────────────────────────
  onMount(async () => {
    try {
      animationSettings.setTrackingMode(TrackingMode.BOTH_ENDS);
      // Set landing-page default BPM (60 feels comfortable for visitors)
      animationSettings.setBpm(bpm);

      // Dark mode on for visual impact
      visibilityManager.setDarkMode(true);
      // Trails on by default (matches "trails" active chip)
      visibilityManager.setActiveEffect("trails");

      const browseLoader = getBrowseLoader();
      const pc = createAnimationPlaybackController();
      const sequenceTransformer = getSequenceTransformer();

      const spinnerOrch = new EndlessSpinnerOrchestrator(
        browseLoader as any,
        generationOrchestrator,
        sequenceTransformer as any,
        startPositionDeriverInstance,
        orientationCalculatorInstance as any,
        gridPositionDeriverInstance as any
      );

      // Noop infinite generator (this surface is library-only)
      const noopInfinite = {
        generateInitial: async () => null,
        generateFromEndState: async () => null,
        getSessionCount: () => 0,
      };

      playback = createEndlessPlayback({
        modes: ["library"],
        defaultMode: "library",
        propType: currentPropType,
        spinnerOrchestrator: spinnerOrch,
        infiniteGenerator: noopInfinite,
        playbackController: pc,
      });

      await playback.initialize();
      animationReady = true;
    } catch (err) {
      console.error("[PlayWithIt] Failed to load animation:", err);
      animationError = true;
    }
  });

  onDestroy(() => {
    playback?.dispose();
  });

  // ── Effect switching ────────────────────────────────────────────────────────
  function setEffect(effect: EffectId) {
    activeEffect = effect;

    switch (effect) {
      case "clean":
        visibilityManager.setActiveEffect("none");
        break;
      case "trails":
        visibilityManager.setActiveEffect("trails");
        break;
      case "fire":
        visibilityManager.setActiveEffect("fire");
        break;
      case "charcoal":
        visibilityManager.setActiveEffect("charcoal");
        break;
      case "leds":
        visibilityManager.setActiveEffect("led");
        break;
    }
  }

  // ── Prop switching ──────────────────────────────────────────────────────────
  function handleChangeProp() {
    let newProp = currentPropType;
    while (newProp === currentPropType && RANDOM_PROPS.length > 1) {
      newProp = RANDOM_PROPS[Math.floor(Math.random() * RANDOM_PROPS.length)]!;
    }
    currentPropType = newProp;
    playback?.setPropType(newProp);

    // Hot-swap prop in the running animation
    const animState = playback?.animationState;
    if (animState?.sequenceData) {
      const updated = propTypeApplier.applyToSequence(
        animState.sequenceData,
        newProp
      );
      animState.setSequenceData(updated);
    }
  }

  // ── Effort cycling ─────────────────────────────────────────────────────────
  function cycleEffort() {
    const idx = EFFORT_CYCLE.indexOf(activeEffort);
    const next = EFFORT_CYCLE[(idx + 1) % EFFORT_CYCLE.length]!;
    activeEffort = next;
    visibilityManager.setEffortPreset(next);
  }

  // ── Play / Pause ────────────────────────────────────────────────────────────
  function togglePlayPause() {
    if (!playback?.playbackController) return;
    playback.playbackController.togglePlayback();
  }

  // ── BPM control ─────────────────────────────────────────────────────────────
  function handleBpmChange(newBpm: number) {
    animationSettings.setBpm(newBpm);
  }

  // ── Derived display values ──────────────────────────────────────────────────
  let propLabel = $derived(PROP_LABELS[currentPropType] ?? "Staff");
  let effortLabel = $derived(EFFORTS.find((e) => e.id === activeEffort)?.label ?? "Linear");
  let effortColor = $derived(EFFORT_COLORS[activeEffort] ?? "#94a3b8");
  let isDisabled = $derived(!playback?.servicesReady || isLoading);

  // ── Notation panel cells ──────────────────────────────────────────────────
  // Build an array of cells: start position (index 0) + each beat step.
  // Each cell carries the pictograph data and a display label.
  interface NotationCell {
    key: string;
    data: StepData | StartPositionData;
    label: string;
    isStart: boolean;
    stepNumber: number; // 0 for start, 1-N for beats
  }

  let notationCells = $derived.by((): NotationCell[] => {
    const seq = playback?.animationState?.sequenceData;
    if (!seq?.steps?.length) return [];

    const cells: NotationCell[] = [];

    // Start position cell
    const startPos = seq.startPosition ?? (seq.steps[0] ? createStartPositionFromBeatStart(seq.steps[0]) : null);
    if (startPos) {
      cells.push({
        key: `start-${seq.id ?? seq.word}`,
        data: startPos,
        label: "Start",
        isStart: true,
        stepNumber: 0,
      });
    }

    // Beat cells
    for (let i = 0; i < seq.steps.length; i++) {
      const step = seq.steps[i]!;
      cells.push({
        key: `beat-${i}-${step.letter ?? i}`,
        data: step,
        label: `${i + 1}`,
        isStart: false,
        stepNumber: i + 1,
      });
    }

    return cells;
  });

  // Auto-scroll beat strip to keep active beat visible
  let beatStripEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!beatStripEl || !playback?.animationState?.isPlaying) return;
    const activeCell = beatStripEl.querySelector('.step-cell.active') as HTMLElement | null;
    if (activeCell) {
      activeCell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  });

  // ── Beat strip virtualization ─────────────────────────────────────────────
  // Only render PictographContainers for cells that are actually visible in the
  // scrollable strip. Each cell is 72px wide with a 6px gap = 78px per slot.
  // We keep a 2-cell buffer on each side so pictographs are already rendered
  // when the user scrolls to them.
  const CELL_SIZE = 78; // 72px cell + 6px gap
  const BUFFER = 2;

  let stripScrollLeft = $state(0);
  let stripContainerWidth = $state(800);

  let visibleRange = $derived.by(() => {
    const start = Math.max(0, Math.floor(stripScrollLeft / CELL_SIZE) - BUFFER);
    const end = Math.min(
      notationCells.length,
      Math.ceil((stripScrollLeft + stripContainerWidth) / CELL_SIZE) + BUFFER
    );
    return { start, end };
  });

  // Wire scroll + resize tracking to the beat-strip element.
  $effect(() => {
    const el = beatStripEl;
    if (!el) return;

    // Capture initial dimensions
    stripContainerWidth = el.clientWidth;
    stripScrollLeft = el.scrollLeft;

    // Hoist to a typed non-nullable local so closures below see a non-null ref
    const strip: HTMLDivElement = el;

    function onScroll() {
      stripScrollLeft = strip.scrollLeft;
    }

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) stripContainerWidth = entry.contentRect.width;
    });

    strip.addEventListener('scroll', onScroll, { passive: true });
    ro.observe(strip);

    return () => {
      strip.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  });
</script>

<div class="play-inner">
  <!-- Unified showcase: toolbar + canvas + beat strip -->
  <div class="showcase">
    <!-- Toolbar integrated into the top of the viewer -->
    <div class="toolbar">
      <div class="tb-group">
        <span class="tb-label">Playback</span>
        <div class="tb-pills">
          <button
            class="tb-pill"
            class:active={playback?.animationState?.isPlaying}
            onclick={togglePlayPause}
            disabled={isDisabled || !animationReady}
            aria-label={playback?.animationState?.isPlaying ? "Pause animation" : "Play animation"}
            style="--chip-color: #d4813a;"
          >
            {#if playback?.animationState?.isPlaying}
              <span class="playback-icon" aria-hidden="true">⏸</span>
            {:else}
              <span class="playback-icon" aria-hidden="true">▶</span>
            {/if}
            <span class="pill-text">{playback?.animationState?.isPlaying ? "Pause" : "Play"}</span>
          </button>
        </div>
      </div>

      <div class="tb-group">
        <span class="tb-label">Effect</span>
        <div class="tb-pills" role="radiogroup" aria-label="Visual effect">
          {#each EFFECTS as effect}
            <button
              class="tb-pill"
              class:active={activeEffect === effect.id}
              onclick={() => setEffect(effect.id)}
              disabled={isDisabled}
              role="radio"
              aria-checked={activeEffect === effect.id}
              aria-label="{effect.label} effect"
              style="--chip-color: {effect.activeColor};"
            >
              <i class={effect.icon} aria-hidden="true"></i>
              <span class="pill-text">{effect.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="tb-spacer"></div>

      <div class="tb-group">
        <span class="tb-label">Prop</span>
        <div class="tb-pills">
          <button
            class="tb-pill active"
            onclick={handleChangeProp}
            disabled={isDisabled}
            aria-label="Change prop type, currently {propLabel}"
          >
            <i class="fas fa-random" aria-hidden="true"></i>
            <span class="pill-text">{propLabel}</span>
          </button>
        </div>
      </div>

      <div class="tb-group">
        <span class="tb-label">Effort</span>
        <div class="tb-pills">
          <button
            class="tb-pill active"
            onclick={cycleEffort}
            disabled={isDisabled}
            aria-label="Cycle effort quality, currently {effortLabel}"
            style="--chip-color: {effortColor};"
          >
            <i class="fas fa-wave-square" aria-hidden="true"></i>
            <span class="pill-text">{effortLabel}</span>
          </button>
        </div>
      </div>

      <div class="tb-group bpm-group">
        <TempoControl {bpm} onBpmChange={handleBpmChange} showPresets={true} showPractice={false} />
      </div>

      <div class="tb-group">
        <span class="tb-label">Debug</span>
        <div class="tb-pills">
          <button
            class="tb-pill"
            class:copied={copyFeedback === "Copied!"}
            onclick={() => copySequenceData()}
            disabled={isDisabled || !playback?.currentSequence}
            aria-label="Copy current sequence data to clipboard"
            style="--chip-color: #22c55e;"
          >
            <i class={copyFeedback ? "fas fa-check" : "fas fa-clipboard"} aria-hidden="true"></i>
            <span class="pill-text">{copyFeedback ?? "Copy"}</span>
          </button>
          <button
            class="tb-pill"
            class:active={showHistory}
            onclick={() => showHistory = !showHistory}
            disabled={(playback?.history ?? []).length === 0}
            aria-label={showHistory ? "Hide sequence history" : "Show sequence history"}
            aria-expanded={showHistory}
            style="--chip-color: #a78bfa;"
          >
            <i class="fas fa-history" aria-hidden="true"></i>
            <span class="pill-text">History ({(playback?.history ?? []).length})</span>
          </button>
        </div>
      </div>
    </div>
    <div class="canvas-area">
      {#if animationReady && !isLoading}
        <div class="canvas-wrapper">
          <AnimatorCanvas
            blueProp={playback?.animationState?.bluePropState ?? null}
            redProp={playback?.animationState?.redPropState ?? null}
            gridVisible={true}
            gridMode={playback?.gridMode ?? null}
            letter={playback?.currentLetter ?? null}
            stepData={playback?.currentStepData}
            sequenceData={playback?.animationState?.sequenceData}
            currentStep={playback?.animationState?.currentStep ?? 0}
            isPlaying={playback?.animationState?.isPlaying ?? false}
            trailSettings={animationSettings.trail}
            bluePropType={currentPropType}
            redPropType={currentPropType}
            word={playback?.animationState?.sequenceData?.intendedWord ?? playback?.animationState?.sequenceData?.word ?? null}
            previewDarkMode={true}
            visibilityManagerOverride={visibilityManager}
          />
        </div>
      {:else if animationError}
        <div class="canvas-placeholder">
          <div class="placeholder-icon">🌀</div>
          <span>Animation preview unavailable</span>
        </div>
      {:else}
        <div class="canvas-placeholder">
          <ProgressRing percent={-1} size={32} strokeWidth={3} />
          <span>{isLoading ? "Loading animation..." : "Initializing..."}</span>
        </div>
      {/if}
    </div>

    <!-- Beat strip below the canvas -->
    {#if playback?.animationState?.sequenceData && notationCells.length > 0}
      <div class="beat-strip" bind:this={beatStripEl}>
        {#each notationCells as cell, i (cell.key)}
          {@const isActive = (playback?.animationState?.isPlaying ?? false) && (
            cell.isStart
              ? currentStepNumber === 0
              : currentStepNumber === cell.stepNumber
          )}
          {#if i >= visibleRange.start && i < visibleRange.end}
            <div class="beat-cell" class:active={isActive} class:start-cell={cell.isStart}>
              <div class="beat-pictograph">
                <PictographContainer
                  pictographData={cell.data}
                  darkMode={true}
                  disableTransitions={true}
                  disableContentTransitions={true}
                  bluePropTypeOverride={currentPropType}
                  redPropTypeOverride={currentPropType}
                />
              </div>
            </div>
          {:else}
            <div class="beat-cell beat-cell-placeholder" aria-hidden="true"></div>
          {/if}
        {/each}
      </div>
    {/if}

    <!-- History panel -->
    {#if showHistory && (playback?.history ?? []).length > 0}
      <div class="history-panel">
        <div class="history-header">
          <span class="history-title">Recent Sequences ({(playback?.history ?? []).length})</span>
          <button class="history-close" onclick={() => showHistory = false} aria-label="Close history">
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
        <div class="history-list">
          {#each playback?.history ?? [] as entry, i (entry.timestamp)}
            {@const isCurrent = i === 0}
            <div class="history-row" class:current={isCurrent}>
              <div class="history-info">
                <span class="history-word">{entry.word ?? entry.sequence.word ?? "?"}</span>
                {#if entry.sequence.loopType}
                  <span class="history-loop">{entry.sequence.loopType}</span>
                {/if}
                <span class="history-steps">{entry.sequence.steps?.length ?? 0} beats</span>
                <span class="history-time">
                  {new Date(entry.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
                </span>
              </div>
              <button
                class="history-copy-btn"
                onclick={() => copyHistoryEntry(i)}
                aria-label="Copy sequence data for {entry.word ?? entry.sequence.word ?? '?'}"
              >
                <i class="fas fa-clipboard" aria-hidden="true"></i>
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .play-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    width: 100%;
  }

  /* ── Toolbar (inside showcase container) ─────────────────────────────────── */
  .toolbar {
    display: flex;
    align-items: flex-end;
    gap: 14px;
    flex-wrap: wrap;
    padding: 14px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(0, 0, 0, 0.2);
  }

  .tb-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .tb-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(255, 255, 255, 0.25);
    padding-left: 2px;
  }

  .tb-pills {
    display: flex;
    gap: 4px;
  }

  .tb-spacer {
    flex: 1;
  }

  .tb-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    min-height: 34px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-family: var(--font-body, 'DM Sans', system-ui, sans-serif);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tb-pill:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.18);
    color: var(--theme-text, #fff);
  }

  .tb-pill.active {
    background: color-mix(in srgb, var(--chip-color, #d4813a) 15%, transparent);
    border-color: color-mix(in srgb, var(--chip-color, #d4813a) 40%, transparent);
    color: var(--chip-color, #d4813a);
  }

  .tb-pill:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .tb-pill i {
    font-size: 11px;
  }

  .playback-icon {
    font-size: 12px;
    line-height: 1;
  }

  /* BPM group: constrain width so chips don't stretch the toolbar */
  .bpm-group {
    min-width: 0;
  }

  /* ── Showcase: stacked container ─────────────────────────────────────────── */
  .showcase {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.35);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .canvas-area {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    max-height: 640px;
    display: flex;
    align-items: center;
    justify-content: center;
  }


  .canvas-wrapper {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .canvas-placeholder {
    width: 100%;
    height: 100%;
    min-height: 300px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
  }

  .placeholder-icon {
    font-size: 3rem;
    opacity: 0.4;
  }

  /* ── Beat strip ────────────────────────────────────────────────────────── */
  .beat-strip {
    display: flex;
    gap: 6px;
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
  }

  .beat-strip::-webkit-scrollbar {
    height: 3px;
  }
  .beat-strip::-webkit-scrollbar-track {
    background: transparent;
  }
  .beat-strip::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 2px;
  }

  .step-cell {
    flex: 0 0 72px;
    width: 72px;
    height: 72px;
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    overflow: hidden;
    scroll-snap-align: start;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .step-cell.active {
    border-color: #d4813a;
    box-shadow: 0 0 10px rgba(212, 129, 58, 0.3);
  }

  .step-cell.start-cell {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .beat-pictograph {
    width: 100%;
    height: 100%;
  }

  /* Off-screen placeholder: same dimensions as a real cell, no border or content.
     Keeps the scrollable width correct while the PictographContainer is unmounted. */
  .step-cell-placeholder {
    border-color: transparent;
    box-shadow: none;
    background: transparent;
    pointer-events: none;
  }

  /* ── Copy feedback ──────────────────────────────────────────────────── */
  .tb-pill.copied {
    background: color-mix(in srgb, #22c55e 20%, transparent);
    border-color: color-mix(in srgb, #22c55e 50%, transparent);
    color: #22c55e;
  }

  /* ── History panel ────────────────────────────────────────────────────── */
  .history-panel {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.3);
    max-height: 260px;
    display: flex;
    flex-direction: column;
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .history-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.4);
  }

  .history-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    font-size: 12px;
  }

  .history-close:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
  }

  .history-list {
    overflow-y: auto;
    flex: 1;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
  }

  .history-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 0.1s ease;
  }

  .history-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .history-row.current {
    background: rgba(167, 139, 250, 0.06);
    border-left: 2px solid #a78bfa;
  }

  .history-info {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }

  .history-word {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  .history-loop {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(167, 139, 250, 0.15);
    border: 1px solid rgba(167, 139, 250, 0.25);
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .history-steps {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
    white-space: nowrap;
  }

  .history-time {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.25);
    white-space: nowrap;
    margin-left: auto;
  }

  .history-copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    font-size: 12px;
    flex-shrink: 0;
    margin-left: 8px;
    transition: all 0.15s ease;
  }

  .history-copy-btn:hover {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  /* ── Responsive ────────────────────────────────────────────────────────── */
  @media (max-width: 600px) {
    .showcase {
      max-width: 100%;
      border-radius: 12px;
    }

    .canvas-area {
      max-height: 400px;
    }

    .toolbar {
      gap: 10px;
      padding: 10px 12px;
    }

    .tb-spacer {
      display: none;
    }

    .tb-pill {
      padding: 5px 10px;
      min-height: 30px;
      font-size: 11px;
    }

    .pill-text {
      display: none;
    }

    .tb-pill i {
      font-size: 13px;
    }

    .step-cell {
      flex: 0 0 56px;
      width: 56px;
      height: 56px;
    }

    .history-panel {
      max-height: 200px;
    }

    .history-info {
      gap: 6px;
      flex-wrap: wrap;
    }

    .history-time {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tb-pill,
    .step-cell,
    .history-row,
    .history-copy-btn {
      transition: none;
    }
  }
</style>
