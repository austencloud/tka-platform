<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";
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
  import { getAnimationPlaybackController } from "$lib/shared/animation-engine/getAnimationPlaybackController";
  import { getSequenceTransformer } from "$lib/shared/create/getSequenceTransformer";

  import type { GridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
  import { gridPositionDeriver as gridPositionDeriverInstance } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
  import { orientationCalculator as orientationCalculatorInstance } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
  import { startPositionDeriver as startPositionDeriverInstance } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import { generationOrchestrator } from "$lib/shared/create/services/GenerationOrchestrator";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
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
  import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  /**
   * Apply prop type to all motions in sequence data.
   * Used to override props for demo display without affecting user settings.
   */
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

  // Transition key - changes trigger the crossfade animation
  let transitionKey = $state(0);

  // Lazy loading - only load animation engine when in viewport
  let containerRef: HTMLElement | null = null;
  let isInView = $state(false);
  let hasStartedLoading = $state(false);

  // Animation state
  const animationState = createAnimationPanelState();
  let playbackController: AnimationPlaybackController | null = null;
  let browseLoader: PublicSequencesLoader | null = null;
  let startPositionDeriver: StartPositionDeriver | null = null;
  let gridPositionDeriver: GridPositionDeriver | null = null;
  let spinnerOrchestrator: EndlessSpinnerOrchestrator | null = null;
  let servicesReady = $state(false);
  let animationReady = $state(false);
  interface Props {
    onPropTypeChange?: (propType: PropType) => void;
  }

  let { onPropTypeChange }: Props = $props();

  let animationError = $state(false);
  let isLoading = $state(false);
  let isChainingEnabled = $state(true); // Enable endless chaining

  // Dynamic sequence loading - circular LOOPs from the database
  let currentSequence = $state<SequenceData | null>(null);
  // Always start with staff on the landing page - it's the canonical TKA prop
  let currentPropType = $state<PropType>(PropType.STAFF);

  // Track beat for sequence completion detection
  let lastStep = $state(-1);

  // Pre-loaded next sequence for seamless transition
  let preloadedSequence = $state<SequenceData | null>(null);
  let isPreloading = $state(false);

  // Flag to indicate we're in the middle of a seamless chain
  let isChainingNow = $state(false);

  // Dark mode - default ON for landing page visual impact
  let darkMode = $state(true);
  let fireEnabled = $state(false);
  let ledEnabled = $state(false);
  let trailsEnabled = $state(true); // Trails on by default
  const visibilityManager = getAnimationVisibilityManager();

  // Derived start position - uses service to derive from first beat if not stored
  let derivedStartPosition = $derived.by(() => {
    if (!animationState.sequenceData || !startPositionDeriver) return null;
    return startPositionDeriver.getOrDeriveStartPosition(
      animationState.sequenceData
    );
  });

  // Current step data for AnimatorCanvas
  let currentLetter = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const currentStep = animationState.currentStep;

    if (currentStep < 1) {
      return derivedStartPosition?.letter || null;
    }

    if (animationState.sequenceData.steps?.length > 0) {
      const stepIndex = Math.floor(currentStep) - 1;
      const clampedIndex = Math.max(
        0,
        Math.min(stepIndex, animationState.sequenceData.steps.length - 1)
      );
      return animationState.sequenceData.steps[clampedIndex]?.letter || null;
    }

    return null;
  });

  let currentStepData = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const currentStep = animationState.currentStep;

    if (currentStep < 1) {
      return derivedStartPosition || null;
    }

    if (animationState.sequenceData.steps?.length > 0) {
      const stepIndex = Math.floor(currentStep) - 1;
      const clampedIndex = Math.max(
        0,
        Math.min(stepIndex, animationState.sequenceData.steps.length - 1)
      );
      return animationState.sequenceData.steps[clampedIndex] || null;
    }

    return null;
  });

  let gridMode = $derived(animationState.sequenceData?.gridMode ?? null);
  let currentStepNumber = $derived(Math.floor(animationState.currentStep));

  // Pre-load next sequence when we're partway through current one
  $effect(() => {
    const currentStep = Math.floor(animationState.currentStep);
    const totalSteps = animationState.totalSteps;

    // Start pre-loading around beat 2 (gives time to load before sequence ends)
    const shouldPreload =
      isChainingEnabled &&
      servicesReady &&
      animationReady &&
      !isPreloading &&
      !preloadedSequence &&
      currentSequence &&
      totalSteps > 2 &&
      currentStep >= 2 &&
      currentStep < totalSteps - 1;

    if (shouldPreload) {
      preloadNextSequence();
    }
  });

  // Watch for sequence completion to chain to next sequence
  $effect(() => {
    const currentStep = Math.floor(animationState.currentStep);
    const totalSteps = animationState.totalSteps;

    // Detect when sequence loops back to beginning (completion)
    if (
      isChainingEnabled &&
      servicesReady &&
      !isChainingNow &&
      animationReady &&
      lastStep >= totalSteps - 1 &&
      currentStep <= 1 &&
      totalSteps > 0
    ) {
      // Sequence completed - chain to next
      chainToNextSequence();
    }

    lastStep = currentStep;
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

      // Get services from DI container (some still need container, others use direct imports)
      browseLoader = getBrowseLoader();
      playbackController = getAnimationPlaybackController();
      startPositionDeriver = startPositionDeriverInstance;
      gridPositionDeriver = gridPositionDeriverInstance;

      // Create and initialize the spinner orchestrator for endless chaining
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

      // Load initial sequence
      const initialSequence = await spinnerOrchestrator.getInitialSequence();
      if (initialSequence) {
        await loadSequence(initialSequence);
      } else {
        animationError = true;
      }
    } catch (err) {
      console.error("Failed to load hero animation:", err);
      animationError = true;
    }
  }

  onDestroy(() => {
    playbackController?.dispose();
    animationState.dispose();
  });

  /**
   * Extract end state from current sequence's last beat.
   * Derives the end position from the motion's endLocation fields using GridPositionDeriver.
   */
  function extractEndState(sequence: SequenceData): EndState {
    const lastStep = sequence.steps?.[sequence.steps.length - 1];

    // Get the end position - try stored value first, then derive from motion end locations
    let position = lastStep?.endPosition ?? null;

    if (!position && gridPositionDeriver && lastStep?.motions) {
      const blueMotion = lastStep.motions[MotionColor.BLUE];
      const redMotion = lastStep.motions[MotionColor.RED];

      if (blueMotion?.endLocation && redMotion?.endLocation) {
        try {
          position = gridPositionDeriver.getGridPositionFromLocations(
            blueMotion.endLocation,
            redMotion.endLocation
          );
        } catch {
          // Silently fail - position will remain null
        }
      }
    }

    return {
      position,
      blueOrientation: (lastStep?.motions?.blue?.endOrientation as Orientation) ?? null,
      redOrientation: (lastStep?.motions?.red?.endOrientation as Orientation) ?? null,
    };
  }

  /**
   * Pre-load the next sequence in the background.
   * Called while current sequence is playing to ensure instant swap.
   */
  async function preloadNextSequence() {
    if (!spinnerOrchestrator || !currentSequence || isPreloading) return;

    isPreloading = true;

    try {
      const endState = extractEndState(currentSequence);
      const nextSeq = await spinnerOrchestrator.getNextSequence(endState);
      if (nextSeq) {
        preloadedSequence = nextSeq;
      } else {
        // Fallback to random
        preloadedSequence = await spinnerOrchestrator.getInitialSequence();
      }
    } catch (err) {
      console.error("[LandingDemo] Failed to preload sequence:", err);
    } finally {
      isPreloading = false;
    }
  }

  /**
   * Chain to the next sequence when current one completes.
   * Uses hot-swap to maintain seamless playback.
   */
  async function chainToNextSequence() {
    if (!spinnerOrchestrator || !playbackController || isChainingNow) return;

    isChainingNow = true;

    try {
      // Use pre-loaded sequence if available, otherwise load now
      let nextSeq = preloadedSequence;
      if (!nextSeq && currentSequence) {
        const endState = extractEndState(currentSequence);
        nextSeq = await spinnerOrchestrator.getNextSequence(endState);
        if (!nextSeq) {
          nextSeq = await spinnerOrchestrator.getInitialSequence();
        }
      }

      if (nextSeq) {
        // Hot-swap: update sequence without resetting or showing loading state
        hotSwapSequence(nextSeq);
      }

      // Clear preloaded sequence after use
      preloadedSequence = null;
    } catch (err) {
      console.error("[LandingDemo] Failed to chain sequence:", err);
    } finally {
      isChainingNow = false;
    }
  }

  /**
   * Hot-swap sequence data without stopping playback.
   * This is the key to seamless transitions - no loading state, no transition animation.
   */
  function hotSwapSequence(sequenceData: SequenceData) {
    if (!playbackController) return;

    // Store the current sequence for display and end state extraction
    currentSequence = sequenceData;

    // Reset beat tracking for chaining detection
    lastStep = -1;

    // Apply current prop type to sequence data
    const sequence = applyPropTypeToSequence(sequenceData, currentPropType);

    // Use updateSequenceData instead of initialize to keep playback running.
    // initialize() sets isPlaying=false which briefly interrupts the animation
    // loop, causing fire/LED effects to freeze at the old prop positions.
    animationState.setShouldLoop(true);
    playbackController.updateSequenceData(sequence);

    // Seek to beat 1 without stopping playback
    playbackController.seekToStep(1);

    // Ensure we're in continuous playback mode
    animationState.setPlaybackMode("continuous");

    // Start playback if not already running
    if (!animationState.isPlaying) {
      playbackController.togglePlayback();
    }
  }

  /**
   * Get a new random sequence (for manual randomize button)
   */
  async function loadRandomSequence() {
    if (!spinnerOrchestrator) return;

    isLoading = true;

    try {
      // Get a random sequence
      const sequence = await spinnerOrchestrator.getInitialSequence();
      if (sequence) {
        // Pick a random prop type
        currentPropType = RANDOM_PROPS[Math.floor(Math.random() * RANDOM_PROPS.length)]!;
        await loadSequence(sequence);
      }
    } catch (err) {
      console.error("[LandingDemo] Failed to load random sequence:", err);
    } finally {
      isLoading = false;
    }
  }

  /**
   * Load and play a specific sequence
   */
  async function loadSequence(sequenceData: SequenceData) {
    if (!playbackController) return;

    transitionKey++;
    animationReady = false;

    try {
      if (animationState.isPlaying) {
        playbackController.togglePlayback();
      }
      animationState.reset();

      // Store the current sequence for display
      currentSequence = sequenceData;

      // Reset beat tracking for chaining detection
      lastStep = -1;

      // Apply current prop type to sequence data
      const sequence = applyPropTypeToSequence(sequenceData, currentPropType);

      animationState.setShouldLoop(true);
      const success = playbackController.initialize(sequence, animationState);

      if (!success) {
        throw new Error("Failed to initialize playback");
      }

      animationReady = true;
      isLoading = false;

      // Wait for AnimatorCanvas to mount and initialize before starting playback
      await tick();

      // Ensure continuous playback mode
      animationState.setPlaybackMode("continuous");
      animationState.setCurrentStep(1);
      playbackController?.togglePlayback();
    } catch (err) {
      console.error("Failed to load sequence:", err);
      animationError = true;
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
    onPropTypeChange?.(newPropType);

    // Hot swap - instant prop change without transition animation:
    // 1. AnimatorCanvas receives new prop type via bluePropType/redPropType props
    //    (AnimationEngine detects the change and hot-swaps textures)
    // 2. Update sequence data in animationState for StepGrid
    if (animationState.sequenceData) {
      const updatedSequence = applyPropTypeToSequence(
        animationState.sequenceData,
        newPropType
      );
      // Directly update the sequence data - playback continues uninterrupted
      animationState.setSequenceData(updatedSequence);
    }
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

          {#if animationState.sequenceData}
            <div class="beat-grid-panel">
              <ChoreoCard
                sequence={animationState.sequenceData}
                {darkMode}
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
