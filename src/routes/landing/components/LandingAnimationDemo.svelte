<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { IDiscoverLoader } from "$lib/features/discover/sequences/display/services/contracts/IDiscoverLoader";
  import type { IStartPositionDeriver } from "$lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver";
  import type { IEndlessSpinnerOrchestrator, EndState } from "$lib/features/landing/services/contracts/IEndlessSpinnerOrchestrator";
  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/implementations/EndlessSpinnerOrchestrator";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import {
    animationSettings,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import BeatGrid from "$lib/features/create/shared/workspace-panel/sequence-display/components/BeatGrid.svelte";
  import DemoControlBar from "./DemoControlBar.svelte";
  import { RANDOM_PROPS } from "../landing-content";
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
    const applyToMotions = (data: BeatData | StartPositionData) => {
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
      beats:
        sequence.beats?.map((beat) => applyToMotions(beat) as BeatData) ?? [],
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
  let playbackController: IAnimationPlaybackController | null = null;
  let discoverLoader: IDiscoverLoader | null = null;
  let startPositionDeriver: IStartPositionDeriver | null = null;
  let gridPositionDeriver: IGridPositionDeriver | null = null;
  let spinnerOrchestrator: IEndlessSpinnerOrchestrator | null = null;
  let servicesReady = $state(false);
  let animationReady = $state(false);
  let animationError = $state(false);
  let isLoading = $state(false);
  let isChainingEnabled = $state(true); // Enable endless chaining

  // Dynamic sequence loading - circular LOOPs from the database
  let currentSequence = $state<SequenceData | null>(null);
  let currentPropType = $state<PropType>(RANDOM_PROPS[0]!);

  // Track beat for sequence completion detection
  let lastBeat = $state(-1);

  // Pre-loaded next sequence for seamless transition
  let preloadedSequence = $state<SequenceData | null>(null);
  let isPreloading = $state(false);

  // Flag to indicate we're in the middle of a seamless chain
  let isChainingNow = $state(false);

  // Dark mode - default ON for landing page visual impact
  let darkMode = $state(true);
  const visibilityManager = getAnimationVisibilityManager();

  // Derived start position - uses service to derive from first beat if not stored
  let derivedStartPosition = $derived.by(() => {
    if (!animationState.sequenceData || !startPositionDeriver) return null;
    return startPositionDeriver.getOrDeriveStartPosition(
      animationState.sequenceData
    );
  });

  // Current beat data for AnimatorCanvas
  let currentLetter = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const currentBeat = animationState.currentBeat;

    if (currentBeat < 1) {
      return derivedStartPosition?.letter || null;
    }

    if (animationState.sequenceData.beats?.length > 0) {
      const beatIndex = Math.floor(currentBeat) - 1;
      const clampedIndex = Math.max(
        0,
        Math.min(beatIndex, animationState.sequenceData.beats.length - 1)
      );
      return animationState.sequenceData.beats[clampedIndex]?.letter || null;
    }

    return null;
  });

  let currentBeatData = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const currentBeat = animationState.currentBeat;

    if (currentBeat < 1) {
      return derivedStartPosition || null;
    }

    if (animationState.sequenceData.beats?.length > 0) {
      const beatIndex = Math.floor(currentBeat) - 1;
      const clampedIndex = Math.max(
        0,
        Math.min(beatIndex, animationState.sequenceData.beats.length - 1)
      );
      return animationState.sequenceData.beats[clampedIndex] || null;
    }

    return null;
  });

  let gridMode = $derived(animationState.sequenceData?.gridMode ?? null);
  let currentBeatNumber = $derived(Math.floor(animationState.currentBeat));

  // Pre-load next sequence when we're partway through current one
  $effect(() => {
    const currentBeat = Math.floor(animationState.currentBeat);
    const totalBeats = animationState.totalBeats;

    // Start pre-loading around beat 2 (gives time to load before sequence ends)
    const shouldPreload =
      isChainingEnabled &&
      servicesReady &&
      animationReady &&
      !isPreloading &&
      !preloadedSequence &&
      currentSequence &&
      totalBeats > 2 &&
      currentBeat >= 2 &&
      currentBeat < totalBeats - 1;

    if (shouldPreload) {
      preloadNextSequence();
    }
  });

  // Watch for sequence completion to chain to next sequence
  $effect(() => {
    const currentBeat = Math.floor(animationState.currentBeat);
    const totalBeats = animationState.totalBeats;

    // Detect when sequence loops back to beginning (completion)
    if (
      isChainingEnabled &&
      servicesReady &&
      !isChainingNow &&
      animationReady &&
      lastBeat >= totalBeats - 1 &&
      currentBeat <= 1 &&
      totalBeats > 0
    ) {
      // Sequence completed - chain to next
      chainToNextSequence();
    }

    lastBeat = currentBeat;
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

      // Get services from DI container
      discoverLoader = container.items.discoverLoader as IDiscoverLoader;
      playbackController = container.items.animationPlaybackController as IAnimationPlaybackController;
      startPositionDeriver = container.items.startPositionDeriver as IStartPositionDeriver;
      gridPositionDeriver = container.items.gridPositionDeriver as IGridPositionDeriver;

      // Create and initialize the spinner orchestrator for endless chaining
      const generationOrchestrator = container.items.generationOrchestrator;
      const sequenceTransformer = container.items.sequenceTransformer;
      const orientationCalculator = container.items.orientationCalculator;

      spinnerOrchestrator = new EndlessSpinnerOrchestrator(
        discoverLoader as any,
        generationOrchestrator as any,
        sequenceTransformer as any,
        startPositionDeriver,
        orientationCalculator as any,
        gridPositionDeriver as any
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
    const lastBeat = sequence.beats?.[sequence.beats.length - 1];

    // Get the end position - try stored value first, then derive from motion end locations
    let position = lastBeat?.endPosition ?? null;

    if (!position && gridPositionDeriver && lastBeat?.motions) {
      const blueMotion = lastBeat.motions[MotionColor.BLUE];
      const redMotion = lastBeat.motions[MotionColor.RED];

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
      blueOrientation: (lastBeat?.motions?.blue?.endOrientation as Orientation) ?? null,
      redOrientation: (lastBeat?.motions?.red?.endOrientation as Orientation) ?? null,
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
    lastBeat = -1;

    // Apply current prop type to sequence data
    const sequence = applyPropTypeToSequence(sequenceData, currentPropType);

    // Reinitialize the playback controller with new sequence
    // This preserves the playing state and updates the animation data
    animationState.setShouldLoop(true);
    const success = playbackController.initialize(sequence, animationState);

    if (!success) {
      console.error("[LandingDemo] Hot-swap failed");
      return;
    }

    // Ensure we're in continuous playback mode and start from beat 1
    animationState.setPlaybackMode("continuous");
    animationState.setCurrentBeat(1);

    // Make sure playback is running
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
      lastBeat = -1;

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
      animationState.setCurrentBeat(1);
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

    // Hot swap - instant prop change without transition animation:
    // 1. AnimatorCanvas receives new prop type via bluePropType/redPropType props
    //    (AnimationEngine detects the change and hot-swaps textures)
    // 2. Update sequence data in animationState for BeatGrid
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
                  beatData={currentBeatData}
                  sequenceData={animationState.sequenceData}
                  isPlaying={animationState.isPlaying}
                  trailSettings={animationSettings.trail}
                  bluePropType={currentPropType}
                  redPropType={currentPropType}
                />
              </div>
            {:else if animationError}
              <div class="animation-fallback">
                <div class="fallback-icon">🌀</div>
                <span>Animation Preview</span>
              </div>
            {:else}
              <div class="animation-loading">
                <div class="spinner"></div>
                <span>{isLoading ? "Loading..." : "Initializing..."}</span>
              </div>
            {/if}
          </div>

          {#if animationState.sequenceData}
            <div class="beat-grid-panel">
              <BeatGrid
                beats={animationState.sequenceData.beats}
                startPosition={derivedStartPosition}
                selectedBeatNumber={currentBeatNumber}
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
      onToggleDarkMode={handleToggleDarkMode}
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
    position: relative;
    min-height: clamp(520px, 65cqw, 720px);
  }

  .demo-transition-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
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
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  }

  .beat-grid-panel {
    flex: 0 0 auto;
    width: clamp(420px, 60cqw, 700px);
    height: clamp(420px, 57cqw, 600px);
    background: transparent;
    border: 2px solid var(--border-strong, rgba(255, 255, 255, 0.2));
    border-radius: 16px;
    overflow: visible;
    padding: 0;
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

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border, rgba(255, 255, 255, 0.1));
    border-top-color: var(--primary, #6366f1);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .controls-wrapper {
    position: absolute;
    bottom: 0;
    z-index: 10;
  }

  /* Tablet - show both but stacked */
  @media (max-width: 900px) {
    .demo-content-row {
      flex-direction: column;
      align-items: center;
    }

    .beat-grid-panel {
      width: 100%;
      max-width: min(500px, 90vw);
      height: clamp(200px, 40vw, 300px);
    }
  }

  /* Mobile - hide beat grid, focus on animation */
  @media (max-width: 600px) {
    .beat-grid-panel {
      display: none;
    }

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

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
