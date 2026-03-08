<!--
  ContactBallLab.svelte - Live pictograph with contact ball + acrylic ball prop switching

  Infinite-looping animated pictograph with a prop type selector bar.
  Screen-space sphere shading (edge darkening + specular) is rendered by Canvas2DAnimationRenderer.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { container } from "$lib/shared/di";
  import { Letter } from "$lib/shared/foundation/domain/models/Letter";

  import { AnimationPlaybackController } from "$lib/features/compose/services/implementations/AnimationPlaybackController";
  import { SequenceAnimationOrchestrator } from "$lib/features/compose/services/implementations/SequenceAnimationOrchestrator";
  import { AnimationStateManager } from "$lib/features/compose/services/implementations/AnimationStateManager";
  import { AnimationLoop } from "$lib/features/compose/services/implementations/AnimationLoop";
  import { StepCalculator } from "$lib/features/compose/services/implementations/StepCalculator";

  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/implementations/EndlessSpinnerOrchestrator";
  import { InfiniteSequenceGenerator } from "$lib/features/landing/services/implementations/InfiniteSequenceGenerator";
  import { SpinnerMetricsRepository } from "$lib/features/landing/services/implementations/SpinnerMetricsRepository";
  import { orientationCycleExtender } from "$lib/features/create/generate/circular/services/implementations/OrientationCycleExtender";
  import { SequenceChainingOrchestrator } from "$lib/features/effects-lab/services/implementations/SequenceChainingOrchestrator";
  import type { ISequenceChainingOrchestrator } from "$lib/features/effects-lab/services/contracts/ISequenceChainingOrchestrator";
  import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";


  // ─── Independent ball property selectors ─────────────────────────────
  const MATERIALS = [
    { id: "contact", label: "Standard" },
    { id: "glass", label: "Glass" },
    { id: "pmma", label: "PMMA" },
    { id: "frosted", label: "Frosted" },
  ] as const;

  const SIZES = [
    { id: "", label: "Normal" },
    { id: "big", label: "Big" },
  ] as const;

  const COUNTS = [
    { id: "", label: "Single" },
    { id: "double", label: "Double" },
  ] as const;

  let selectedMaterial = $state<string>("contact");
  let selectedSize = $state<string>("");
  let selectedCount = $state<string>("");

  // Compose prop type: {big?}{double?}{material}ball
  let selectedBallType = $derived(
    `${selectedSize}${selectedCount}${selectedMaterial}ball`
  );

  // ─── Animation infrastructure ────────────────────────────────────────
  let playbackController: IAnimationPlaybackController | null = null;
  let chainingOrchestrator = $state<ISequenceChainingOrchestrator | null>(null);
  let servicesReady = $state(false);
  let sequence = $state<SequenceData | null>(null);
  let isPlaying = $state(false);
  let error = $state<string | null>(null);
  let playbackStartTimer: ReturnType<typeof setTimeout> | null = null;

  const animationState = createAnimationPanelState();

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

  // Auto-chaining
  $effect(() => {
    if (!chainingOrchestrator) return;
    chainingOrchestrator.checkAndChain(
      Math.floor(animationState.currentStep),
      animationState.totalSteps,
      "infinite",
      servicesReady,
      !!sequence
    );
  });

  $effect(() => {
    if (!chainingOrchestrator) return;
    chainingOrchestrator.checkAndPreload(
      Math.floor(animationState.currentStep),
      animationState.totalSteps,
      "infinite",
      servicesReady,
      !!sequence
    );
  });

  // ─── Initialization ──────────────────────────────────────────────────
  onMount(async () => {
    try {
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
      chainingOrchestrator.startAutoMode("infinite");
    } catch (err) {
      console.error("ContactBallLab: failed to initialize:", err);
      error = "Failed to initialize animation";
    }
  });

  onDestroy(() => {
    if (playbackStartTimer !== null) clearTimeout(playbackStartTimer);
    chainingOrchestrator?.dispose();
    playbackController?.dispose();
    animationState.dispose();
  });

  function togglePlayback() {
    playbackController?.togglePlayback();
  }

</script>

<div class="lab-root">
  <div class="canvas-area">
    {#if !sequence}
      <div class="loading-state">
        <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
        <span>Generating sequence...</span>
      </div>
    {:else if error}
      <div class="error-state">
        <span>{error}</span>
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
          bluePropType={selectedBallType}
          redPropType={selectedBallType}
          word={sequence?.word || sequence?.name || null}
          backgroundAlpha={0}
          focused={true}
        />
      </div>
    {/if}
  </div>

  <div class="controls-bar">
    <div class="selector-group">
      <span class="selector-label">Material</span>
      <div class="selector-row">
        {#each MATERIALS as m}
          <button
            class="pill"
            class:active={selectedMaterial === m.id}
            onclick={() => (selectedMaterial = m.id)}
          >
            {m.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="selector-group">
      <span class="selector-label">Size</span>
      <div class="selector-row">
        {#each SIZES as s}
          <button
            class="pill"
            class:active={selectedSize === s.id}
            onclick={() => (selectedSize = s.id)}
          >
            {s.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="selector-group">
      <span class="selector-label">Count</span>
      <div class="selector-row">
        {#each COUNTS as c}
          <button
            class="pill"
            class:active={selectedCount === c.id}
            onclick={() => (selectedCount = c.id)}
          >
            {c.label}
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .lab-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #ffffff);
  }

  /* ─── Canvas fills all available space ─────────────────────── */
  .canvas-area {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .canvas-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ─── Controls bar at bottom ───────────────────────────────── */
  .controls-bar {
    display: flex;
    gap: 24px;
    padding: 12px 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    justify-content: center;
    flex-wrap: wrap;
  }

  .selector-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .selector-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }

  .selector-row {
    display: flex;
    gap: 4px;
  }

  .pill {
    padding: 6px 14px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 150ms ease;
  }

  .pill:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .pill.active {
    border-color: var(--theme-accent, #6366f1);
    background: rgba(99, 102, 241, 0.12);
    color: var(--theme-text, #ffffff);
  }

  .pill:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* ─── Shared states ──────────────────────────────────────── */
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }

  .error-state {
    color: var(--semantic-error, #ef4444);
  }

  @media (prefers-reduced-motion: reduce) {
    .pill {
      transition: none;
    }
  }

  @media (max-width: 768px) {
    .controls-bar {
      flex-direction: column;
      gap: 10px;
      padding: 10px 16px;
    }

    .selector-group {
      flex-wrap: wrap;
    }
  }
</style>
