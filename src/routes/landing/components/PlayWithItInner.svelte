<!--
  PlayWithItInner.svelte

  The heavy inner component for the Infinite Spinner section. Dynamically
  imported by PlayWithItSection when scrolled into view. Renders the endless
  spinner through the SAME control surface the app uses: AnimatorCanvas plus
  the real AnimationPanel (pill-nav sidebar on desktop, ControlDock bottom bar
  on mobile). No hand-rolled controls — effects, props, effort, display, and
  tempo are all the shared components, scoped to this section via the
  effects-config and animation-visibility contexts.
-->
<script lang="ts">

import { createAnimationPlaybackController } from "$lib/features/compose/services/animation-playback-controller-factory";
import { sequenceTransformer } from "$lib/shared/create/services/sequence-transformer";
  import { onMount, onDestroy } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import AnimationPanel from "$lib/shared/animation-panel/components/AnimationPanel.svelte";
  import { createEndlessPlayback, type EndlessPlaybackState } from "$lib/shared/animation-engine/state/endless-playback-state.svelte";
  import * as propTypeApplier from "$lib/shared/landing/services/prop-type-applier";
  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/endless-spinner-orchestrator";
  import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
  import { startPositionDeriver as startPositionDeriverInstance } from "$lib/shared/pictograph/shared/services/start-position-deriver";
  import { generationOrchestrator } from "$lib/shared/create/services/generation-orchestrator";
  import { TrackingMode } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { createAnimationScope } from "$lib/shared/animation-engine/state/animation-scope.svelte";
  import { setAnimationScopeContext } from "$lib/shared/animation-engine/state/animation-scope-context";
  import { setAnimationVisibilityContext } from "$lib/shared/animation-engine/state/animation-visibility-context";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { SequenceViewerVisibilityState } from "$lib/shared/sequence-viewer/state/viewer-visibility-state.svelte";
  import { setViewerVisibilityContext } from "$lib/shared/sequence-viewer/context/viewer-visibility-context";
  import BeatStrip from "$lib/shared/timeline/BeatStrip.svelte";
  import { buildNotationCells, type NotationCell } from "$lib/shared/timeline/notation-cell";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  // ── Factory state ──────────────────────────────────────────────────────────
  let playback = $state<EndlessPlaybackState | null>(null);
  let animationReady = $state(false);
  let animationError = $state(false);

  // Prop state
  let currentPropType = $state<PropType>(PropType.STAFF);

  // Per-surface animation state: one ephemeral AnimationScope owns this player's
  // visibility, settings, and effects so nothing persists to localStorage and
  // nothing leaks into (or from) the signed-in user's global app settings.
  // The visibility + effects sub-contexts point at the scope's instances so the
  // AnimationPanel sections (Effort/Display/Paths/Effects) drive THIS scope.
  const scope = setAnimationScopeContext(createAnimationScope({ persistence: "ephemeral" }));
  const visibilityManager = setAnimationVisibilityContext(scope.visibility);
  const effectsConfigState = setEffectsConfigContext(scope.effects);
  visibilityManager.effectsConfigState = effectsConfigState;

  // Per-color PROP visibility (the spinning prop + its trail), independent of
  // the path-line chips. Reuses the sequence viewer's exact mechanism:
  // CanvasSurface reads this context and calls engine.setMotionVisibility, and
  // the render loop gates each prop + its trail on it. allowNone=true so a
  // visitor can hide both props (path lines still available) — the landing
  // wants prop existence as its own free variable.
  setViewerVisibilityContext(new SequenceViewerVisibilityState(true));

  // BPM state - local to this landing section
  let bpm = $state(60);

  // ── Derived values ─────────────────────────────────────────────────────────
  let isPlaying = $derived(playback?.animationState?.isPlaying ?? false);

  // ── Responsive layout: sidebar panel beside the canvas on wide screens,
  //    ControlDock bottom bar inside the showcase on narrow ones. ─────────────
  let isDesktopLayout = $state(
    typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 920px)").matches
  );
  $effect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 920px)");
    const handler = (e: MediaQueryListEvent) => { isDesktopLayout = e.matches; };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });

  // ── Initialize animation engine ─────────────────────────────────────────────
  onMount(async () => {
    try {
      scope.settings.setTrackingMode(TrackingMode.BOTH_ENDS);
      // Set landing-page default BPM (60 feels comfortable for visitors)
      scope.settings.setBpm(bpm);

      // Dark mode on for visual impact
      visibilityManager.setDarkMode(true);
      // Trails on by default
      effectsConfigState.setActiveEffect("trails");

      const browseLoader = getBrowseLoader();
      // Pass the scope's visibility manager so prop interpolation (path shape /
      // motion-aware paths) reads from THIS surface's scope — keeps the spinning
      // props on the same path the path-line overlay draws, scoped + ephemeral.
      const pc = createAnimationPlaybackController(scope.visibility);

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

      playback = createEndlessPlayback({
        modes: ["library"],
        defaultMode: "library",
        propType: currentPropType,
        spinnerOrchestrator: spinnerOrch,
        infiniteGenerator: noopInfinite,
        playbackController: pc,
      });

      await playback.initialize();
      animationReady = true;
    } catch (err) {
      console.error("[PlayWithIt] Failed to load animation:", err);
      animationError = true;
    }
  });

  onDestroy(() => {
    playback?.dispose();
  });

  // ── Prop switching (AnimationPanel Props section) ───────────────────────────
  function handlePropChange(newProp: PropType) {
    if (newProp === currentPropType) return;
    currentPropType = newProp;
    playback?.setPropType(newProp);

    // Hot-swap prop in the running animation
    const animState = playback?.animationState;
    if (animState?.sequenceData) {
      const updated = propTypeApplier.applyToSequence(
        animState.sequenceData,
        newProp
      );
      animState.setSequenceData(updated);
    }
  }

  // ── Play / Pause (AnimationPanel Effects section transport) ─────────────────
  function togglePlayPause() {
    if (!playback?.playbackController) return;
    playback.playbackController.togglePlayback();
  }

  // ── BPM control ─────────────────────────────────────────────────────────────
  function handleBpmChange(newBpm: number) {
    bpm = newBpm;
    scope.settings.setBpm(newBpm);
  }

  // ── Notation panel cells ──────────────────────────────────────────────────
  let notationCells = $derived<NotationCell[]>(
    buildNotationCells(playback?.animationState?.sequenceData)
  );

</script>

<!-- Beat strip: one definition shared by both layouts. Lives inside the stage
     column on mobile (under the canvas, above the dock) and full-width below
     the stage row on desktop so the whole sequence is visible without scroll. -->
{#snippet beatStripBlock()}
  {#if playback?.animationState?.sequenceData && notationCells.length > 0}
    <BeatStrip
      cells={notationCells}
      currentStep={playback?.animationState?.currentStep ?? 0}
      {bpm}
      bluePropType={currentPropType}
      redPropType={currentPropType}
    />
  {/if}
{/snippet}

<div class="play-inner">
  <!-- Unified showcase: stage row (canvas + AnimationPanel sidebar on desktop,
       ControlDock bottom bar on mobile) with a full-width beat strip below. -->
  <div class="showcase" class:with-sidebar={isDesktopLayout}>
    <div class="stage-row">
      <div class="stage-column">
        <div class="canvas-area">
          {#if animationReady}
            <div class="canvas-wrapper">
              <AnimatorCanvas
                blueProp={playback?.animationState?.bluePropState ?? null}
                redProp={playback?.animationState?.redPropState ?? null}
                gridVisible={true}
                gridMode={playback?.gridMode ?? null}
                letter={playback?.currentLetter ?? null}
                stepData={playback?.currentStepData}
                sequenceData={playback?.animationState?.sequenceData}
                currentStep={playback?.animationState?.currentStep ?? 0}
                isPlaying={isPlaying}
                trailSettings={scope.settings.trail}
                bluePropType={currentPropType}
                redPropType={currentPropType}
                word={playback?.animationState?.sequenceData?.intendedWord ?? playback?.animationState?.sequenceData?.word ?? null}
                previewDarkMode={true}
                visibilityManagerOverride={visibilityManager}
                effectsConfigState={effectsConfigState}
                onPlaybackToggle={togglePlayPause}
                tapToToggle={true}
                progressLine={true}
              />
            </div>
          {:else if animationError}
            <div class="canvas-placeholder">
              <div class="placeholder-icon">🌀</div>
              <span>Animation preview unavailable</span>
            </div>
          {:else}
            <div class="canvas-placeholder">
              <ProgressRing percent={-1} size={32} strokeWidth={3} />
              <span>Initializing...</span>
            </div>
          {/if}
        </div>

        <!-- Mobile: strip under the canvas, then the ControlDock bottom bar -->
        {#if !isDesktopLayout}
          {@render beatStripBlock()}
          <AnimationPanel
            isExporting={false}
            canvasReady={animationReady}
            layout="bottom"
            {bpm}
            {isPlaying}
            renderMode="2d"
            selectedPropType={currentPropType}
            onPropChange={handlePropChange}
            onBpmChange={handleBpmChange}
            onPlaybackToggle={togglePlayPause}
            showMotionVisibility={true}
          />
        {/if}
      </div>

      {#if isDesktopLayout}
        <div class="panel-slot">
          <AnimationPanel
            isExporting={false}
            canvasReady={animationReady}
            layout="sidebar"
            {bpm}
            {isPlaying}
            renderMode="2d"
            selectedPropType={currentPropType}
            onPropChange={handlePropChange}
            onBpmChange={handleBpmChange}
            onPlaybackToggle={togglePlayPause}
            showMotionVisibility={true}
          />
        </div>
      {/if}
    </div>

    <!-- Desktop: full-width strip spanning canvas + panel below the stage row -->
    {#if isDesktopLayout}
      {@render beatStripBlock()}
    {/if}
  </div>
</div>

<style>
  .play-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    width: 100%;
  }

  /* ── Showcase: framed container ──────────────────────────────────────────── */
  .showcase {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.35);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* Desktop: the showcase stays a column so the beat strip can sit full-width
     below the stage row. Scales with the viewport on large/4K displays instead
     of pinning to a narrow cap (the old 1140px left the spinner cramped and
     clipped the props sidebar under .showcase's overflow:hidden). */
  .showcase.with-sidebar {
    max-width: min(1600px, 94vw);
  }

  /* Stage row holds the spinner + the AnimationPanel sidebar side by side.
     On mobile it collapses (display:contents) so the stage column flows
     directly in the showcase's column, preserving the bottom-dock layout. */
  .stage-row {
    display: contents;
  }
  .showcase.with-sidebar .stage-row {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    width: 100%;
  }

  .stage-column {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
  }

  .panel-slot {
    flex: 0 0 380px;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .canvas-area {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    /* Grow the spinner with the screen: as tall as 70% of the viewport, capped
       so it never gets absurd on ultra-tall displays. The square size also
       drives the showcase width (shrink-to-fit), so a bigger canvas widens the
       full-width beat strip below it too. */
    max-height: min(1100px, 70vh);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .canvas-wrapper {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .canvas-placeholder {
    width: 100%;
    height: 100%;
    min-height: 300px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
  }

  .placeholder-icon {
    font-size: 3rem;
    opacity: 0.4;
  }

  /* ── Responsive ────────────────────────────────────────────────────────── */
  @media (max-width: 600px) {
    /* Full-viewport fit: the showcase fills the height the section gives it, and
       the canvas-area flexes to take whatever the fixed-height beat strip +
       control dock leave — so the whole player lands on one screen. Dropping the
       forced square lets the canvas square to the available height instead of
       being width-locked and pushing the dock off-screen. */
    .play-inner {
      flex: 1 1 auto;
      min-height: 0;
      gap: 10px;
    }

    .showcase {
      flex: 1 1 auto;
      min-height: 0;
      max-width: 100%;
      border-radius: 12px;
    }

    .stage-column {
      min-height: 0;
    }

    .canvas-area {
      aspect-ratio: auto;
      flex: 1 1 auto;
      min-height: 0;
      max-height: none;
    }

    /* Absolutely fill the flexed area — a percentage-height chain collapses to 0
       once the square aspect-ratio is gone, so the AnimatorCanvas gets a definite
       box this way and the WebGL canvas actually sizes/renders. */
    .canvas-wrapper {
      position: absolute;
      inset: 0;
    }
  }

</style>
