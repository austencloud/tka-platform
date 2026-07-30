<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { flyFade } from "$lib/shared/transitions/motion";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { SourceMode } from "$lib/shared/animation-engine/domain/chaining-types";
  import type { SpinnerStats } from "$lib/shared/landing/domain/types";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { TrackingMode } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { createAnimationScope } from "$lib/shared/animation-engine/state/animation-scope.svelte";
  import { setAnimationScopeContext } from "$lib/shared/animation-engine/state/animation-scope-context";
  import { setAnimationVisibilityContext } from "$lib/shared/animation-engine/state/animation-visibility-context";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import StepGrid from "$lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  // Mode toggle and infinite generation
  import type {
    SpinnerMode,
    SpinnerMetrics,
    GeneratedSequenceInfo,
  } from "$lib/features/landing/domain/models/spinner-models";
  import SpinnerModeToggle from "$lib/features/landing/components/SpinnerModeToggle.svelte";
  import LibraryModeInfo from "$lib/features/landing/components/LibraryModeInfo.svelte";
  import InfiniteModeInfo from "$lib/features/landing/components/InfiniteModeInfo.svelte";
  import SpinnerStatsBar from "$lib/features/landing/components/SpinnerStatsBar.svelte";

  import Crossfade from "$lib/shared/components/Crossfade.svelte";

  // Local extracted components and services
  import SpinnerControls from "./components/SpinnerControls.svelte";
  import SpinnerHistoryPanel from "./components/SpinnerHistoryPanel.svelte";
  import EndlessSpinnerDebugPanel from "./components/EndlessSpinnerDebugPanel.svelte";
  import {
    createSpinnerSession,
    type SpinnerSession,
  } from "./services/create-spinner-session";

  // Page-scoped animation state: an ephemeral AnimationScope owns this route's
  // visibility, settings, and effects, so the immersive defaults set below
  // (dark mode, both-ends tracking) never write into the signed-in user's
  // persisted app settings — and nothing another surface persisted leaks in.
  const scope = setAnimationScopeContext(
    createAnimationScope({ persistence: "ephemeral" })
  );
  const visibilityManager = setAnimationVisibilityContext(scope.visibility);
  const effectsConfigState = setEffectsConfigContext(scope.effects);
  visibilityManager.effectsConfigState = effectsConfigState;

  // Factory state
  let session = $state<SpinnerSession | null>(null);
  let playback = $derived(session?.playback ?? null);
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
  let spinnerMode = $state<SpinnerMode>("infinite");
  let sessionGeneratedCount = $state(0);
  let globalMetrics = $state<SpinnerMetrics | null>(null);
  let currentGeneratedInfo = $state<GeneratedSequenceInfo | null>(null);

  let metricsUnsubscribe: (() => void) | null = null;
  let modeRevision = 0;

  // Derived
  let currentStepNumber = $derived(
    Math.floor(playback?.animationState?.currentStep ?? 0)
  );
  let transitionCount = $derived(
    Math.max(0, (playback?.sequenceSwapCount ?? 0) - 1)
  );

  $effect(() => {
    const swapCount = playback?.sequenceSwapCount ?? 0;
    const currentSequence = playback?.currentSequence ?? null;

    if (swapCount === 0 || !currentSequence) return;

    if (spinnerMode === "library" && session) {
      stats = session.spinnerOrchestrator.getStats();
    }

    currentGeneratedInfo =
      spinnerMode === "infinite" && session
        ? session.infiniteGenerator.getInfoForSequence(currentSequence)
        : null;

    // The generator's counter is plain (non-reactive) state; it only changes
    // when a generation lands, and every landed generation swaps — so syncing
    // it here, on the swap signal, keeps the stats bar honest.
    if (session) {
      sessionGeneratedCount = session.infiniteGenerator.getSessionCount();
    }
  });

  $effect(() => {
    playback?.setChainingEnabled(isChainingEnabled);
  });

  onMount(async () => {
    try {
      scope.settings.setTrackingMode(TrackingMode.BOTH_ENDS);
      visibilityManager.setDarkMode(true);

      session = createSpinnerSession(scope);
      metricsUnsubscribe = session.metricsRepository.subscribe(
        (m) => (globalMetrics = m)
      );
      session.metricsRepository
        .getMetrics()
        .then((m) => (globalMetrics = m));

      await session.playback.initialize();
      // A resolved initialize with no sequence is still a failed boot — the
      // canvas would sit empty behind live-looking controls. Show the error
      // state (with retry) instead of marking the page ready.
      if (session.playback.currentSequence) {
        animationReady = true;
      } else {
        animationError = true;
      }
    } catch (err) {
      console.error("Initialization failed:", err);
      animationError = true;
    }
  });

  onDestroy(() => {
    modeRevision++;
    playback?.dispose();
    metricsUnsubscribe?.();
  });

  async function handleModeChange(newMode: SpinnerMode) {
    if (!playback) return;

    const revision = ++modeRevision;
    const previousMode = spinnerMode;
    spinnerMode = newMode;

    try {
      await playback.setSourceMode(newMode as SourceMode);
    } catch (error) {
      if (revision !== modeRevision) return;

      spinnerMode = previousMode;
      const failure = error instanceof Error ? error : new Error(String(error));
      getErrorHandler().showUserError({
        message: t("landing_spinner_source_error"),
        technicalDetails: failure.message,
        error: failure,
        severity: "error",
        context: {
          module: "endless-spinner",
          action: "changeSequenceSource",
        },
      });

      try {
        await playback.setSourceMode(previousMode as SourceMode);
      } catch (recoveryError) {
        console.error(
          "Failed to restore the previous spinner mode:",
          recoveryError
        );
      }
      return;
    }

    if (revision !== modeRevision) return;

    // Release the metrics listener as soon as Infinite mode is left; the
    // onDestroy cleanup stays as the fallback for leaving the page mid-mode.
    if (newMode !== "infinite" && metricsUnsubscribe) {
      metricsUnsubscribe();
      metricsUnsubscribe = null;
    }

    // Subscribe to metrics updates when switching to infinite mode
    if (newMode === "infinite" && session && !metricsUnsubscribe) {
      metricsUnsubscribe = session.metricsRepository.subscribe((metrics) => {
        globalMetrics = metrics;
      });
      session.metricsRepository.getMetrics().then((metrics) => {
        globalMetrics = metrics;
      });
    }

    // Reset generated info when switching to library mode
    if (newMode === "library") {
      currentGeneratedInfo = null;
    }
  }

  function handleSkip() {
    playback?.skip();
  }

  async function handleCopy(): Promise<boolean> {
    if (!playback) return false;

    const result = await playback.copyForAI();
    if (result.success) return true;

    const failure = result.error ?? new Error("Clipboard write failed");
    getErrorHandler().showUserError({
      message: t("landing_spinner_copy_error"),
      technicalDetails: failure.message,
      error: failure,
      severity: "error",
      context: {
        module: "endless-spinner",
        action: "copySequenceData",
      },
    });
    return false;
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
        if (playback.currentSequence) {
          animationReady = true;
        } else {
          animationError = true;
        }
      } else {
        animationError = true;
      }
    } catch {
      animationError = true;
    }
  }

  async function copyHistoryEntry(index: number): Promise<boolean> {
    if (!playback) return false;
    const result = await playback.copyHistoryEntry(index);
    if (result.success) return true;
    const failure = result.error ?? new Error("Clipboard write failed");
    getErrorHandler().showUserError({
      message: t("landing_spinner_copy_error"),
      technicalDetails: failure.message,
      error: failure,
      severity: "error",
      context: {
        module: "endless-spinner",
        action: "copyHistoryEntry",
      },
    });
    return false;
  }
</script>

<svelte:head>
  <title>Endless Spinner | The Kinetic Alphabet</title>
  <meta
    name="description"
    content="Watch TKA sequences chain from one end state to the next in Library, Infinite, or Live mode."
  />
</svelte:head>

<div class="page endless-spinner-page">
  <!-- Ambient background -->
  <div class="ambient-bg"></div>

  <!-- Main content -->
  <div class="content">
    <!-- The page is deliberately chrome-less (an immersive stage), but the
         footer and FAQ link the public here, so those visitors need one
         obvious way back into the site. -->
    <a class="home-link" href="/">← {t("landing_spinner_home")}</a>

    <!-- Header -->
    <header class="header">
      <h1 class="title">{t("landing_spinner_title")}</h1>
      <p class="subtitle">{t("landing_spinner_subtitle")}</p>

      <!-- Mode toggle -->
      <div class="mode-toggle-container">
        <SpinnerModeToggle mode={spinnerMode} onModeChange={handleModeChange} />
      </div>
    </header>

    <!-- Screen reader announcements -->
    <div class="sr-only" aria-live="polite" aria-atomic="true">
      {#if playback?.currentSequence}
        {t("landing_spinner_now_playing", {
          word: simplifyRepeatedWord(playback.currentSequence.word ?? ""),
        })}
      {/if}
    </div>

    <!-- Animation showcase -->
    <main class="showcase">
      <!-- Mode-specific info display -->
      <div class="mode-info">
        <Crossfade key={spinnerMode} fill>
          <div class="mode-info-layer">
            {#if spinnerMode === "library"}
              <LibraryModeInfo sequence={playback?.currentSequence ?? null} />
            {:else if spinnerMode === "infinite"}
              <InfiniteModeInfo sequenceInfo={currentGeneratedInfo} />
            {/if}
          </div>
        </Crossfade>
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
              trailSettings={scope.settings.trail}
              visibilityManagerOverride={visibilityManager}
              {effectsConfigState}
              bluePropType={PropType.STAFF}
              redPropType={PropType.STAFF}
              word={simplifyRepeatedWord(
                playback?.currentSequence?.word ||
                  playback?.currentSequence?.name ||
                  ""
              )}
              progressBarVariant="minimal"
              hideProgressBar={true}
              previewDarkMode={true}
              tapToToggle={true}
              onPlaybackToggle={handleTogglePause}
              onProgressBarSeek={handleProgressBarSeek}
            />
          {:else if animationError}
            <div class="state-message error" role="alert">
              <span class="icon" aria-hidden="true">!</span>
              <span>{t("landing_spinner_load_error")}</span>
              <button type="button" class="retry-btn" onclick={handleRetry}>
                {t("landing_spinner_try_again")}
              </button>
            </div>
          {:else}
            <div class="state-message loading">
              <div class="loading-spinner"></div>
              <span>{t("landing_spinner_loading")}</span>
            </div>
          {/if}
        </div>

        {#if showStepGrid && playback?.animationState?.sequenceData}
          <div class="beat-grid-container" in:flyFade={{ x: 50, y: 0, duration: 300 }}>
            <div class="beat-grid-header">
              <span class="beat-grid-title">{t("landing_spinner_notation")}</span>
              <span class="beat-grid-count">
                {t("landing_infinite_steps", {
                  count: playback.animationState.sequenceData.steps.length,
                })}
              </span>
            </div>
            <div class="beat-grid-content">
              <StepGrid
                steps={playback.animationState.sequenceData.steps}
                startPosition={playback.derivedStartPosition}
                selectedStepNumber={currentStepNumber}
              />
            </div>
          </div>
        {/if}
      </div>

      <div class="transport-bar">
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

        <SpinnerStatsBar
          mode={spinnerMode}
          libraryStats={stats}
          {transitionCount}
          {globalMetrics}
          {sessionGeneratedCount}
        />
      </div>

      {#if showHistory}
        <SpinnerHistoryPanel
          entries={playback?.history ?? []}
          onCopyEntry={copyHistoryEntry}
        />
      {/if}
    </main>

    <!-- Debug toggle -->
    <button
      type="button"
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
  /* The site-wide continuous 4K ramp (src/app.css) is scoped to the marketing
     and legal shells, which this standalone route never mounts. Opt in with the
     identical 1680→3840 formula so every rem measure on the page scales in
     lockstep and 2560px is never an unscaled seam (4k-native-layout.md). */
  @media (min-width: 1680px) {
    :global(html:has(.endless-spinner-page)) {
      font-size: clamp(16px, calc(16px + (100vw - 1680px) * 8 / 2160), 24px);
    }
  }

  .page {
    min-height: 100vh;
    min-height: 100dvh;
    background: #030308;
    color: #fff;
    font-family: var(--font-body, system-ui, -apple-system, sans-serif);
    position: relative;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .ambient-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(
        ellipse 80% 50% at 50% 0%,
        color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent),
        transparent
      ),
      radial-gradient(
        ellipse 60% 40% at 80% 100%,
        color-mix(in srgb, var(--semantic-success, #22c55e) 10%, transparent),
        transparent
      ),
      radial-gradient(
        ellipse 50% 30% at 20% 80%,
        rgba(236, 72, 153, 0.08),
        transparent
      );
    pointer-events: none;
  }

  .content {
    position: relative;
    width: min(calc(100% - clamp(2rem, 5vw, 6rem)), var(--shell-w, 108rem));
    margin: 0 auto;
    padding: clamp(1.25rem, 3dvh, 3rem) 0;
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .home-link {
    position: absolute;
    top: clamp(1rem, 2dvh, 1.5rem);
    left: 0;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.5rem 0.875rem;
    box-sizing: border-box;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 0.5rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 0.875rem);
    text-decoration: none;
    transition: all var(--duration-normal);
  }

  .home-link:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
  }

  .home-link:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Header */
  .header {
    text-align: center;
    margin-bottom: clamp(1rem, 2.5dvh, 2rem);
  }

  .title {
    margin: 0;
    font-size: clamp(2rem, 3vw, 3.5rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.05;
    background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.7) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    margin: 0.625rem 0 0;
    font-size: var(--font-size-min, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.56));
    font-weight: 400;
  }

  .mode-toggle-container {
    margin-top: 1rem;
  }

  /* Showcase */
  .showcase {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: clamp(0.75rem, 1.4vw, 1.5rem);
    width: 100%;
    padding: clamp(0.75rem, 1.4vw, 1.5rem);
    box-sizing: border-box;
    background: var(--theme-panel-bg, rgba(8, 8, 18, 0.86));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: clamp(1rem, 1.5vw, 1.75rem);
    box-shadow:
      0 1.5rem 5rem rgba(0, 0, 0, 0.32),
      0 0 0 1px rgba(99, 102, 241, 0.04);
  }

  /* Fixed-height stage sized to the TALLEST mode (Infinite with its badge
     slot reserved), so switching modes or timed content can never move the
     canvas and controls below. The Crossfade fills this box. */
  .mode-info {
    height: 5.75rem;
    padding: 0 1rem;
    box-sizing: border-box;
  }

  .mode-info-layer {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Animation area. On stacked (narrow) layouts the box dissolves into the
     showcase column (display: contents) so the transport bar can slot in
     right under the canvas — otherwise a tall canvas plus the notation grid
     push play/pause a full screen below the fold on tablets and phones. */
  .animation-area {
    display: contents;
  }

  .canvas-container {
    order: 1;
    align-self: center;
  }

  .transport-bar {
    order: 2;
  }

  .beat-grid-container {
    order: 3;
  }

  .showcase > :global(.history-panel) {
    order: 4;
  }

  .canvas-container {
    position: relative;
    width: min(100%, 42rem);
    aspect-ratio: 1 / 1.16;
    justify-self: center;
    min-width: 0;
    overflow: hidden;
    background: #05050b;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: clamp(0.875rem, 1.2vw, 1.5rem);
    box-shadow:
      0 1rem 3rem rgba(0, 0, 0, 0.36),
      0 0 5rem rgba(99, 102, 241, 0.08);
  }

  .beat-grid-container {
    width: 100%;
    height: clamp(24rem, 62dvh, 44rem);
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.035));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: clamp(0.875rem, 1.2vw, 1.5rem);
  }

  .beat-grid-header {
    min-height: 3.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    box-sizing: border-box;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .beat-grid-title {
    color: var(--theme-text, rgba(255, 255, 255, 0.92));
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 650;
    letter-spacing: 0.01em;
  }

  .beat-grid-count {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.52));
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .beat-grid-content {
    flex: 1 1 auto;
    min-height: 0;
    padding: clamp(0.5rem, 0.8vw, 0.875rem);
    box-sizing: border-box;
  }

  .transport-bar {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: clamp(1rem, 2vw, 2rem);
    width: 100%;
    padding: 0.25rem;
    box-sizing: border-box;
  }

  .state-message {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .state-message.error {
    /* Error token lightened toward white for legibility on the dark stage. */
    color: color-mix(in srgb, var(--semantic-error, #ef4444) 65%, white);
  }

  .state-message .icon {
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 700;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 20%, transparent);
    border-radius: 50%;
  }

  .loading-spinner {
    width: 2.5rem;
    height: 2.5rem;
    border: 0.1875rem solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--theme-accent, #6366f1);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Retry button */
  .retry-btn {
    margin-top: 0.5rem;
    padding: 0.625rem 1.25rem;
    min-height: var(--min-touch-target, 44px);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
    border-radius: 0.5rem;
    color: var(--theme-accent-text, #a5b4fc);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .retry-btn:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent);
    color: color-mix(in srgb, var(--theme-accent-text, #a5b4fc) 70%, white);
  }

  .retry-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
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
    bottom: 1.25rem;
    right: 1.25rem;
    padding: 0.75rem 1.25rem;
    min-height: var(--min-touch-target, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 0.5rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.75rem;
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .debug-toggle:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
  }

  .debug-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Responsive */
  @media (min-width: 1050px) {
    /* Side-by-side canvas + notation. The area flexes into whatever height
       the viewport leaves after the header, mode stage, and transport — so
       the whole page fits a desktop screen with no scrollbar. The floor
       keeps it usable on short windows (then the page scrolls instead of
       crushing the canvas). */
    .animation-area {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      justify-content: center;
      align-items: stretch;
      gap: clamp(0.75rem, 1.4vw, 1.5rem);
      width: 100%;
      min-width: 0;
      flex: 1 1 auto;
      min-height: 24rem;
    }

    .canvas-container,
    .beat-grid-container,
    .transport-bar {
      order: 0;
    }

    .canvas-container {
      align-self: auto;
    }

    .animation-area.with-grid {
      grid-template-columns:
        minmax(25rem, 0.92fr)
        minmax(30rem, 1.08fr);
    }

    .canvas-container {
      width: 100%;
      height: 100%;
      aspect-ratio: auto;
    }

    .animation-area:not(.with-grid) .canvas-container {
      width: min(100%, 60rem);
    }

    .beat-grid-container {
      height: 100%;
    }
  }


  /* No 2600px step tier: the continuous root ramp above grows every rem
     measure on this page instead (a scale-only tier is redundant with it). */

  @media (max-width: 760px) {
    .transport-bar {
      grid-template-columns: minmax(0, 1fr);
      justify-items: center;
    }
  }

  @media (max-width: 600px) {
    .content {
      width: calc(100% - 1rem);
      padding: 0.875rem 0 1.25rem;
    }

    .header {
      margin-bottom: 0.875rem;
    }

    /* Compact pill so it clears the centered title on narrow phones. */
    .home-link {
      top: 0.25rem;
      padding: 0.375rem 0.625rem;
      font-size: var(--font-size-compact, 0.75rem);
    }

    .title {
      font-size: 1.75rem;
    }

    .subtitle {
      margin-top: 0.375rem;
      font-size: var(--font-size-compact, 0.75rem);
    }

    .mode-toggle-container {
      margin-top: 0.75rem;
    }

    .showcase {
      gap: 0.75rem;
      padding: 0.625rem;
      border-radius: 1rem;
    }

    .mode-info {
      height: 7.25rem;
      padding-inline: 0.375rem;
    }

    .canvas-container {
      width: 100%;
      border-radius: 0.875rem;
    }

    .beat-grid-container {
      height: min(75dvh, 34rem);
      border-radius: 0.875rem;
    }

    .beat-grid-header {
      min-height: 2.75rem;
      padding: 0.625rem 0.75rem;
    }

    .beat-grid-content {
      padding: 0.375rem;
    }

    .transport-bar {
      gap: 0.875rem;
    }
  }

  @media (min-width: 700px) and (max-height: 600px) {
    .content {
      width: calc(100% - 1.5rem);
      padding-block: 0.5rem;
    }

    .header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        "title mode"
        "subtitle mode";
      align-items: center;
      column-gap: 1.5rem;
      margin-bottom: 0.5rem;
      /* Clears the absolute Home pill, which sits left of the left-aligned
         title in this tier. */
      padding-left: 6.75rem;
      text-align: left;
    }

    .home-link {
      top: 0.5rem;
    }

    .title {
      grid-area: title;
      font-size: 1.5rem;
    }

    .subtitle {
      grid-area: subtitle;
      margin-top: 0.2rem;
      font-size: var(--font-size-compact, 0.75rem);
    }

    .mode-toggle-container {
      grid-area: mode;
      margin-top: 0;
    }

    .showcase {
      gap: 0.5rem;
      padding: 0.5rem;
      border-radius: 0.875rem;
    }

    .mode-info {
      height: 2.25rem;
    }

    /* Short-and-wide (folded phone landscape): canvas and notation go back
       side by side, so the box must be a real grid again. */
    .animation-area {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      width: 100%;
      min-width: 0;
      height: clamp(14rem, calc(100dvh - 11.75rem), 26rem);
      gap: 0.625rem;
    }

    .canvas-container,
    .beat-grid-container,
    .transport-bar {
      order: 0;
    }

    .canvas-container {
      align-self: auto;
    }

    .animation-area.with-grid {
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    }

    .canvas-container,
    .beat-grid-container {
      width: 100%;
      height: 100%;
      aspect-ratio: auto;
    }

    .beat-grid-header {
      min-height: 2.25rem;
      padding: 0.375rem 0.625rem;
    }

    .beat-grid-content {
      padding: 0.25rem;
    }

    .transport-bar {
      grid-template-columns: auto minmax(0, 1fr);
      gap: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
    }
  }
</style>
