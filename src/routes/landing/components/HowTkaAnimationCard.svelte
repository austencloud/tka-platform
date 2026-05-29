<!--
  HowTkaAnimationCard.svelte

  Self-contained mini animation player for the "Watch it move" card in
  HowTkaWorksSection. Lazy-loads the animation engine when scrolled into view,
  then auto-plays the provided sequence in a continuous loop.

  No controls, no overlays - just the raw canvas filling its container.
-->
<script lang="ts">

import { createAnimationPlaybackController } from "$lib/features/compose/services/animation-playback-controller-factory";
  import { onMount, onDestroy, tick } from "svelte";
  import type { Component } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/implementations/AnimationPlaybackController";
  import type { StartPositionDeriver } from "$lib/shared/pictograph/shared/services/start-position-deriver";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { startPositionDeriver as startPositionDeriverInstance } from "$lib/shared/pictograph/shared/services/start-position-deriver";
  import {
    animationSettings,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

  interface Props {
    sequence: SequenceData;
    propType?: PropType;
  }

  let { sequence, propType = PropType.STAFF }: Props = $props();

  // Lazy loading via IntersectionObserver
  let containerRef: HTMLElement | null = null;
  let hasStartedLoading = $state(false);

  // Animation engine state
  const animationState = createAnimationPanelState();
  let playbackController: AnimationPlaybackController | null = null;
  let startPositionDeriver: StartPositionDeriver | null = null;
  let animationReady = $state(false);
  let animationError = $state(false);
  // Dynamically imported - null until the card scrolls into view
  let AnimatorCanvasComponent = $state<Component | null>(null);

  // Per-instance visibility manager so this card's settings don't conflict
  // with other AnimatorCanvas instances on the same page (e.g. PlayWithItInner).
  // Ephemeral: no localStorage persistence, no global dark-class sync.
  const visibilityManager = new AnimationVisibilityStateManager({ ephemeral: true });

  // Apply prop type to all motions in the sequence
  function applyPropType(seq: SequenceData): SequenceData {
    const apply = (data: any) => {
      if (!data?.motions) return data;
      return {
        ...data,
        motions: {
          blue: data.motions.blue ? { ...data.motions.blue, propType } : undefined,
          red: data.motions.red ? { ...data.motions.red, propType } : undefined,
        },
      };
    };
    return {
      ...seq,
      startPosition: seq.startPosition ? apply(seq.startPosition) : undefined,
      steps: seq.steps?.map((s: any) => apply(s)) ?? [],
    };
  }

  // Derived values for AnimatorCanvas
  let derivedStartPosition = $derived.by(() => {
    if (!animationState.sequenceData || !startPositionDeriver) return null;
    return startPositionDeriver.getOrDeriveStartPosition(animationState.sequenceData);
  });

  let currentLetter = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const step = animationState.currentStep;
    if (step < 1) return derivedStartPosition?.letter || null;
    if (animationState.sequenceData.steps?.length > 0) {
      const idx = Math.max(0, Math.min(Math.floor(step) - 1, animationState.sequenceData.steps.length - 1));
      return animationState.sequenceData.steps[idx]?.letter || null;
    }
    return null;
  });

  let currentStepData = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const step = animationState.currentStep;
    if (step < 1) return derivedStartPosition || null;
    if (animationState.sequenceData.steps?.length > 0) {
      const idx = Math.max(0, Math.min(Math.floor(step) - 1, animationState.sequenceData.steps.length - 1));
      return animationState.sequenceData.steps[idx] || null;
    }
    return null;
  });

  let gridMode = $derived(animationState.sequenceData?.gridMode ?? null);

  // IntersectionObserver: only initialize when visible
  onMount(() => {
    if (!containerRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !hasStartedLoading) {
          hasStartedLoading = true;
          initializeAnimation();
          observer.disconnect();
        }
      },
      { rootMargin: "200px", threshold: 0.1 }
    );

    observer.observe(containerRef);

    return () => observer.disconnect();
  });

  onDestroy(() => {
    playbackController?.dispose();
    animationState.dispose();
  });

  async function initializeAnimation() {
    try {
      // Configure for a clean, dark, no-frills look
      animationSettings.setTrackingMode(TrackingMode.BOTH_ENDS);
      visibilityManager.setDarkMode(true);
      visibilityManager.setActiveEffect("none");

      playbackController = createAnimationPlaybackController();
      startPositionDeriver = startPositionDeriverInstance;

      const prepared = applyPropType(sequence);

      animationState.setShouldLoop(true);
      const success = playbackController.initialize(prepared, animationState);
      if (!success) throw new Error("Playback init failed");

      // Dynamically import the animation canvas - keeps it out of the initial bundle
      const mod = await import(
        "$lib/shared/animation-engine/components/AnimatorCanvas.svelte"
      );
      AnimatorCanvasComponent = mod.default as Component;

      animationReady = true;
      await tick();

      animationState.setPlaybackMode("continuous");
      animationState.setCurrentStep(1);
      playbackController.togglePlayback();
    } catch (err) {
      console.error("[HowTkaAnimationCard] Failed to initialize:", err);
      animationError = true;
    }
  }
</script>

<div class="animation-card" bind:this={containerRef}>
  {#if animationReady && AnimatorCanvasComponent}
    <div class="canvas-fill">
      <AnimatorCanvasComponent
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
        bluePropType={propType}
        redPropType={propType}
        word={null}
        previewDarkMode={true}
        hideTkaGlyph={false}
        hideStepNumbers={false}
        hideProgressBar={true}
        fillContainer={true}
        disableContextMenu={true}
        visibilityManagerOverride={visibilityManager}
      />
    </div>
  {:else if animationError}
    <div class="fallback">
      <span>Animation unavailable</span>
    </div>
  {:else if hasStartedLoading}
    <div class="fallback">
      <span>Loading animation...</span>
    </div>
  {/if}
</div>

<style>
  .animation-card {
    width: 100%;
    height: 100%;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
  }

  .canvas-fill {
    width: 100%;
    height: 100%;
  }

  .fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-sm, 0.875rem);
  }

</style>
