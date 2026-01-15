<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { fly } from "svelte/transition";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
  import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
  import type { IDiscoverLoader } from "$lib/features/discover/sequences/display/services/contracts/IDiscoverLoader";
  import type { IStartPositionDeriver } from "$lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver";
  import type {
    IEndlessSpinnerOrchestrator,
    EndState,
    SpinnerStats,
  } from "$lib/features/landing/services/contracts/IEndlessSpinnerOrchestrator";
  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/implementations/EndlessSpinnerOrchestrator";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";
  import type { IGenerationOrchestrator } from "$lib/features/create/generate/shared/services/contracts/IGenerationOrchestrator";
  import type { ISequenceTransformer } from "$lib/features/create/shared/services/contracts/ISequenceTransformer";
  import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import {
    animationSettings,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import BeatGrid from "$lib/features/create/shared/workspace-panel/sequence-display/components/BeatGrid.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  // New imports for mode toggle and infinite generation
  import type { SpinnerMode, SpinnerMetrics, GeneratedSequenceInfo } from "$lib/features/landing/domain/models/spinner-models";
  import type { IInfiniteSequenceGenerator } from "$lib/features/landing/services/contracts/IInfiniteSequenceGenerator";
  import { InfiniteSequenceGenerator } from "$lib/features/landing/services/implementations/InfiniteSequenceGenerator";
  import { SpinnerMetricsRepository } from "$lib/features/landing/services/implementations/SpinnerMetricsRepository";
  import SpinnerModeToggle from "$lib/features/landing/components/SpinnerModeToggle.svelte";
  import LibraryModeInfo from "$lib/features/landing/components/LibraryModeInfo.svelte";
  import InfiniteModeInfo from "$lib/features/landing/components/InfiniteModeInfo.svelte";
  import SpinnerStatsBar from "$lib/features/landing/components/SpinnerStatsBar.svelte";

  // Local extracted components
  import SpinnerControls from "./components/SpinnerControls.svelte";
  import EndlessSpinnerDebugPanel from "./components/EndlessSpinnerDebugPanel.svelte";

  function applyPropTypeToSequence(
    sequence: SequenceData,
    propType: PropType
  ): SequenceData {
    function applyToBeat(beat: BeatData): BeatData {
      if (!beat.motions) return beat;
      return {
        ...beat,
        motions: {
          blue: beat.motions.blue ? { ...beat.motions.blue, propType } : undefined,
          red: beat.motions.red ? { ...beat.motions.red, propType } : undefined,
        },
      };
    }

    function applyToStartPosition(startPos: StartPositionData): StartPositionData {
      if (!startPos.motions) return startPos;
      return {
        ...startPos,
        motions: {
          blue: startPos.motions.blue ? { ...startPos.motions.blue, propType } : undefined,
          red: startPos.motions.red ? { ...startPos.motions.red, propType } : undefined,
        },
      };
    }

    return {
      ...sequence,
      startPosition: sequence.startPosition
        ? applyToStartPosition(sequence.startPosition)
        : undefined,
      beats: sequence.beats?.map(applyToBeat) ?? [],
    };
  }

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
  let isChainingEnabled = $state(true);

  // UI state
  let showDebugPanel = $state(false);
  let showBeatGrid = $state(true);

  // Sequence state
  let currentSequence = $state<SequenceData | null>(null);
  let sequenceHistory = $state<string[]>([]);
  let lastBeat = $state(-1);
  let preloadedSequence = $state<SequenceData | null>(null);
  let isPreloading = $state(false);
  let isChainingNow = $state(false);
  let transitionCount = $state(0);

  // Stats
  let stats = $state<SpinnerStats>({
    sequencesPlayed: 0,
    uniqueSequencesUsed: 0,
    directMatches: 0,
    rotatedMatches: 0,
    bridgesGenerated: 0,
  });

  // Mode state (Library vs Infinite)
  let spinnerMode = $state<SpinnerMode>("library");
  let infiniteGenerator = $state<IInfiniteSequenceGenerator | null>(null);
  let metricsRepository: SpinnerMetricsRepository | null = null;
  let globalMetrics = $state<SpinnerMetrics | null>(null);
  let currentGeneratedInfo = $state<GeneratedSequenceInfo | null>(null);
  let metricsUnsubscribe: (() => void) | null = null;

  const visibilityManager = getAnimationVisibilityManager();

  // Derived values
  let derivedStartPosition = $derived.by(() => {
    if (!animationState.sequenceData || !startPositionDeriver) return null;
    return startPositionDeriver.getOrDeriveStartPosition(
      animationState.sequenceData
    );
  });

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

  // Pre-load next sequence (only in library mode)
  $effect(() => {
    // Skip preloading in infinite mode - we generate on-demand
    if (spinnerMode === "infinite") return;

    const currentBeat = Math.floor(animationState.currentBeat);
    const totalBeats = animationState.totalBeats;

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

  // Watch for sequence completion
  $effect(() => {
    const currentBeat = Math.floor(animationState.currentBeat);
    const totalBeats = animationState.totalBeats;

    if (
      isChainingEnabled &&
      servicesReady &&
      !isChainingNow &&
      animationReady &&
      lastBeat >= totalBeats - 1 &&
      currentBeat <= 1 &&
      totalBeats > 0
    ) {
      chainToNextSequence();
    }

    lastBeat = currentBeat;
  });

  onMount(async () => {
    try {
      animationSettings.setTrackingMode(TrackingMode.BOTH_ENDS);
      visibilityManager.setDarkMode(true);

      discoverLoader = container.items.discoverLoader as IDiscoverLoader;
      playbackController = container.items
        .animationPlaybackController as IAnimationPlaybackController;
      startPositionDeriver = container.items
        .startPositionDeriver as IStartPositionDeriver;
      gridPositionDeriver = container.items
        .gridPositionDeriver as IGridPositionDeriver;

      const generationOrchestrator = container.items
        .generationOrchestrator as IGenerationOrchestrator;
      const sequenceTransformer = container.items
        .sequenceTransformer as ISequenceTransformer;
      const orientationCalculator = container.items
        .orientationCalculator as IOrientationCalculator;

      spinnerOrchestrator = new EndlessSpinnerOrchestrator(
        discoverLoader,
        generationOrchestrator,
        sequenceTransformer,
        startPositionDeriver,
        orientationCalculator,
        gridPositionDeriver
      );

      // Initialize infinite mode services
      metricsRepository = new SpinnerMetricsRepository();
      infiniteGenerator = new InfiniteSequenceGenerator(
        generationOrchestrator,
        metricsRepository
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
      console.error("Initialization failed:", err);
      animationError = true;
    }
  });

  onDestroy(() => {
    playbackController?.dispose();
    animationState.dispose();
    metricsUnsubscribe?.();
  });

  function extractEndState(sequence: SequenceData): EndState {
    const finalBeat = sequence.beats?.[sequence.beats.length - 1];
    let position = finalBeat?.endPosition ?? null;

    if (!position && gridPositionDeriver && finalBeat?.motions) {
      const blueMotion = finalBeat.motions[MotionColor.BLUE];
      const redMotion = finalBeat.motions[MotionColor.RED];

      if (blueMotion?.endLocation && redMotion?.endLocation) {
        try {
          position = gridPositionDeriver.getGridPositionFromLocations(
            blueMotion.endLocation,
            redMotion.endLocation
          );
        } catch {
          // Silently fail
        }
      }
    }

    return {
      position,
      blueOrientation: (finalBeat?.motions?.blue?.endOrientation ?? null) as Orientation | null,
      redOrientation: (finalBeat?.motions?.red?.endOrientation ?? null) as Orientation | null,
    };
  }

  async function preloadNextSequence() {
    if (!spinnerOrchestrator || !currentSequence || isPreloading) return;

    isPreloading = true;

    try {
      const endState = extractEndState(currentSequence);
      const nextSeq = await spinnerOrchestrator.getNextSequence(endState);
      preloadedSequence = nextSeq ?? (await spinnerOrchestrator.getInitialSequence());
    } catch (err) {
      console.error("Pre-load failed:", err);
    } finally {
      isPreloading = false;
    }
  }

  async function chainToNextSequence() {
    if (!playbackController || isChainingNow) return;

    isChainingNow = true;
    transitionCount++;

    try {
      if (spinnerMode === "infinite" && infiniteGenerator) {
        // Infinite mode: generate novel sequences
        const endState = currentSequence ? extractEndState(currentSequence) : null;
        const generated = endState
          ? await infiniteGenerator.generateFromEndState(endState)
          : await infiniteGenerator.generateInitial();

        if (generated) {
          currentGeneratedInfo = generated;
          hotSwapSequence(generated.sequence);
          sequenceHistory = [generated.sequence.word || "Generated", ...sequenceHistory.slice(0, 9)];
        }
      } else if (spinnerOrchestrator) {
        // Library mode: use curated sequences
        let nextSeq = preloadedSequence;
        if (!nextSeq && currentSequence) {
          const endState = extractEndState(currentSequence);
          nextSeq = await spinnerOrchestrator.getNextSequence(endState);
          if (!nextSeq) {
            nextSeq = await spinnerOrchestrator.getInitialSequence();
          }
        }

        if (nextSeq) {
          currentGeneratedInfo = null; // Clear any generated info
          hotSwapSequence(nextSeq);
          sequenceHistory = [nextSeq.word, ...sequenceHistory.slice(0, 9)];
          const orchestratorStats = spinnerOrchestrator.getStats();
          stats = { ...orchestratorStats };
        }
      }

      preloadedSequence = null;
    } catch (err) {
      console.error("Chain failed:", err);
    } finally {
      isChainingNow = false;
    }
  }

  function handleModeChange(newMode: SpinnerMode) {
    spinnerMode = newMode;

    // Subscribe to metrics updates when switching to infinite mode
    if (newMode === "infinite" && metricsRepository && !metricsUnsubscribe) {
      metricsUnsubscribe = metricsRepository.subscribe((metrics) => {
        globalMetrics = metrics;
      });
      // Also fetch initial metrics
      metricsRepository.getMetrics().then((metrics) => {
        globalMetrics = metrics;
      });
      // Clear any preloaded library sequence so infinite mode generates fresh
      preloadedSequence = null;
    }

    // Reset generated info when switching to library mode
    if (newMode === "library") {
      currentGeneratedInfo = null;
    }
  }

  function hotSwapSequence(sequenceData: SequenceData) {
    if (!playbackController) return;

    currentSequence = sequenceData;
    lastBeat = -1;

    const sequence = applyPropTypeToSequence(sequenceData, PropType.STAFF);

    animationState.setShouldLoop(true);
    const success = playbackController.initialize(sequence, animationState);

    if (!success) return;

    animationState.setPlaybackMode("continuous");
    animationState.setCurrentBeat(1);

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
      lastBeat = -1;
      sequenceHistory = [sequenceData.word, ...sequenceHistory.slice(0, 9)];

      const sequence = applyPropTypeToSequence(sequenceData, PropType.STAFF);

      animationState.setShouldLoop(true);
      const success = playbackController.initialize(sequence, animationState);

      if (!success) {
        throw new Error("Failed to initialize playback");
      }

      animationReady = true;

      await tick();

      animationState.setPlaybackMode("continuous");
      animationState.setCurrentBeat(1);
      playbackController?.togglePlayback();
    } catch (err) {
      console.error("Load failed:", err);
      animationError = true;
    }
  }

  function handleSkip() {
    if (!spinnerOrchestrator || !currentSequence) return;
    chainToNextSequence();
  }

  function handleTogglePause() {
    if (!playbackController) return;
    playbackController.togglePlayback();
  }

  async function handleRetry() {
    animationError = false;
    animationReady = false;

    try {
      if (spinnerOrchestrator) {
        const initialSequence = await spinnerOrchestrator.getInitialSequence();
        if (initialSequence) {
          await loadSequence(initialSequence);
          return;
        }
      }
      animationError = true;
    } catch {
      animationError = true;
    }
  }
</script>

<svelte:head>
  <title>Endless Spinner | The Kinetic Alphabet</title>
  <meta name="description" content="Watch an endless stream of flow arts sequences, seamlessly chained together. Experience the beauty of TKA notation in motion." />
</svelte:head>

<div class="page">
  <!-- Ambient background -->
  <div class="ambient-bg"></div>

  <!-- Main content -->
  <div class="content">
    <!-- Header -->
    <header class="header">
      <h1 class="title">Infinite LOOPs</h1>
      <p class="subtitle">TKA choreography, infinitely chained</p>

      <!-- Mode toggle -->
      <div class="mode-toggle-container">
        <SpinnerModeToggle mode={spinnerMode} onModeChange={handleModeChange} />
      </div>
    </header>

    <!-- Screen reader announcements -->
    <div class="sr-only" aria-live="polite" aria-atomic="true">
      {#if currentSequence}
        Now playing: {currentSequence.word}
      {/if}
    </div>

    <!-- Animation showcase -->
    <main class="showcase">
      <!-- Mode-specific info display -->
      <div class="mode-info">
        {#if spinnerMode === "library"}
          <LibraryModeInfo sequence={currentSequence} />
        {:else}
          <InfiniteModeInfo sequenceInfo={currentGeneratedInfo} />
        {/if}
      </div>

      <!-- Animation area -->
      <div class="animation-area" class:with-grid={showBeatGrid}>
        <div class="canvas-container">
          {#if animationReady}
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
              bluePropType={PropType.STAFF}
              redPropType={PropType.STAFF}
            />
          {:else if animationError}
            <div class="state-message error" role="alert">
              <span class="icon" aria-hidden="true">!</span>
              <span>Unable to load animation</span>
              <button class="retry-btn" onclick={handleRetry}>
                Try Again
              </button>
            </div>
          {:else}
            <div class="state-message loading">
              <div class="loading-spinner"></div>
              <span>Loading sequences...</span>
            </div>
          {/if}
        </div>

        {#if showBeatGrid && animationState.sequenceData}
          <div class="beat-grid-container" in:fly={{ x: 50, duration: 300 }}>
            <BeatGrid
              beats={animationState.sequenceData.beats}
              startPosition={derivedStartPosition}
              selectedBeatNumber={currentBeatNumber}
            />
          </div>
        {/if}
      </div>

      <!-- Controls -->
      <SpinnerControls
        isPlaying={animationState.isPlaying}
        {animationReady}
        {showBeatGrid}
        onToggleGrid={() => (showBeatGrid = !showBeatGrid)}
        onTogglePause={handleTogglePause}
        onSkip={handleSkip}
      />

      <!-- Stats bar -->
      <SpinnerStatsBar
        mode={spinnerMode}
        libraryStats={stats}
        {transitionCount}
        {globalMetrics}
        sessionGeneratedCount={infiniteGenerator?.getSessionCount() ?? 0}
      />
    </main>

    <!-- Debug toggle -->
    <button
      class="debug-toggle"
      onclick={() => (showDebugPanel = !showDebugPanel)}
    >
      {showDebugPanel ? "Hide Debug" : "Debug"}
    </button>

    <!-- Debug panel -->
    {#if showDebugPanel}
      <EndlessSpinnerDebugPanel
        {sequenceHistory}
        {stats}
        {gridMode}
        bind:isChainingEnabled
      />
    {/if}
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    background: #030308;
    color: #fff;
    font-family: system-ui, -apple-system, sans-serif;
    position: relative;
    overflow: hidden;
  }

  .ambient-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99, 102, 241, 0.15), transparent),
      radial-gradient(ellipse 60% 40% at 80% 100%, rgba(80, 200, 120, 0.1), transparent),
      radial-gradient(ellipse 50% 30% at 20% 80%, rgba(236, 72, 153, 0.08), transparent);
    pointer-events: none;
  }

  .content {
    position: relative;
    max-width: 1400px;
    margin: 0 auto;
    padding: 40px 24px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* Header */
  .header {
    text-align: center;
    margin-bottom: 32px;
  }

  .title {
    margin: 0;
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.7) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    margin: 8px 0 0;
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 400;
  }

  .mode-toggle-container {
    margin-top: 20px;
  }

  /* Showcase */
  .showcase {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }

  .mode-info {
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Animation area */
  .animation-area {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 24px;
    width: 100%;
  }

  .canvas-container {
    width: clamp(320px, 50vw, 520px);
    aspect-ratio: 1;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.05),
      0 20px 60px rgba(0, 0, 0, 0.5),
      0 0 100px rgba(99, 102, 241, 0.1);
  }

  .beat-grid-container {
    width: clamp(280px, 40vw, 450px);
    height: clamp(320px, 50vw, 520px);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    overflow: hidden;
  }

  .state-message {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: rgba(255, 255, 255, 0.5);
  }

  .state-message.error {
    color: #f87171;
  }

  .state-message .icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 700;
    background: rgba(248, 113, 113, 0.2);
    border-radius: 50%;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Retry button */
  .retry-btn {
    margin-top: 8px;
    padding: 10px 20px;
    background: rgba(99, 102, 241, 0.2);
    border: 1px solid rgba(99, 102, 241, 0.4);
    border-radius: 8px;
    color: #a5b4fc;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .retry-btn:hover {
    background: rgba(99, 102, 241, 0.3);
    border-color: rgba(99, 102, 241, 0.6);
    color: #c7d2fe;
  }

  .retry-btn:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
  }

  /* Screen reader only */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Debug toggle */
  .debug-toggle {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    min-height: 44px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .debug-toggle:hover {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.8);
  }

  .debug-toggle:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
  }

  /* Responsive */
  @media (max-width: 900px) {
    .animation-area {
      flex-direction: column;
      align-items: center;
    }

    .animation-area.with-grid {
      gap: 16px;
    }

    .beat-grid-container {
      width: 100%;
      max-width: 400px;
      height: 200px;
    }
  }

  @media (max-width: 600px) {
    .content {
      padding: 24px 16px;
    }

    .header {
      margin-bottom: 20px;
    }

    .title {
      font-size: 1.75rem;
    }

    .canvas-container {
      width: min(90vw, 360px);
    }

    .beat-grid-container {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
    }
  }
</style>
