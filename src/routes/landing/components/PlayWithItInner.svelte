<!--
  PlayWithItInner.svelte

  The heavy inner component for the Play With It section. Dynamically imported
  by PlayWithItSection when scrolled into view. Contains the full animation
  engine integration: EndlessSpinnerOrchestrator, AnimatorCanvas, effect
  controls, and prop switching.
-->
<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { IBrowseLoader } from "$lib/features/browse/sequences/display/services/contracts/IBrowseLoader";
  import type { IStartPositionDeriver } from "$lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver";
  import type { IEndlessSpinnerOrchestrator, EndState } from "$lib/features/landing/services/contracts/IEndlessSpinnerOrchestrator";
  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/implementations/EndlessSpinnerOrchestrator";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";
  import { gridPositionDeriver as gridPositionDeriverInstance } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
  import { orientationCalculator as orientationCalculatorInstance } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
  import { startPositionDeriver as startPositionDeriverInstance } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import { generationOrchestrator } from "$lib/features/create/generate/shared/services/implementations/GenerationOrchestrator";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import {
    animationSettings,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import { RANDOM_PROPS } from "../landing-content";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  // ── Effect definitions ──────────────────────────────────────────────────────
  type EffectId = "clean" | "trails" | "fire" | "leds";

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
        sequence.steps?.map((beat) => applyToMotions(beat) as StepData) ?? [],
    };
  }

  // ── Animation state ─────────────────────────────────────────────────────────
  const animationState = createAnimationPanelState();
  let playbackController: IAnimationPlaybackController | null = null;
  let browseLoader: IBrowseLoader | null = null;
  let startPositionDeriver: IStartPositionDeriver | null = null;
  let gridPositionDeriver: IGridPositionDeriver | null = null;
  let spinnerOrchestrator: IEndlessSpinnerOrchestrator | null = null;
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
  const visibilityManager = getAnimationVisibilityManager();

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

  let gridMode = $derived(animationState.sequenceData?.gridMode ?? null);
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

      // Dark mode on for visual impact
      visibilityManager.setDarkMode(true);
      // Trails on by default (matches "trails" active chip)
      visibilityManager.setTrailStyle("on");
      visibilityManager.setFireEffect(false);
      visibilityManager.setLedEffect(false);

      browseLoader = container.items.browseLoader;
      playbackController = container.items.animationPlaybackController;
      startPositionDeriver = startPositionDeriverInstance;
      gridPositionDeriver = gridPositionDeriverInstance;

      const sequenceTransformer = container.items.sequenceTransformer;

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

    // Fire and LEDs are mutually exclusive
    switch (effect) {
      case "clean":
        visibilityManager.setTrailStyle("off");
        visibilityManager.setFireEffect(false);
        visibilityManager.setLedEffect(false);
        break;
      case "trails":
        visibilityManager.setTrailStyle("on");
        visibilityManager.setFireEffect(false);
        visibilityManager.setLedEffect(false);
        break;
      case "fire":
        visibilityManager.setTrailStyle("on");
        visibilityManager.setFireEffect(true);
        visibilityManager.setLedEffect(false);
        break;
      case "leds":
        visibilityManager.setTrailStyle("on");
        visibilityManager.setFireEffect(false);
        visibilityManager.setLedEffect(true);
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
  let isDisabled = $derived(!servicesReady || isLoading);
</script>

<div class="play-inner">
  <!-- Effect chips + prop switcher -->
  <div class="controls-row">
    <div class="effect-chips" role="radiogroup" aria-label="Visual effect">
      {#each EFFECTS as effect}
        <button
          class="chip"
          class:active={activeEffect === effect.id}
          onclick={() => setEffect(effect.id)}
          disabled={isDisabled}
          role="radio"
          aria-checked={activeEffect === effect.id}
          aria-label="{effect.label} effect"
          style="--chip-color: {effect.activeColor};"
        >
          <i class={effect.icon} aria-hidden="true"></i>
          <span>{effect.label}</span>
        </button>
      {/each}
    </div>

    <button
      class="prop-btn"
      onclick={handleChangeProp}
      disabled={isDisabled}
      aria-label="Change prop type, currently {propLabel}"
    >
      <i class="fas fa-random" aria-hidden="true"></i>
      <span>{propLabel}</span>
    </button>
  </div>

  <!-- Showcase: canvas + notation panel -->
  <div class="showcase">
    <div class="canvas-col">
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
          <span>{isLoading ? "Loading..." : "Initializing..."}</span>
        </div>
      {/if}
    </div>

    <!-- Notation side panel (desktop) / beat strip (mobile) -->
    {#if animationState.sequenceData}
      <div class="notation-col">
        <ChoreoCard
          sequence={animationState.sequenceData}
          darkMode={true}
          bluePropType={currentPropType}
          redPropType={currentPropType}
          columnCount={4}
          highlightedStepIndex={currentStepNumber > 0 ? currentStepNumber - 1 : null}
          showHighlight={animationState.isPlaying}
          showDifficultyLevel={false}
          showCreatorName={false}
          showNotes={false}
          showBirthday={false}
          showLoopGlyph={false}
        />
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

  /* ── Controls row ────────────────────────────────────────────────────────── */
  .controls-row {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .effect-chips {
    display: flex;
    gap: 8px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    min-height: 44px;
    border-radius: 100px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .chip:hover:not(:disabled) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    color: var(--theme-text, #fff);
    background: rgba(255, 255, 255, 0.07);
  }

  .chip.active {
    background: color-mix(in srgb, var(--chip-color) 18%, transparent);
    border-color: color-mix(in srgb, var(--chip-color) 50%, transparent);
    color: var(--chip-color);
    box-shadow: 0 0 14px color-mix(in srgb, var(--chip-color) 20%, transparent);
  }

  .chip.active:hover:not(:disabled) {
    background: color-mix(in srgb, var(--chip-color) 28%, transparent);
    border-color: color-mix(in srgb, var(--chip-color) 65%, transparent);
  }

  .chip:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .chip i {
    font-size: 14px;
  }

  /* ── Prop button ─────────────────────────────────────────────────────────── */
  .prop-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 24px;
    min-height: 44px;
    border-radius: 100px;
    border: 1.5px solid rgba(212, 129, 58, 0.35);
    background: rgba(212, 129, 58, 0.1);
    color: #d4813a;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .prop-btn:hover:not(:disabled) {
    background: rgba(212, 129, 58, 0.18);
    border-color: rgba(212, 129, 58, 0.55);
    box-shadow: 0 0 16px rgba(212, 129, 58, 0.15);
  }

  .prop-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .prop-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .prop-btn i {
    font-size: 14px;
  }

  /* ── Showcase grid ───────────────────────────────────────────────────────── */
  .showcase {
    display: grid;
    grid-template-columns: 1fr 260px;
    gap: 24px;
    align-items: start;
    width: 100%;
    max-width: 880px;
  }

  .canvas-col {
    display: flex;
    justify-content: center;
  }

  .canvas-wrapper {
    width: clamp(340px, 50vw, 560px);
    height: clamp(340px, 50vw, 560px);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
  }

  .canvas-placeholder {
    width: clamp(340px, 50vw, 560px);
    height: clamp(340px, 50vw, 560px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
  }

  .placeholder-icon {
    font-size: 3rem;
    opacity: 0.4;
  }

  .notation-col {
    border-radius: 16px;
    overflow: hidden;
    max-height: clamp(340px, 50vw, 560px);
  }

  /* ── Responsive: single column below 800px ───────────────────────────────── */
  @media (max-width: 800px) {
    .showcase {
      grid-template-columns: 1fr;
      justify-items: center;
    }

    .notation-col {
      width: 100%;
      max-width: min(500px, 90vw);
      max-height: 280px;
    }
  }

  /* ── Mobile: tighter canvas ──────────────────────────────────────────────── */
  @media (max-width: 600px) {
    .controls-row {
      gap: 8px;
    }

    .chip {
      padding: 8px 14px;
      font-size: var(--font-size-compact, 12px);
      gap: 6px;
    }

    .prop-btn {
      padding: 8px 16px;
      font-size: var(--font-size-compact, 12px);
    }

    .canvas-wrapper {
      width: min(340px, 90vw);
      height: min(340px, 90vw);
    }

    .canvas-placeholder {
      width: min(340px, 90vw);
      height: min(340px, 90vw);
    }

    .notation-col {
      max-height: 220px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chip,
    .prop-btn {
      transition: none;
    }

    .prop-btn:active:not(:disabled) {
      transform: none;
    }
  }
</style>
