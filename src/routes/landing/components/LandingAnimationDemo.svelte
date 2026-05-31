<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { createEndlessPlayback, type EndlessPlaybackState } from "$lib/shared/animation-engine/state/endless-playback-state.svelte";
  import * as propTypeApplier from "$lib/shared/landing/services/prop-type-applier";
  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/endless-spinner-orchestrator";
  import { getBrowseLoader } from "$lib/shared/browse/getBrowseLoader";
  import { getAnimationPlaybackController } from "$lib/shared/animation-engine/getAnimationPlaybackController";
  import { sequenceTransformer } from "$lib/shared/create/services/SequenceTransformer";

  import { startPositionDeriver as startPositionDeriverInstance } from "$lib/shared/pictograph/shared/services/start-position-deriver";
  import { generationOrchestrator } from "$lib/shared/create/services/GenerationOrchestrator";
  import {
    animationSettings,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import DemoControlBar from "./DemoControlBar.svelte";
  import { RANDOM_PROPS } from "../landing-content";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

  // Transition key - changes trigger the crossfade animation
  let transitionKey = $state(0);

  // Lazy loading - only load animation engine when in viewport
  let containerRef: HTMLElement | null = null;
  let isInView = $state(false);
  let hasStartedLoading = $state(false);

  // Factory state
  let playback = $state<EndlessPlaybackState | null>(null);
  let servicesReady = $state(false);
  let animationReady = $state(false);

  interface Props {
    onPropTypeChange?: (propType: PropType) => void;
  }

  let { onPropTypeChange }: Props = $props();

  let animationError = $state(false);
  let isLoading = $state(false);

  // Dynamic sequence loading - circular LOOPs from the database
  let currentSequence = $state<SequenceData | null>(null);
  // Always start with staff on the landing page - it's the canonical TKA prop
  let currentPropType = $state<PropType>(PropType.STAFF);

  // Dark mode - default ON for landing page visual impact
  let darkMode = $state(true);
  let fireEnabled = $state(false);
  let ledEnabled = $state(false);
  let trailsEnabled = $state(true); // Trails on by default
  const visibilityManager = getAnimationVisibilityManager();

  // Sync currentSequence from factory
  $effect(() => {
    if (playback?.currentSequence) {
      currentSequence = playback.currentSequence;
    }
  });

  // Intersection Observer for lazy loading - only load animation engine when visible
  onMount(() => {
    if (!containerRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !hasStartedLoading) {
          isInView = true;
          hasStartedLoading = true;
          loadAnimationEngine();
          observer.disconnect();
        }
      },
      { rootMargin: "100px", threshold: 0.1 }
    );

    observer.observe(containerRef);

    return () => observer.disconnect();
  });

  async function loadAnimationEngine() {
    try {
      animationSettings.setTrackingMode(TrackingMode.BOTH_ENDS);

      // Enable dark mode on mount for visual impact
      visibilityManager.setDarkMode(darkMode);

      // Get services
      const browseLoader = getBrowseLoader();
      const pc = getAnimationPlaybackController();

      // Create EndlessSpinnerOrchestrator (library-mode sequence provider)
      const spinnerOrch = new EndlessSpinnerOrchestrator(
        browseLoader as any,
        generationOrchestrator,
        sequenceTransformer as any,
        startPositionDeriverInstance
      );

      // Noop infinite generator (this surface is library-only)
      const noopInfinite = {
        generateInitial: async () => null,
        generateFromEndState: async () => null,
        getSessionCount: () => 0,
      };

      // Create factory
      playback = createEndlessPlayback({
        modes: ["library"],
        defaultMode: "library",
        propType: currentPropType,
        spinnerOrchestrator: spinnerOrch,
        infiniteGenerator: noopInfinite,
        playbackController: pc,
      });

      await playback.initialize();
      servicesReady = true;
      animationReady = true;
    } catch (err) {
      console.error("Failed to load hero animation:", err);
      animationError = true;
    }
  }

  onDestroy(() => {
    playback?.dispose();
  });

  /**
   * Get a new random sequence (for manual randomize button)
   */
  async function loadRandomSequence() {
    if (!playback) return;

    isLoading = true;

    try {
      // Pick a random prop type
      currentPropType = RANDOM_PROPS[Math.floor(Math.random() * RANDOM_PROPS.length)]!;
      playback.setPropType(currentPropType);
      await playback.shuffle();
      transitionKey++;
    } catch (err) {
      console.error("[LandingDemo] Failed to load random sequence:", err);
    } finally {
      isLoading = false;
    }
  }

  function handleRandomize() {
    loadRandomSequence();
  }

  function handleChangeProp() {
    // Cycle to a different random prop type (avoid picking the same one)
    let newPropType = currentPropType;
    while (newPropType === currentPropType && RANDOM_PROPS.length > 1) {
      newPropType =
        RANDOM_PROPS[Math.floor(Math.random() * RANDOM_PROPS.length)]!;
    }
    currentPropType = newPropType;
    playback?.setPropType(newPropType);

    // Hot swap - instant prop change without transition animation
    if (playback?.animationState.sequenceData) {
      const updatedSequence = propTypeApplier.applyToSequence(
        playback.animationState.sequenceData,
        newPropType
      );
      playback.animationState.setSequenceData(updatedSequence);
    }
    onPropTypeChange?.(newPropType);
  }

  function handleToggleDarkMode() {
    darkMode = !darkMode;
    visibilityManager.setDarkMode(darkMode);
  }

  function handleToggleFire() {
    fireEnabled = !fireEnabled;
    if (fireEnabled) {
      ledEnabled = false;
      visibilityManager.setActiveEffect("fire");
    } else {
      visibilityManager.setActiveEffect("none");
    }
  }

  function handleToggleLed() {
    ledEnabled = !ledEnabled;
    if (ledEnabled) {
      fireEnabled = false;
      visibilityManager.setActiveEffect("led");
    } else {
      visibilityManager.setActiveEffect("none");
    }
  }

  function handleToggleTrails() {
    trailsEnabled = !trailsEnabled;
    visibilityManager.setActiveEffect(trailsEnabled ? "trails" : "none");
  }
</script>

<div class="demo-container" bind:this={containerRef}>
  {#key transitionKey}
    <div
      class="demo-transition-wrapper"
      in:scale={{
        duration: 350,
        delay: 100,
        start: 0.95,
        opacity: 0,
        easing: backOut,
      }}
      out:scale={{ duration: 200, start: 0.98, opacity: 0, easing: cubicOut }}
    >
      <div class="demo-layout">
        <div class="demo-content-row">
          <div class="animation-preview">
            {#if animationReady && !isLoading}
              <div class="canvas-wrapper">
                <AnimatorCanvas
                  blueProp={playback?.animationState.bluePropState ?? null}
                  redProp={playback?.animationState.redPropState ?? null}
                  gridVisible={true}
                  gridMode={playback?.gridMode ?? null}
                  letter={playback?.currentLetter ?? null}
                  stepData={playback?.currentStepData}
                  sequenceData={playback?.animationState.sequenceData}
                  currentStep={playback?.animationState.currentStep ?? 0}
                  isPlaying={playback?.animationState.isPlaying ?? false}
                  trailSettings={animationSettings.trail}
                  bluePropType={currentPropType}
                  redPropType={currentPropType}
                  word={playback?.animationState.sequenceData?.intendedWord ?? playback?.animationState.sequenceData?.word ?? null}
                  previewDarkMode={darkMode}
                />
              </div>
            {:else if animationError}
              <div class="animation-fallback">
                <div class="fallback-icon">🌀</div>
                <span>Animation Preview</span>
              </div>
            {:else}
              <div class="animation-loading">
                <ProgressRing percent={-1} size={32} strokeWidth={3} />
                <span>{isLoading ? "Loading animation..." : "Initializing..."}</span>
              </div>
            {/if}
          </div>

          {#if playback?.animationState.sequenceData}
            <div class="beat-grid-panel">
              <ChoreoCard
                sequence={playback.animationState.sequenceData}
                {darkMode}
                bluePropType={currentPropType}
                redPropType={currentPropType}
                columnCount={4}
                highlightedStepIndex={Math.floor(playback.animationState.currentStep) > 0 ? Math.floor(playback.animationState.currentStep) - 1 : null}
                showHighlight={playback.animationState.isPlaying}
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
    </div>
  {/key}

  <div class="controls-wrapper">
    <DemoControlBar
      {servicesReady}
      {isLoading}
      {darkMode}
      {fireEnabled}
      {ledEnabled}
      {trailsEnabled}
      onToggleDarkMode={handleToggleDarkMode}
      onToggleFire={handleToggleFire}
      onToggleLed={handleToggleLed}
      onToggleTrails={handleToggleTrails}
      onChangeProp={handleChangeProp}
      onRandomize={handleRandomize}
    />
  </div>
</div>

<style>
  .demo-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(16px, 3vw, 24px);
    width: 100%;
    container-type: inline-size;
  }

  .demo-transition-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .demo-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(12px, 2cqw, 20px);
    width: 100%;
    max-width: 900px;
  }

  .demo-content-row {
    display: flex;
    align-items: stretch;
    justify-content: center;
    gap: clamp(16px, 3cqw, 32px);
    width: 100%;
  }

  .animation-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 0 0 auto;
  }

  .canvas-wrapper {
    width: clamp(420px, 57cqw, 600px);
    height: clamp(420px, 57cqw, 600px);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  }

  .animation-loading,
  .animation-fallback {
    width: 420px;
    height: 420px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .fallback-icon {
    font-size: 4rem;
    opacity: 0.5;
  }

  .controls-wrapper {
    margin-top: 24px;
  }

  /* Tablet - show both but stacked */
  @media (max-width: 900px) {
    .demo-content-row {
      flex-direction: column;
      align-items: center;
    }

  }

  /* Mobile - hide beat grid, focus on animation */
  @media (max-width: 600px) {
    .canvas-wrapper {
      width: min(380px, 90vw);
      height: min(380px, 90vw);
    }

    .animation-loading,
    .animation-fallback {
      width: min(380px, 90vw);
      height: min(380px, 90vw);
    }
  }

</style>
