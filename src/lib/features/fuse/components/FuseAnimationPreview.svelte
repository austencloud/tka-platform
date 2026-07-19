<!--
  The one live canvas in Fuse. The shared Fuse clock supplies a continuous
  step, while this component owns only animation-engine initialization.
-->
<script lang="ts">
  import { onDestroy, onMount, untrack } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import { createPlaybackControllerFactory } from "$lib/shared/animation-engine/create-playback-controller-factory";
  import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { ensureMotionData } from "$lib/shared/sequence-viewer/services/sequence-motion-loader";

  let {
    sequence,
    currentStep = 0,
    isPlaying = false,
    onError,
  }: {
    sequence: SequenceData;
    currentStep?: number;
    isPlaying?: boolean;
    onError?: (error: Error) => void;
  } = $props();

  let controller = $state<AnimationPlaybackController | null>(null);
  const animState = createAnimationPanelState({ ephemeral: true });
  let initialized = $state(false);
  let totalSteps = $state(0);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let initializationGeneration = 0;
  let destroyed = false;

  const animCurrentStep = $derived(animState.currentStep);
  const bluePropState = $derived(animState.bluePropState);
  const redPropState = $derived(animState.redPropState);
  const sequenceData = $derived(animState.sequenceData ?? sequence);

  const stepData = $derived.by(() => {
    const activeSequence = sequenceData;
    if (!activeSequence) return null;
    if (animCurrentStep < 1) return activeSequence.startPosition ?? null;
    const index = Math.min(
      Math.max(0, Math.floor(animCurrentStep) - 1),
      (activeSequence.steps.length || 1) - 1
    );
    return activeSequence.steps[index] ?? null;
  });

  const gridMode = $derived(sequenceData?.gridMode ?? sequence.gridMode);

  function failInitialization(message: string, cause: unknown): void {
    const failure = cause instanceof Error ? cause : new Error(String(cause));
    error = message;
    loading = false;
    initialized = false;
    onError?.(failure);
  }

  onMount(() => {
    try {
      controller = createPlaybackControllerFactory();
    } catch (cause) {
      failInitialization("Preview unavailable", cause);
    }
  });

  onDestroy(() => {
    destroyed = true;
    initializationGeneration += 1;
    controller?.dispose();
    animState.dispose();
  });

  $effect(() => {
    const activeController = controller;
    const inputSequence = sequence;
    if (!activeController) return;

    const generation = ++initializationGeneration;
    let cancelled = false;
    loading = true;
    error = null;
    initialized = false;
    totalSteps = 0;

    void (async () => {
      try {
        if (animState.isPlaying) activeController.togglePlayback();
        animState.reset();

        const fullSequence = await ensureMotionData(inputSequence);
        if (cancelled || destroyed || generation !== initializationGeneration) {
          return;
        }
        if (!fullSequence) {
          failInitialization(
            "Preview unavailable",
            new Error("Sequence motion data could not be loaded")
          );
          return;
        }

        animState.setShouldLoop(true);
        if (!activeController.initialize(fullSequence, animState)) {
          failInitialization(
            "Preview unavailable",
            new Error("The animation controller rejected the fused sequence")
          );
          return;
        }

        totalSteps = fullSequence.steps.length || 1;
        initialized = true;
        loading = false;

        const beat = untrack(() => currentStep);
        const initialBeat = beat > 0 ? (beat % totalSteps) + 1 : 0;
        activeController.calculateStateForStep(initialBeat);
        animState.setCurrentStep(initialBeat);
      } catch (cause) {
        if (cancelled || destroyed || generation !== initializationGeneration) {
          return;
        }
        failInitialization("Preview unavailable", cause);
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  // calculateStateForStep reads the shared clock without starting a second
  // playback loop. Pausing Fuse therefore pauses every visual beat together.
  $effect(() => {
    const beat = currentStep;
    const activeController = controller;
    if (!initialized || !activeController || totalSteps <= 0) return;

    untrack(() => {
      const wrappedBeat = (beat % totalSteps) + 1;
      activeController.calculateStateForStep(wrappedBeat);
      animState.setCurrentStep(wrappedBeat);
    });
  });
</script>

<div class="fuse-animation-preview" aria-hidden="true">
  {#if loading}
    <div class="state-message">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Preparing preview...</span>
    </div>
  {:else if error}
    <div class="state-message error-message">{error}</div>
  {:else}
    <div class="canvas-wrap">
      <AnimatorCanvas
        blueProp={bluePropState}
        redProp={redPropState}
        gridVisible={true}
        {gridMode}
        letter={null}
        {stepData}
        {sequenceData}
        currentStep={animCurrentStep}
        {isPlaying}
        word={null}
        hideProgressBar={true}
        hideTkaGlyph={true}
        hideStepNumbers={true}
        progressBarVariant="minimal"
        fillContainer={true}
      />
    </div>
  {/if}
</div>

<style>
  .fuse-animation-preview,
  .canvas-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .state-message {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
    min-height: 180px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
  }

  .error-message {
    color: var(--semantic-error, #fca5a5);
  }

  @media (prefers-reduced-motion: reduce) {
    .fa-spin {
      animation: none;
    }
  }
</style>
