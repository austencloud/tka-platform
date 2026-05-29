<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { fly } from "svelte/transition";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import { createEndlessPlayback, type EndlessPlaybackState } from "$lib/shared/animation-engine/state/endless-playback-state.svelte";
  import type { SourceMode, PlaybackHistoryEntry } from "$lib/shared/animation-engine/domain/chaining-types";
  import type { SpinnerStats } from '$lib/shared/landing/domain/types';
  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/endless-spinner-orchestrator";
  import { getBrowseLoader } from "$lib/shared/browse/getBrowseLoader";
  import { getAnimationPlaybackController } from "$lib/shared/animation-engine/getAnimationPlaybackController";
  import { getGenerationOrchestrator } from "$lib/features/create/generate/shared/getGenerationOrchestrator";
  import { getSequenceTransformer } from "$lib/shared/create/getSequenceTransformer";

  import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
  import {
    animationSettings,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import StepGrid from "$lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

  // Mode toggle and infinite generation
  import type { SpinnerMode, SpinnerMetrics, GeneratedSequenceInfo } from "$lib/features/landing/domain/models/spinner-models";
  import { InfiniteSequenceGenerator } from "$lib/features/landing/services/infinite-sequence-generator";
  import { SpinnerMetricsRepository } from "$lib/features/landing/services/spinner-metrics-repository";
  import { orientationCycleExtender } from "$lib/features/create/generate/circular/services/implementations/OrientationCycleExtender";
  import SpinnerModeToggle from "$lib/features/landing/components/SpinnerModeToggle.svelte";
  import LibraryModeInfo from "$lib/features/landing/components/LibraryModeInfo.svelte";
  import InfiniteModeInfo from "$lib/features/landing/components/InfiniteModeInfo.svelte";
  import LiveModeInfo from "$lib/features/landing/components/LiveModeInfo.svelte";
  import SpinnerStatsBar from "$lib/features/landing/components/SpinnerStatsBar.svelte";

  // Broadcast imports — kept locally for LiveModeInfo display and step sync
  import type { BroadcastStateClient } from "$lib/shared/landing/domain/broadcast-models";
  import { BroadcastRepository } from "$lib/features/landing/services/broadcast-repository";
  import * as broadcastSequenceConverter from "$lib/features/landing/services/broadcast-sequence-converter";

  // Local extracted components
  import SpinnerControls from "./components/SpinnerControls.svelte";
  import EndlessSpinnerDebugPanel from "./components/EndlessSpinnerDebugPanel.svelte";

  const visibilityManager = getAnimationVisibilityManager();

  // Factory state
  let playback = $state<EndlessPlaybackState | null>(null);
  let animationReady = $state(false);
  let animationError = $state(false);
  let isChainingEnabled = $state(true);

  // UI state
  let showDebugPanel = $state(false);
  let showStepGrid = $state(true);
  let showHistory = $state(false);

  // Stats
  let stats = $state<SpinnerStats>({
    sequencesPlayed: 0,
    uniqueSequencesUsed: 0,
    directMatches: 0,
    rotatedMatches: 0,
    bridgesGenerated: 0,
  });
  let spinnerMode = $state<SpinnerMode>("library");
  let globalMetrics = $state<SpinnerMetrics | null>(null);
  let currentGeneratedInfo = $state<GeneratedSequenceInfo | null>(null);
  let transitionCount = $state(0);

  // Keep references needed for stats and mode info
  let metricsRepository: SpinnerMetricsRepository | null = null;
  let metricsUnsubscribe: (() => void) | null = null;
  let spinnerOrchestrator: EndlessSpinnerOrchestrator | null = null;
  let infiniteGen = $state<InfiniteSequenceGenerator | null>(null);

  // Broadcast (Live) mode — kept locally for LiveModeInfo display + step sync
  let broadcastRepository: BroadcastRepository | null = null;
  let broadcastState = $state<BroadcastStateClient | null>(null);
  let serverTimeOffset = $state(0);
  let broadcastUnsubscribe: (() => void) | null = null;
  let stepSyncInterval: ReturnType<typeof setInterval> | null = null;

  // Derived
  let currentStepNumber = $derived(Math.floor(playback?.animationState?.currentStep ?? 0));

  onMount(async () => {
    try {
      animationSettings.setTrackingMode(TrackingMode.BOTH_ENDS);
      visibilityManager.setDarkMode(true);

      const browseLoader = getBrowseLoader();
      const pc = getAnimationPlaybackController();
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

      metricsRepository = new SpinnerMetricsRepository();
      infiniteGen = new InfiniteSequenceGenerator(
        generationOrchestrator,
        metricsRepository,
        orientationCycleExtender
      );

      broadcastRepository = new BroadcastRepository();

      playback = createEndlessPlayback({
        modes: ["library", "infinite", "live"],
        defaultMode: "library",
        spinnerOrchestrator,
        infiniteGenerator: infiniteGen,
        broadcastProvider: broadcastRepository,
        playbackController: pc,
      });

      await playback.initialize();
      animationReady = true;
    } catch (err) {
      console.error("Initialization failed:", err);
      animationError = true;
    }
  });

  onDestroy(() => {
    playback?.dispose();
    metricsUnsubscribe?.();
    broadcastUnsubscribe?.();
    if (stepSyncInterval) {
      clearInterval(stepSyncInterval);
    }
  });

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

    // Tell the factory to switch modes
    await playback?.setSourceMode(newMode as SourceMode);

    // Subscribe to metrics updates when switching to infinite mode
    if (newMode === "infinite" && metricsRepository && !metricsUnsubscribe) {
      metricsUnsubscribe = metricsRepository.subscribe((metrics) => {
        globalMetrics = metrics;
      });
      metricsRepository.getMetrics().then((metrics) => {
        globalMetrics = metrics;
      });
    }

    // Reset generated info when switching to library mode
    if (newMode === "library") {
      currentGeneratedInfo = null;
    }

    // Subscribe to broadcast locally for LiveModeInfo display + step sync
    if (newMode === "live" && broadcastRepository) {
      serverTimeOffset = await broadcastRepository.calculateServerTimeOffset();

      broadcastUnsubscribe = broadcastRepository.subscribeToBroadcast((state) => {
        if (state) {
          broadcastState = state;
        } else {
          broadcastState = null;
        }
      });

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
      if (spinnerMode !== "live" || !broadcastState || !broadcastRepository || !playback) {
        return;
      }

      const targetStep = broadcastRepository.getCurrentStepPosition(
        broadcastState.startedAtMs,
        broadcastState.durationMs,
        broadcastState.currentSequence.totalSteps,
        broadcastState.beatsPerMinute
      );

      // If drift is more than 0.5 steps, resync
      const currentStep = playback.animationState.currentStep;
      if (Math.abs(currentStep - targetStep) > 0.5) {
        playback.animationState.setCurrentStep(targetStep);
      }
    }, 100);
  }

  function handleSkip() {
    playback?.skip();
  }

  async function handleCopy(_full: boolean) {
    if (!playback) return;
    await playback.copyForAI();
  }

  function handleTogglePause() {
    playback?.playbackController?.togglePlayback();
  }

  function handleProgressBarSeek(targetStep: number) {
    playback?.animationState?.setCurrentStep(targetStep);
  }

  async function handleRetry() {
    animationError = false;
    animationReady = false;
    try {
      if (playback) {
        await playback.initialize();
        animationReady = true;
      } else {
        animationError = true;
      }
    } catch {
      animationError = true;
    }
  }

  async function copyHistoryEntry(index: number) {
    if (!playback) return;
    await playback.copyHistoryEntry(index);
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
      {#if playback?.currentSequence}
        Now playing: {playback.currentSequence.word}
      {/if}
    </div>

    <!-- Animation showcase -->
    <main class="showcase">
      <!-- Mode-specific info display -->
      <div class="mode-info">
        {#if spinnerMode === "library"}
          <LibraryModeInfo sequence={playback?.currentSequence ?? null} />
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
              blueProp={playback?.animationState?.bluePropState ?? null}
              redProp={playback?.animationState?.redPropState ?? null}
              gridVisible={true}
              gridMode={playback?.gridMode ?? null}
              letter={playback?.currentLetter ?? null}
              stepData={playback?.currentStepData ?? null}
              sequenceData={playback?.animationState?.sequenceData}
              currentStep={playback?.animationState?.currentStep ?? 0}
              isPlaying={playback?.animationState?.isPlaying ?? false}
              trailSettings={animationSettings.trail}
              bluePropType={PropType.STAFF}
              redPropType={PropType.STAFF}
              word={playback?.currentSequence?.word || playback?.currentSequence?.name || ""}
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

        {#if showStepGrid && playback?.animationState?.sequenceData}
          <div class="beat-grid-container" in:fly={{ x: 50, duration: 300 }}>
            <StepGrid
              steps={playback.animationState.sequenceData.steps}
              startPosition={playback.derivedStartPosition}
              selectedStepNumber={currentStepNumber}
            />
          </div>
        {/if}
      </div>

      <!-- Controls -->
      <SpinnerControls
        isPlaying={playback?.animationState?.isPlaying ?? false}
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
      {#if showHistory && (playback?.history ?? []).length > 0}
        <div class="history-panel" transition:fly={{ y: 100, duration: 250 }}>
          <div class="panel-header">
            <span class="panel-title">Recent Sequences</span>
            <span class="entry-count">{(playback?.history ?? []).length}</span>
          </div>
          <div class="entries">
            {#each playback?.history ?? [] as entry, i (entry.timestamp)}
              <div class="entry" class:current={i === 0}>
                <div class="entry-info">
                  <span class="entry-index">#{(playback?.history ?? []).length - i}</span>
                  <span class="entry-word">{entry.word ?? entry.sequence.word ?? "Generated"}</span>
                  <span class="entry-mode">{entry.sourceMode}</span>
                  <span class="entry-steps">{entry.sequence.steps?.length ?? 0} beats</span>
                </div>
                <div class="entry-actions">
                  <button
                    class="history-copy-btn"
                    onclick={() => copyHistoryEntry(i)}
                  >Copy</button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Stats bar -->
      <SpinnerStatsBar
        mode={spinnerMode}
        libraryStats={stats}
        {transitionCount}
        {globalMetrics}
        sessionGeneratedCount={infiniteGen?.getSessionCount() ?? 0}
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
        sequenceHistory={playback?.history ?? []}
        {stats}
        gridMode={playback?.gridMode ?? null}
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

  /* History panel (inline replacement for SequenceHistoryPanel) */
  .history-panel {
    width: 100%;
    max-width: 520px;
    max-height: 320px;
    display: flex;
    flex-direction: column;
    background: rgba(10, 10, 20, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .panel-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
  }

  .entry-count {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .entries {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    gap: 8px;
  }

  .entry.current {
    background: rgba(99, 102, 241, 0.08);
  }

  .entry:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .entry-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .entry-index {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.3);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .entry-word {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entry-mode {
    font-size: var(--font-size-compact, 12px);
    color: rgba(139, 92, 246, 0.8);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .entry-steps {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.25);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .entry-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .history-copy-btn {
    padding: 4px 10px;
    min-height: 28px;
    font-size: var(--font-size-compact, 12px);
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .history-copy-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.9);
  }

  .history-copy-btn:focus-visible {
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

    .entry-mode,
    .entry-steps {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
    }

    .history-copy-btn {
      transition: none;
    }
  }
</style>
