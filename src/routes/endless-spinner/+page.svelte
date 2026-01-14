<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { fly, fade } from "svelte/transition";
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
  import { simplifyRepeatedWord } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

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

  // Build the full shifted word from beat letters
  let fullShiftedWord = $derived.by(() => {
    if (!animationState.sequenceData?.beats?.length) return "";
    return animationState.sequenceData.beats
      .map((beat) => beat.letter ?? "")
      .filter((letter) => letter !== "")
      .join("");
  });

  // Simplify repeated patterns (e.g., "ABCDABCD" → "ABCD")
  let simplifiedWord = $derived(simplifyRepeatedWord(fullShiftedWord));

  // Parse simplified word into letter units (handles dash-letters like "Λ-")
  let currentWordLetters = $derived.by(() => {
    if (!simplifiedWord) return [];
    const letters: string[] = [];
    let i = 0;
    while (i < simplifiedWord.length) {
      const char = simplifiedWord[i];
      const nextChar = simplifiedWord[i + 1];
      if (nextChar === "-") {
        letters.push(char + "-");
        i += 2;
      } else {
        letters.push(char);
        i += 1;
      }
    }
    return letters;
  });

  // Active letter index with wrapping for circular sequences
  let activeLetterIndex = $derived.by(() => {
    if (currentWordLetters.length === 0 || currentBeatNumber < 1) return -1;
    // Use modulo to wrap around the simplified word length
    return (currentBeatNumber - 1) % currentWordLetters.length;
  });

  // Pre-load next sequence
  $effect(() => {
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
    if (!spinnerOrchestrator || !playbackController || isChainingNow) return;

    isChainingNow = true;
    transitionCount++;

    try {
      let nextSeq = preloadedSequence;
      if (!nextSeq && currentSequence) {
        const endState = extractEndState(currentSequence);
        nextSeq = await spinnerOrchestrator.getNextSequence(endState);
        if (!nextSeq) {
          nextSeq = await spinnerOrchestrator.getInitialSequence();
        }
      }

      if (nextSeq) {
        hotSwapSequence(nextSeq);
        sequenceHistory = [nextSeq.word, ...sequenceHistory.slice(0, 9)];
        const orchestratorStats = spinnerOrchestrator.getStats();
        stats = { ...orchestratorStats };
      }

      preloadedSequence = null;
    } catch (err) {
      console.error("Chain failed:", err);
    } finally {
      isChainingNow = false;
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
    </header>

    <!-- Screen reader announcements -->
    <div class="sr-only" aria-live="polite" aria-atomic="true">
      {#if currentSequence}
        Now playing: {currentSequence.word}
      {/if}
    </div>

    <!-- Animation showcase -->
    <main class="showcase">
      <!-- Current sequence name with active letter highlighting -->
      {#if currentSequence}
        <div class="sequence-name" in:fade={{ duration: 200 }}>
          <div class="word-display">
            {#each currentWordLetters as letter, index}
              <span
                class="letter"
                class:active={activeLetterIndex === index}
              >{letter}</span>
            {/each}
          </div>
        </div>
      {/if}

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
      <div class="controls" role="group" aria-label="Playback controls">
        <button
          class="control-btn secondary"
          onclick={() => (showBeatGrid = !showBeatGrid)}
          aria-label={showBeatGrid ? "Hide notation grid" : "Show notation grid"}
          aria-pressed={showBeatGrid}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>

        <button
          class="control-btn primary"
          onclick={handleTogglePause}
          disabled={!animationReady}
          aria-label={animationState.isPlaying ? "Pause animation" : "Play animation"}
        >
          {#if animationState.isPlaying}
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          {/if}
        </button>

        <button
          class="control-btn secondary"
          onclick={handleSkip}
          disabled={!animationReady}
          aria-label="Skip to next sequence"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 4v16l10-8z" />
            <rect x="16" y="4" width="2" height="16" />
          </svg>
        </button>
      </div>

      <!-- Stats bar -->
      <div class="stats-bar">
        <div class="stat">
          <span class="stat-value">{transitionCount}</span>
          <span class="stat-label">transitions</span>
        </div>
        <div class="stat">
          <span class="stat-value">{stats.uniqueSequencesUsed}</span>
          <span class="stat-label">unique</span>
        </div>
        <div class="stat">
          <span class="stat-value">{sequenceHistory.length}</span>
          <span class="stat-label">in session</span>
        </div>
      </div>
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
      <aside class="debug-panel" in:fly={{ y: 20, duration: 200 }}>
        <div class="debug-section">
          <h3>Sequence Chain</h3>
          <div class="history-list">
            {#each sequenceHistory as seq, i}
              <div class="history-item" class:current={i === 0}>{seq}</div>
            {/each}
          </div>
        </div>

        <div class="debug-section">
          <h3>Statistics</h3>
          <div class="debug-stats">
            <div class="debug-stat">
              <span>Played:</span>
              <span>{stats.sequencesPlayed}</span>
            </div>
            <div class="debug-stat">
              <span>Direct matches:</span>
              <span>{stats.directMatches}</span>
            </div>
            <div class="debug-stat">
              <span>Rotated:</span>
              <span>{stats.rotatedMatches}</span>
            </div>
            <div class="debug-stat">
              <span>Grid mode:</span>
              <span>{gridMode ?? "—"}</span>
            </div>
          </div>
        </div>

        <div class="debug-section">
          <h3>Controls</h3>
          <label class="toggle-row">
            <input type="checkbox" bind:checked={isChainingEnabled} />
            <span>Auto-chain sequences</span>
          </label>
        </div>
      </aside>
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

  .logo {
    display: inline-flex;
    margin-bottom: 16px;
  }

  .logo-icon {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
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

  /* Showcase */
  .showcase {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }

  .sequence-name {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .word-display {
    display: flex;
    font-family: Georgia, serif;
    font-size: clamp(1.5rem, 5vw, 2.5rem);
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .word-display .letter {
    color: rgba(255, 255, 255, 0.25);
    transition: color 0.15s ease, text-shadow 0.15s ease;
  }

  .word-display .letter.active {
    color: #fff;
    text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
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

  /* Controls */
  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;
  }

  .control-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .control-btn.primary {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
  }

  .control-btn.primary:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 6px 28px rgba(99, 102, 241, 0.5);
  }

  .control-btn.primary svg {
    width: 28px;
    height: 28px;
  }

  .control-btn.secondary {
    width: 48px;
    height: 48px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }

  .control-btn.secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .control-btn.secondary svg {
    width: 20px;
    height: 20px;
  }

  /* Focus indicators */
  .control-btn:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
  }

  .control-btn.primary:focus-visible {
    outline-color: #fff;
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

  /* Stats bar */
  .stats-bar {
    display: flex;
    gap: 32px;
    padding: 16px 32px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    font-family: monospace;
    color: #fff;
  }

  .stat-label {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.05em;
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

  /* Debug panel */
  .debug-panel {
    position: fixed;
    bottom: 60px;
    right: 20px;
    width: 300px;
    max-height: 60vh;
    overflow-y: auto;
    background: rgba(10, 10, 20, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    backdrop-filter: blur(20px);
  }

  .debug-section h3 {
    margin: 0 0 8px;
    font-size: 0.7rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 150px;
    overflow-y: auto;
  }

  .history-item {
    font-size: 0.75rem;
    font-family: monospace;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.5);
  }

  .history-item.current {
    background: rgba(80, 200, 120, 0.15);
    color: #50c878;
  }

  .debug-stats {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .debug-stat {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
  }

  .debug-stat span:first-child {
    color: rgba(255, 255, 255, 0.4);
  }

  .debug-stat span:last-child {
    font-family: monospace;
    color: rgba(255, 255, 255, 0.8);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
  }

  .toggle-row input {
    accent-color: #6366f1;
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

    .stats-bar {
      gap: 20px;
      padding: 12px 20px;
    }

    .debug-panel {
      width: calc(100vw - 40px);
      left: 20px;
      right: 20px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
    }
  }
</style>
