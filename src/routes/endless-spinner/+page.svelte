<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { fly } from "svelte/transition";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/implementations/AnimationPlaybackController";
  import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
  import type { EndState, SpinnerStats } from '$lib/shared/landing/domain/types';
  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/EndlessSpinnerOrchestrator";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import { getBrowseLoader } from "$lib/shared/browse/getBrowseLoader";
import { getAnimationPlaybackController } from "$lib/shared/animation-engine/getAnimationPlaybackController";
import { getGenerationOrchestrator } from "$lib/features/create/generate/shared/getGenerationOrchestrator";
import { getSequenceTransformer } from "$lib/shared/create/getSequenceTransformer";


  import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import {
    animationSettings,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import StepGrid from "$lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  // New imports for mode toggle and infinite generation
  import type { SpinnerMode, SpinnerMetrics, GeneratedSequenceInfo } from "$lib/features/landing/domain/models/spinner-models";
  import { InfiniteSequenceGenerator } from "$lib/features/landing/services/InfiniteSequenceGenerator";
  import { SpinnerMetricsRepository } from "$lib/features/landing/services/SpinnerMetricsRepository";
  import { orientationCycleExtender } from "$lib/features/create/generate/circular/services/implementations/OrientationCycleExtender";
  import SpinnerModeToggle from "$lib/features/landing/components/SpinnerModeToggle.svelte";
  import LibraryModeInfo from "$lib/features/landing/components/LibraryModeInfo.svelte";
  import InfiniteModeInfo from "$lib/features/landing/components/InfiniteModeInfo.svelte";
  import LiveModeInfo from "$lib/features/landing/components/LiveModeInfo.svelte";
  import SpinnerStatsBar from "$lib/features/landing/components/SpinnerStatsBar.svelte";

  // Broadcast imports
  import type { BroadcastStateClient } from "$lib/shared/landing/domain/broadcast-models";
  import { BroadcastRepository } from "$lib/features/landing/services/BroadcastRepository";
  import * as broadcastSequenceConverter from "$lib/features/landing/services/broadcast-sequence-converter";
  import * as propTypeApplier from "$lib/shared/landing/services/prop-type-applier";

  // Local extracted components
  import SpinnerControls from "./components/SpinnerControls.svelte";
  import EndlessSpinnerDebugPanel from "./components/EndlessSpinnerDebugPanel.svelte";
  import SequenceHistoryPanel from "./components/SequenceHistoryPanel.svelte";
  import type { SequenceHistoryEntry } from "./components/SequenceHistoryPanel.svelte";
  import * as sequenceDataSerializer from "$lib/features/landing/services/sequence-data-serializer";

  // Animation state
  const animationState = createAnimationPanelState();
  let playbackController: AnimationPlaybackController | null = null;
  let browseLoader: PublicSequencesLoader | null = null;
  let spinnerOrchestrator: EndlessSpinnerOrchestrator | null = null;
  let servicesReady = $state(false);
  let animationReady = $state(false);
  let animationError = $state(false);
  let isChainingEnabled = $state(true);

  // UI state
  let showDebugPanel = $state(false);
  let showStepGrid = $state(true);
  let showHistory = $state(false);

  // Sequence state
  let currentSequence = $state<SequenceData | null>(null);
  let sequenceHistory = $state<SequenceHistoryEntry[]>([]);
  let lastStep = $state(-1);
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

  // Mode state (Library vs Infinite vs Live)
  let spinnerMode = $state<SpinnerMode>("library");
  let infiniteGenerator = $state<InfiniteSequenceGenerator | null>(null);
  let metricsRepository: SpinnerMetricsRepository | null = null;
  let globalMetrics = $state<SpinnerMetrics | null>(null);
  let currentGeneratedInfo = $state<GeneratedSequenceInfo | null>(null);
  let metricsUnsubscribe: (() => void) | null = null;

  // Broadcast (Live) mode state
  let broadcastRepository: BroadcastRepository | null = null;
  let broadcastState = $state<BroadcastStateClient | null>(null);
  let serverTimeOffset = $state(0);
  let broadcastUnsubscribe: (() => void) | null = null;
  let stepSyncInterval: ReturnType<typeof setInterval> | null = null;

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

  // Pre-load next sequence (only in library mode)
  $effect(() => {
    // Skip preloading in infinite or live mode
    if (spinnerMode === "infinite" || spinnerMode === "live") return;

    const currentStep = Math.floor(animationState.currentStep);
    const totalSteps = animationState.totalSteps;

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

  // Watch for sequence completion (skip in live mode - broadcast controls transitions)
  $effect(() => {
    // In live mode, the broadcast subscription handles sequence transitions
    if (spinnerMode === "live") return;

    const currentStep = Math.floor(animationState.currentStep);
    const totalSteps = animationState.totalSteps;

    if (
      isChainingEnabled &&
      servicesReady &&
      !isChainingNow &&
      animationReady &&
      lastStep >= totalSteps - 1 &&
      currentStep <= 1 &&
      totalSteps > 0
    ) {
      chainToNextSequence();
    }

    lastStep = currentStep;
  });

  onMount(async () => {
    try {
      animationSettings.setTrackingMode(TrackingMode.BOTH_ENDS);
      visibilityManager.setDarkMode(true);

      browseLoader = getBrowseLoader();
      playbackController = getAnimationPlaybackController();

      const generationOrchestrator = getGenerationOrchestrator();
      const sequenceTransformer = getSequenceTransformer();

      spinnerOrchestrator = new EndlessSpinnerOrchestrator(
        browseLoader,
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
        metricsRepository,
        orientationCycleExtender
      );

      // Initialize broadcast repository for live mode
      broadcastRepository = new BroadcastRepository();

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
    broadcastUnsubscribe?.();
    if (stepSyncInterval) {
      clearInterval(stepSyncInterval);
    }
  });

  function extractEndState(sequence: SequenceData): EndState {
    const finalStep = sequence.steps?.[sequence.steps.length - 1];
    let position = finalStep?.endPosition ?? null;

    if (!position && gridPositionDeriver && finalStep?.motions) {
      const blueMotion = finalStep.motions[MotionColor.BLUE];
      const redMotion = finalStep.motions[MotionColor.RED];

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
      blueOrientation: (finalStep?.motions?.blue?.endOrientation ?? null) as Orientation | null,
      redOrientation: (finalStep?.motions?.red?.endOrientation ?? null) as Orientation | null,
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
          sequenceHistory = [
            { sequence: generated.sequence, settings: generated.settings, timestamp: new Date() },
            ...sequenceHistory.slice(0, 19),
          ];
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
          sequenceHistory = [
            { sequence: nextSeq, settings: null, timestamp: new Date() },
            ...sequenceHistory.slice(0, 19),
          ];
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

  async function handleModeChange(newMode: SpinnerMode) {
    const previousMode = spinnerMode;
    spinnerMode = newMode;

    // Clean up previous mode subscriptions
    if (previousMode === "live") {
      broadcastUnsubscribe?.();
      broadcastUnsubscribe = null;
      broadcastState = null;
      if (stepSyncInterval) {
        clearInterval(stepSyncInterval);
        stepSyncInterval = null;
      }
    }

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

    // Subscribe to broadcast when switching to live mode
    if (newMode === "live" && broadcastRepository) {
      // Calculate server time offset first
      serverTimeOffset = await broadcastRepository.calculateServerTimeOffset();

      // Subscribe to broadcast state
      broadcastUnsubscribe = broadcastRepository.subscribeToBroadcast((state) => {
        if (state) {
          const previousSequenceNumber = broadcastState?.sequenceNumber;
          broadcastState = state;

          // If sequence changed, load the new one
          if (state.sequenceNumber !== previousSequenceNumber) {
            const sequenceData = broadcastSequenceConverter.convertSequence(state.currentSequence);
            loadBroadcastSequence(sequenceData, state);
          }
        } else {
          broadcastState = null;
        }
      });

      // Start beat synchronization interval
      startStepSync();
    }
  }

  /**
   * Start beat synchronization for live mode.
   * Adjusts current beat based on server time.
   */
  function startStepSync() {
    if (stepSyncInterval) {
      clearInterval(stepSyncInterval);
    }

    stepSyncInterval = setInterval(() => {
      if (spinnerMode !== "live" || !broadcastState || !broadcastRepository) {
        return;
      }

      const targetStep = broadcastRepository.getCurrentStepPosition(
        broadcastState.startedAtMs,
        broadcastState.durationMs,
        broadcastState.currentSequence.totalSteps,
        broadcastState.beatsPerMinute
      );

      // If drift is more than 0.5 steps, resync
      const currentStep = animationState.currentStep;
      if (Math.abs(currentStep - targetStep) > 0.5) {
        animationState.setCurrentStep(targetStep);
      }
    }, 100); // Check every 100ms
  }

  /**
   * Load a broadcast sequence with synchronized beat position.
   */
  function loadBroadcastSequence(sequenceData: SequenceData, state: BroadcastStateClient) {
    if (!playbackController || !broadcastRepository) return;

    currentSequence = sequenceData;
    lastStep = -1;
    currentGeneratedInfo = null;

    const sequence = propTypeApplier.applyToSequence(sequenceData, PropType.STAFF);

    animationState.setShouldLoop(true);
    const success = playbackController.initialize(sequence, animationState);

    if (!success) return;

    animationState.setPlaybackMode("continuous");

    // Set initial beat position based on server time
    const currentStep = broadcastRepository.getCurrentStepPosition(
      state.startedAtMs,
      state.durationMs,
      state.currentSequence.totalSteps,
      state.beatsPerMinute
    );
    animationState.setCurrentStep(currentStep);

    if (!animationState.isPlaying) {
      playbackController.togglePlayback();
    }

    animationReady = true;
  }

  function hotSwapSequence(sequenceData: SequenceData) {
    if (!playbackController) return;

    currentSequence = sequenceData;
    lastStep = -1;

    const sequence = propTypeApplier.applyToSequence(sequenceData, PropType.STAFF);

    animationState.setShouldLoop(true);
    const success = playbackController.initialize(sequence, animationState);

    if (!success) return;

    animationState.setPlaybackMode("continuous");
    animationState.setCurrentStep(1);

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
      sequenceHistory = [
        { sequence: sequenceData, settings: null, timestamp: new Date() },
        ...sequenceHistory.slice(0, 19),
      ];

      const sequence = propTypeApplier.applyToSequence(sequenceData, PropType.STAFF);

      animationState.setShouldLoop(true);
      const success = playbackController.initialize(sequence, animationState);

      if (!success) {
        throw new Error("Failed to initialize playback");
      }

      animationReady = true;

      await tick();

      animationState.setPlaybackMode("continuous");
      animationState.setCurrentStep(1);
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

  async function handleCopy(full: boolean) {
    if (!currentSequence) return;
    const text = full
      ? sequenceDataSerializer.toFullJson(currentSequence, currentGeneratedInfo?.settings ?? null)
      : sequenceDataSerializer.toCompactDebug(currentSequence, currentGeneratedInfo?.settings ?? null);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-secure contexts
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  function handleTogglePause() {
    if (!playbackController) return;
    playbackController.togglePlayback();
  }

  function handleProgressBarSeek(targetStep: number) {
    if (!animationState) return;
    animationState.setCurrentStep(targetStep);
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
        {:else if spinnerMode === "infinite"}
          <InfiniteModeInfo sequenceInfo={currentGeneratedInfo} />
        {:else if spinnerMode === "live"}
          <LiveModeInfo {broadcastState} {serverTimeOffset} />
        {/if}
      </div>

      <!-- Animation area -->
      <div class="animation-area" class:with-grid={showStepGrid}>
        <div class="canvas-container">
          {#if animationReady}
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
              bluePropType={PropType.STAFF}
              redPropType={PropType.STAFF}
              word={currentSequence?.word || currentSequence?.name || ""}
              progressBarVariant="minimal"
              previewDarkMode={true}
              onProgressBarSeek={handleProgressBarSeek}
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

        {#if showStepGrid && animationState.sequenceData}
          <div class="beat-grid-container" in:fly={{ x: 50, duration: 300 }}>
            <StepGrid
              steps={animationState.sequenceData.steps}
              startPosition={derivedStartPosition}
              selectedStepNumber={currentStepNumber}
            />
          </div>
        {/if}
      </div>

      <!-- Controls -->
      <SpinnerControls
        isPlaying={animationState.isPlaying}
        {animationReady}
        {showStepGrid}
        {showHistory}
        onToggleGrid={() => (showStepGrid = !showStepGrid)}
        onTogglePause={handleTogglePause}
        onSkip={handleSkip}
        onCopy={handleCopy}
        onToggleHistory={() => (showHistory = !showHistory)}
      />

      <!-- Sequence history panel -->
      {#if showHistory}
        <SequenceHistoryPanel
          entries={sequenceHistory}
          serializer={sequenceDataSerializer}
        />
      {/if}

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
    /* Let AnimatorCanvas size itself naturally (includes header + square canvas) */
    background: rgba(0, 0, 0, 0.5);
    border-radius: 24px;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.05),
      0 20px 60px rgba(0, 0, 0, 0.5),
      0 0 100px rgba(99, 102, 241, 0.1);
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
    transition: all var(--duration-normal);
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
    transition: all var(--duration-normal);
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

  }

  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
    }
  }
</style>
