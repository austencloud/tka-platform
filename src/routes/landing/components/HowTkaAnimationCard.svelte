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
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
  import type { StartPositionDeriver } from "$lib/shared/pictograph/shared/services/start-position-deriver";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { startPositionDeriver as startPositionDeriverInstance } from "$lib/shared/pictograph/shared/services/start-position-deriver";
  import {
    animationSettings,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { shouldEnableAssemblyPlayback } from "./how-tka-assembly-model";

  interface Props {
    sequence: SequenceData;
    propType?: PropType;
    active?: boolean;
  }

  let { sequence, propType = PropType.STAFF, active = false }: Props = $props();

  // Loading and playback are both gated. Merely mounting the hidden playback
  // stage must not initialize the animation engine.
  let containerRef: HTMLElement | null = null;
  let hasStartedLoading = $state(false);
  let sectionVisible = $state(false);
  let documentVisible = $state(true);
  let initializing = $state(false);

  // Animation engine state. Ephemeral so this teaching card runs at a fixed
  // 60 BPM and never inherits — or overwrites — the user's saved playback prefs.
  const animationState = createAnimationPanelState({ ephemeral: true });
  let playbackController: AnimationPlaybackController | null = null;
  let startPositionDeriver: StartPositionDeriver | null = null;
  let animationReady = $state(false);
  let animationError = $state(false);
  // Dynamically imported - null until the card scrolls into view
  let AnimatorCanvasComponent = $state<Component | null>(null);

  // Per-instance visibility manager so this card's settings don't conflict
  // with other AnimatorCanvas instances on the same page (e.g. PlayWithItInner).
  // Ephemeral: no localStorage persistence, no global dark-class sync.
  const visibilityManager = new AnimationVisibilityStateManager({
    ephemeral: true,
  });

  // Apply prop type to all motions in the sequence
  function applyPropType(seq: SequenceData): SequenceData {
    const apply = (data: any) => {
      if (!data?.motions) return data;
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
      ...seq,
      startPosition: seq.startPosition ? apply(seq.startPosition) : undefined,
      steps: seq.steps?.map((s: any) => apply(s)) ?? [],
    };
  }

  // Derived values for AnimatorCanvas
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
  let playbackEnabled = $derived(
    shouldEnableAssemblyPlayback({ active, sectionVisible, documentVisible })
  );

  onMount(() => {
    if (!containerRef) return;

    const updateDocumentVisibility = () => {
      documentVisible = !document.hidden;
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        sectionVisible = entry?.isIntersecting ?? false;
      },
      { rootMargin: "200px", threshold: 0.1 }
    );

    updateDocumentVisibility();
    document.addEventListener("visibilitychange", updateDocumentVisibility);
    observer.observe(containerRef);

    return () => {
      observer.disconnect();
      document.removeEventListener(
        "visibilitychange",
        updateDocumentVisibility
      );
    };
  });

  $effect(() => {
    if (!playbackEnabled) {
      if (animationState.isPlaying) playbackController?.togglePlayback();
      return;
    }

    if (!hasStartedLoading && !initializing) {
      hasStartedLoading = true;
      void initializeAnimation();
      return;
    }

    if (animationReady && !animationState.isPlaying) {
      playbackController?.togglePlayback();
    }
  });

  onDestroy(() => {
    playbackController?.dispose();
    animationState.dispose();
  });

  async function initializeAnimation() {
    initializing = true;
    animationError = false;
    try {
      // Configure for a clean, dark, no-frills look
      animationSettings.setTrackingMode(TrackingMode.BOTH_ENDS);
      visibilityManager.setDarkMode(true);
      visibilityManager.setActiveEffect("none");
      // Hard-code ARC paths for this teaching card. Without this it inherits the
      // user's saved global pathShape (linear/concave/hybrid).
      visibilityManager.setPathShape("arc");
      visibilityManager.setMotionAwarePaths(false);

      // Pass the ephemeral manager so prop interpolation reads ARC from THIS
      // scope, not the global singleton (matches PlayWithItInner's wiring).
      playbackController = createAnimationPlaybackController(visibilityManager);
      startPositionDeriver = startPositionDeriverInstance;

      const prepared = applyPropType(sequence);

      animationState.setShouldLoop(true);
      // Hard-code 60 BPM (speed 1.0). Ephemeral state means this won't persist.
      animationState.setSpeed(1.0);
      const success = playbackController.initialize(prepared, animationState);
      if (!success) throw new Error("Playback init failed");

      // Dynamically import the animation canvas - keeps it out of the initial bundle
      const mod =
        await import("$lib/shared/animation-engine/components/AnimatorCanvas.svelte");
      AnimatorCanvasComponent = mod.default as Component;

      animationReady = true;
      await tick();

      animationState.setPlaybackMode("continuous");
      animationState.setCurrentStep(1);
      if (playbackEnabled && !animationState.isPlaying) {
        playbackController.togglePlayback();
      }
    } catch (err) {
      console.error("[HowTkaAnimationCard] Failed to initialize:", err);
      animationError = true;
    } finally {
      initializing = false;
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
