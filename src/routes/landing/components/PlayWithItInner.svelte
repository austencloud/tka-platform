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
  import { onMount, onDestroy, tick } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
  import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/implementations/AnimationPlaybackController";
  import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
  import type { StartPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import type { EndState } from '$lib/shared/landing/domain/types';
  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/EndlessSpinnerOrchestrator";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { getBrowseLoader } from "$lib/shared/browse/getBrowseLoader";
  import type { GridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { gridModeDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridModeDeriver";
  import { gridPositionDeriver as gridPositionDeriverInstance } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
  import { orientationCalculator as orientationCalculatorInstance } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
  import { startPositionDeriver as startPositionDeriverInstance } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import { generationOrchestrator } from "$lib/shared/create/services/GenerationOrchestrator";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
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
  import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { toCompactDebug } from "$lib/features/landing/services/sequence-data-serializer";

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

  // ── Apply prop type to all motions in sequence data ─────────────────────────
  function applyPropTypeToSequence(
    sequence: SequenceData,
    propType: PropType
  ): SequenceData {
    const applyToMotions = (data: StepData | StartPositionData) => {
      if (!data.motions) return data;
      return {
        ...data,
        motions: {
          blue: data.motions.blue
            ? { ...data.motions.blue, propType }
            : undefined,
          red: data.motions.red ? { ...data.motions.red, propType } : undefined,
        },
      };
    };

    return {
      ...sequence,
      startPosition: sequence.startPosition
        ? (applyToMotions(sequence.startPosition) as StartPositionData)
        : undefined,
      steps:
        sequence.steps?.map((step) => applyToMotions(step) as StepData) ?? [],
    };
  }

  // ── Animation state ─────────────────────────────────────────────────────────
  const animationState = createAnimationPanelState();
  let playbackController: AnimationPlaybackController | null = null;
  let browseLoader: PublicSequencesLoader | null = null;
  let startPositionDeriver: StartPositionDeriver | null = null;
  let gridPositionDeriver: GridPositionDeriver | null = null;
  let spinnerOrchestrator: EndlessSpinnerOrchestrator | null = null;
  let servicesReady = $state(false);
  let animationReady = $state(false);
  let animationError = $state(false);
  let isLoading = $state(false);

  // Sequence state
  let currentSequence = $state<SequenceData | null>(null);
  let currentPropType = $state<PropType>(PropType.STAFF);
  let lastStep = $state(-1);
  let preloadedSequence = $state<SequenceData | null>(null);
  let isPreloading = $state(false);
  let isChainingNow = $state(false);

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
  const HISTORY_CAP = 20;

  interface HistoryEntry {
    sequence: SequenceData;
    timestamp: Date;
    word: string;
    loopType: string | null;
    stepCount: number;
  }

  let sequenceHistory = $state<HistoryEntry[]>([]);
  let showHistory = $state(false);
  let copyFeedback = $state<string | null>(null);
  let copyFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  function pushToHistory(sequence: SequenceData) {
    const entry: HistoryEntry = {
      sequence,
      timestamp: new Date(),
      word: sequence.intendedWord ?? sequence.word ?? "?",
      loopType: sequence.loopType ?? null,
      stepCount: sequence.steps?.length ?? 0,
    };
    sequenceHistory = [entry, ...sequenceHistory].slice(0, HISTORY_CAP);
  }

  async function copySequenceData(sequence: SequenceData) {
    try {
      const text = toCompactDebug(sequence);
      await navigator.clipboard.writeText(text);
      showCopyFeedback("Copied!");
    } catch {
      showCopyFeedback("Copy failed");
    }
  }

  function showCopyFeedback(msg: string) {
    copyFeedback = msg;
    if (copyFeedbackTimeout) clearTimeout(copyFeedbackTimeout);
    copyFeedbackTimeout = setTimeout(() => {
      copyFeedback = null;
    }, 1500);
  }

  // ── Derived values for AnimatorCanvas ───────────────────────────────────────
  let derivedStartPosition = $derived.by(() => {
    if (!animationState.sequenceData || !startPositionDeriver) return null;
    return startPositionDeriver.getOrDeriveStartPosition(
      animationState.sequenceData
    );
  });

  let currentLetter = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const step = animationState.currentStep;
    if (step < 1) return derivedStartPosition?.letter || null;
    if (animationState.sequenceData.steps?.length > 0) {
      const idx = Math.max(
        0,
        Math.min(
          Math.floor(step) - 1,
          animationState.sequenceData.steps.length - 1
        )
      );
      return animationState.sequenceData.steps[idx]?.letter || null;
    }
    return null;
  });

  let currentStepData = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const step = animationState.currentStep;
    if (step < 1) return derivedStartPosition || null;
    if (animationState.sequenceData.steps?.length > 0) {
      const idx = Math.max(
        0,
        Math.min(
          Math.floor(step) - 1,
          animationState.sequenceData.steps.length - 1
        )
      );
      return animationState.sequenceData.steps[idx] || null;
    }
    return null;
  });

  // Derive gridMode from actual motion locations rather than the stored field.
  // The stored field may be stale (e.g. "box" for a diamond sequence published
  // before gridMode tracking was consistent). Motion locations are the ground truth.
  let gridMode = $derived.by((): GridMode => {
    const seq = animationState.sequenceData;
    if (!seq) return GridMode.DIAMOND;

    // Inspect start position first, then first beat
    const candidates = [seq.startPosition, ...(seq.steps ?? [])];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const blue = candidate.motions?.[MotionColor.BLUE];
      const red = candidate.motions?.[MotionColor.RED];
      if (!blue || !red) continue;
      if (!blue.startLocation || !blue.endLocation || !red.startLocation || !red.endLocation) continue;
      try {
        return gridModeDeriver.deriveGridMode(blue, red);
      } catch {
        continue;
      }
    }

    // No usable motion data - fall back to stored field
    return seq.gridMode ?? GridMode.DIAMOND;
  });
  let currentStepNumber = $derived(Math.floor(animationState.currentStep));

  // ── Pre-load next sequence partway through current one ──────────────────────
  $effect(() => {
    const step = Math.floor(animationState.currentStep);
    const total = animationState.totalSteps;
    const shouldPreload =
      servicesReady &&
      animationReady &&
      !isPreloading &&
      !preloadedSequence &&
      currentSequence &&
      total > 2 &&
      step >= 2 &&
      step < total - 1;

    if (shouldPreload) {
      preloadNextSequence();
    }
  });

  // ── Chain to next sequence on completion ────────────────────────────────────
  $effect(() => {
    const step = Math.floor(animationState.currentStep);
    const total = animationState.totalSteps;

    if (
      servicesReady &&
      !isChainingNow &&
      animationReady &&
      lastStep >= total - 1 &&
      step <= 1 &&
      total > 0
    ) {
      chainToNextSequence();
    }

    lastStep = step;
  });

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

      browseLoader = getBrowseLoader();
      playbackController = createAnimationPlaybackController();
      startPositionDeriver = startPositionDeriverInstance;
      gridPositionDeriver = gridPositionDeriverInstance;

      const sequenceTransformer = getSequenceTransformer();

      spinnerOrchestrator = new EndlessSpinnerOrchestrator(
        browseLoader as any,
        generationOrchestrator,
        sequenceTransformer as any,
        startPositionDeriverInstance,
        orientationCalculatorInstance as any,
        gridPositionDeriverInstance as any
      );

      await spinnerOrchestrator.initialize();
      servicesReady = true;

      const initialSequence = await spinnerOrchestrator.getInitialSequence();
      if (initialSequence) {
        await loadSequence(initialSequence);
      } else {
        animationError = true;
      }
    } catch (err) {
      console.error("[PlayWithIt] Failed to load animation:", err);
      animationError = true;
    }
  });

  onDestroy(() => {
    playbackController?.dispose();
    animationState.dispose();
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

    // Hot-swap prop in the running animation
    if (animationState.sequenceData) {
      const updated = applyPropTypeToSequence(
        animationState.sequenceData,
        newProp
      );
      animationState.setSequenceData(updated);
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
    if (!playbackController) return;
    playbackController.togglePlayback();
  }

  // ── BPM control ─────────────────────────────────────────────────────────────
  function handleBpmChange(newBpm: number) {
    animationSettings.setBpm(newBpm);
  }

  // ── Sequence loading ────────────────────────────────────────────────────────
  function extractEndState(sequence: SequenceData): EndState {
    const last = sequence.steps?.[sequence.steps.length - 1];
    let position = last?.endPosition ?? null;

    if (!position && gridPositionDeriver && last?.motions) {
      const blue = last.motions[MotionColor.BLUE];
      const red = last.motions[MotionColor.RED];
      if (blue?.endLocation && red?.endLocation) {
        try {
          position = gridPositionDeriver.getGridPositionFromLocations(
            blue.endLocation,
            red.endLocation
          );
        } catch {
          // position stays null
        }
      }
    }

    return {
      position,
      blueOrientation: (last?.motions?.blue?.endOrientation as Orientation) ?? null,
      redOrientation: (last?.motions?.red?.endOrientation as Orientation) ?? null,
    };
  }

  async function preloadNextSequence() {
    if (!spinnerOrchestrator || !currentSequence || isPreloading) return;
    isPreloading = true;
    try {
      const endState = extractEndState(currentSequence);
      const next = await spinnerOrchestrator.getNextSequence(endState);
      preloadedSequence = next || (await spinnerOrchestrator.getInitialSequence());
    } catch (err) {
      console.error("[PlayWithIt] Preload failed:", err);
    } finally {
      isPreloading = false;
    }
  }

  async function chainToNextSequence() {
    if (!spinnerOrchestrator || !playbackController || isChainingNow) return;
    isChainingNow = true;
    try {
      let next = preloadedSequence;
      if (!next && currentSequence) {
        const endState = extractEndState(currentSequence);
        next = await spinnerOrchestrator.getNextSequence(endState);
        if (!next) next = await spinnerOrchestrator.getInitialSequence();
      }
      if (next) hotSwapSequence(next);
      preloadedSequence = null;
    } catch (err) {
      console.error("[PlayWithIt] Chain failed:", err);
    } finally {
      isChainingNow = false;
    }
  }

  function hotSwapSequence(sequenceData: SequenceData) {
    if (!playbackController) return;
    currentSequence = sequenceData;
    pushToHistory(sequenceData);
    lastStep = -1;

    const sequence = applyPropTypeToSequence(sequenceData, currentPropType);
    animationState.setShouldLoop(true);
    playbackController.updateSequenceData(sequence);
    playbackController.seekToStep(1);
    animationState.setPlaybackMode("continuous");
    if (!animationState.isPlaying) {
      playbackController.togglePlayback();
    }
  }

  async function loadSequence(sequenceData: SequenceData) {
    if (!playbackController) return;
    animationReady = false;

    try {
      if (animationState.isPlaying) {
        playbackController.togglePlayback();
      }
      animationState.reset();
      currentSequence = sequenceData;
      pushToHistory(sequenceData);
      lastStep = -1;

      const sequence = applyPropTypeToSequence(sequenceData, currentPropType);
      animationState.setShouldLoop(true);
      const success = playbackController.initialize(sequence, animationState);
      if (!success) throw new Error("Playback init failed");

      animationReady = true;
      isLoading = false;
      await tick();

      animationState.setPlaybackMode("continuous");
      animationState.setCurrentStep(1);
      playbackController.togglePlayback();
    } catch (err) {
      console.error("[PlayWithIt] Load sequence failed:", err);
      animationError = true;
      isLoading = false;
    }
  }

  // ── Derived display values ──────────────────────────────────────────────────
  let propLabel = $derived(PROP_LABELS[currentPropType] ?? "Staff");
  let effortLabel = $derived(EFFORTS.find((e) => e.id === activeEffort)?.label ?? "Linear");
  let effortColor = $derived(EFFORT_COLORS[activeEffort] ?? "#94a3b8");
  let isDisabled = $derived(!servicesReady || isLoading);

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
    const seq = animationState.sequenceData;
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
    if (!beatStripEl || !animationState.isPlaying) return;
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
            class:active={animationState.isPlaying}
            onclick={togglePlayPause}
            disabled={isDisabled || !animationReady}
            aria-label={animationState.isPlaying ? "Pause animation" : "Play animation"}
            style="--chip-color: #d4813a;"
          >
            {#if animationState.isPlaying}
              <span class="playback-icon" aria-hidden="true">⏸</span>
            {:else}
              <span class="playback-icon" aria-hidden="true">▶</span>
            {/if}
            <span class="pill-text">{animationState.isPlaying ? "Pause" : "Play"}</span>
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
            onclick={() => currentSequence && copySequenceData(currentSequence)}
            disabled={isDisabled || !currentSequence}
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
            disabled={sequenceHistory.length === 0}
            aria-label={showHistory ? "Hide sequence history" : "Show sequence history"}
            aria-expanded={showHistory}
            style="--chip-color: #a78bfa;"
          >
            <i class="fas fa-history" aria-hidden="true"></i>
            <span class="pill-text">History ({sequenceHistory.length})</span>
          </button>
        </div>
      </div>
    </div>
    <div class="canvas-area">
      {#if animationReady && !isLoading}
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
            isPlaying={animationState.isPlaying}
            trailSettings={animationSettings.trail}
            bluePropType={currentPropType}
            redPropType={currentPropType}
            word={animationState.sequenceData?.intendedWord ?? animationState.sequenceData?.word ?? null}
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
    {#if animationState.sequenceData && notationCells.length > 0}
      <div class="beat-strip" bind:this={beatStripEl}>
        {#each notationCells as cell, i (cell.key)}
          {@const isActive = animationState.isPlaying && (
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
    {#if showHistory && sequenceHistory.length > 0}
      <div class="history-panel">
        <div class="history-header">
          <span class="history-title">Recent Sequences ({sequenceHistory.length})</span>
          <button class="history-close" onclick={() => showHistory = false} aria-label="Close history">
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
        <div class="history-list">
          {#each sequenceHistory as entry, i (entry.timestamp.getTime())}
            {@const isCurrent = i === 0}
            <div class="history-row" class:current={isCurrent}>
              <div class="history-info">
                <span class="history-word">{entry.word}</span>
                {#if entry.loopType}
                  <span class="history-loop">{entry.loopType}</span>
                {/if}
                <span class="history-steps">{entry.stepCount} beats</span>
                <span class="history-time">
                  {entry.timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
                </span>
              </div>
              <button
                class="history-copy-btn"
                onclick={() => copySequenceData(entry.sequence)}
                aria-label="Copy sequence data for {entry.word}"
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
