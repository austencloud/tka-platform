<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { IDiscoverLoader } from "$lib/features/discover/gallery/display/services/contracts/IDiscoverLoader";
  import type { IStartPositionDeriver } from "$lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { resolve, loadFeatureModule } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import {
    animationSettings,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import BeatGrid from "$lib/features/create/shared/workspace-panel/sequence-display/components/BeatGrid.svelte";
  import DemoControlBar from "./DemoControlBar.svelte";
  import { SHOWCASE_SEQUENCES, RANDOM_PROPS } from "../landing-content";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

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
  let servicesReady = $state(false);
  let animationReady = $state(false);
  let animationError = $state(false);
  let isLoading = $state(false);

  // Current selection state
  let currentSequenceIndex = $state(0);
  let currentPropType = $state<PropType>(RANDOM_PROPS[0]!);

  // Dark mode - default ON for landing page visual impact
  let darkMode = $state(true);
  const visibilityManager = getAnimationVisibilityManager();

  // Derived values
  let currentWord = $derived(SHOWCASE_SEQUENCES[currentSequenceIndex]);

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

      // Load both animate and discover modules for sequence loading
      await loadFeatureModule("animate");
      await loadFeatureModule("discover");
      discoverLoader = resolve<IDiscoverLoader>(TYPES.IDiscoverLoader);
      playbackController = resolve<IAnimationPlaybackController>(
        TYPES.IAnimationPlaybackController
      );
      startPositionDeriver = resolve<IStartPositionDeriver>(
        TYPES.IStartPositionDeriver
      );

      // CRITICAL: Populate sequence cache with bundled metadata from sequence-index.json
      // This ensures loadFullSequenceData() uses the pre-bundled data instead of
      // falling back to individual .meta.json fetches (which may fail or be missing beat 0)
      await discoverLoader.loadSequenceMetadata();

      servicesReady = true;

      // Prop type is passed directly to AnimatorCanvas via override props
      // and applied to sequence data for BeatGrid - no settings modification needed
      await loadSequence(SHOWCASE_SEQUENCES[0]!);
    } catch (err) {
      console.error("Failed to load hero animation:", err);
      animationError = true;
    }
  }

  onDestroy(() => {
    playbackController?.dispose();
    animationState.dispose();
  });

  async function loadSequence(word: string) {
    if (!discoverLoader || !playbackController) return;

    transitionKey++;
    isLoading = true;
    animationReady = false;

    try {
      if (animationState.isPlaying) {
        playbackController.togglePlayback();
      }
      animationState.reset();

      // Load from gallery's sequence-index.json (not local persistence)
      const rawSequence = await discoverLoader.loadFullSequenceData(word);
      if (!rawSequence) {
        throw new Error(`Failed to load sequence: ${word}`);
      }

      // Apply current prop type to sequence data for BeatGrid
      // AnimatorCanvas uses prop type overrides passed as props
      const sequence = applyPropTypeToSequence(rawSequence, currentPropType);

      animationState.setShouldLoop(true);
      const success = playbackController.initialize(sequence, animationState);

      if (!success) {
        throw new Error("Failed to initialize playback");
      }

      animationReady = true;
      isLoading = false;

      animationState.setCurrentBeat(1);
      playbackController?.togglePlayback();
    } catch (err) {
      console.error("Failed to load sequence:", err);
      animationError = true;
      isLoading = false;
    }
  }

  function handleRandomize() {
    let newSequenceIndex = currentSequenceIndex;
    while (
      newSequenceIndex === currentSequenceIndex &&
      SHOWCASE_SEQUENCES.length > 1
    ) {
      newSequenceIndex = Math.floor(Math.random() * SHOWCASE_SEQUENCES.length);
    }
    currentSequenceIndex = newSequenceIndex;

    // Pick a random prop type - loadSequence will apply it to sequence data
    const newPropType =
      RANDOM_PROPS[Math.floor(Math.random() * RANDOM_PROPS.length)]!;
    currentPropType = newPropType;

    loadSequence(SHOWCASE_SEQUENCES[newSequenceIndex]!);
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
        <div class="word-label-row">
          <span class="word-text">{currentWord || "A"}</span>
        </div>

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
    min-height: clamp(380px, 50cqw, 520px);
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

  .word-label-row {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  .word-label-row .word-text {
    font-family: Georgia, serif;
    font-size: clamp(1.5rem, 5cqw, 2.5rem);
    font-weight: 600;
    color: var(--text, #ffffff);
    letter-spacing: 0.02em;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
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
    width: clamp(280px, 38cqw, 400px);
    height: clamp(280px, 38cqw, 400px);
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .beat-grid-panel {
    flex: 0 0 auto;
    width: clamp(280px, 50cqw, 530px);
    height: clamp(280px, 38cqw, 400px);
    background: transparent;
    border: 2px solid var(--border-strong, rgba(255, 255, 255, 0.2));
    border-radius: 16px;
    overflow: visible;
    padding: 0;
  }

  .animation-loading,
  .animation-fallback {
    width: 280px;
    height: 280px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: var(--bg-card, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    color: var(--text-muted, rgba(255, 255, 255, 0.6));
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

    .word-label-row .word-text {
      font-size: clamp(1.25rem, 6vw, 2rem);
    }

    .canvas-wrapper {
      width: min(320px, 85vw);
      height: min(320px, 85vw);
    }

    .animation-loading,
    .animation-fallback {
      width: min(280px, 80vw);
      height: min(280px, 80vw);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
