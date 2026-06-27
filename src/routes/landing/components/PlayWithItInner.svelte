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
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
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
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { createStartPositionFromBeatStart } from "$lib/shared/create/services/sequence-transforms";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import SequenceProgressBar from "$lib/shared/animation-engine/components/layers/SequenceProgressBar.svelte";
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
  let currentStepNumber = $derived(Math.floor(playback?.animationState?.currentStep ?? 0));
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
  // Build an array of cells: start position (index 0) + each beat step.
  // Each cell carries the pictograph data and a display label.
  interface NotationCell {
    key: string;
    data: StepData | StartPositionData;
    label: string;
    isStart: boolean;
    stepNumber: number; // 0 for start, 1-N for beats
  }

  let notationCells = $derived.by((): NotationCell[] => {
    const seq = playback?.animationState?.sequenceData;
    if (!seq?.steps?.length) return [];

    const cells: NotationCell[] = [];

    // Start position cell
    const startPos = seq.startPosition ?? (seq.steps[0] ? createStartPositionFromBeatStart(seq.steps[0]) : null);
    if (startPos) {
      cells.push({
        key: `start-${seq.id ?? seq.word}`,
        data: startPos,
        label: "Start",
        isStart: true,
        stepNumber: 0,
      });
    }

    // Beat cells
    for (let i = 0; i < seq.steps.length; i++) {
      const step = seq.steps[i]!;
      cells.push({
        key: `beat-${i}-${step.letter ?? i}`,
        data: step,
        label: `${i + 1}`,
        isStart: false,
        stepNumber: i + 1,
      });
    }

    return cells;
  });

  // ── Beat strip: focus-locked playhead carousel ─────────────────────────────
  // Instead of paging a gold selection border across a static grid, we pin the
  // active pictograph under a single fixed gold focus frame centered in the
  // strip and slide the whole track left one cell per step. The selection never
  // moves; the sequence flows past it, so the eye never chases the highlight.
  const CELL = 72; // cell width/height (px) — uniform; drives the centering math
  const STRIDE = CELL + 6; // cell + 6px gap = per-slot advance
  const BUFFER = 3; // off-window cells kept rendered each side
  const HERO_SCALE = 1.32; // focused pictograph grows above baseline
  const FRAME = 98; // gold focus frame size (hugs the enlarged hero)

  let beatStripEl = $state<HTMLDivElement | null>(null);
  let stripContainerWidth = $state(800);

  // Active cell index === currentStepNumber: cell 0 is the start position
  // (step 0), beat i is step i. Clamp so an out-of-range step can't escape.
  let activeIndex = $derived(
    Math.min(Math.max(currentStepNumber, 0), Math.max(0, notationCells.length - 1))
  );

  // Track base offset (centers the 72px cell box) and the larger focus frame,
  // both centered on the same viewport midpoint.
  let focusLeft = $derived(stripContainerWidth / 2 - CELL / 2);
  let frameLeft = $derived(stripContainerWidth / 2 - FRAME / 2);

  // Only mount PictographContainers for the window around the active cell; the
  // rest are zero-content spacers so every cell still sits at index * STRIDE.
  let visibleRange = $derived.by(() => {
    const half = Math.ceil(stripContainerWidth / STRIDE / 2) + BUFFER;
    return {
      start: Math.max(0, activeIndex - half),
      end: Math.min(notationCells.length, activeIndex + half + 1),
    };
  });

  // Track translate + snap control. Slides smoothly forward step-by-step; snaps
  // (transition disabled for that update) when the sequence wraps back to the
  // start, so we don't get a long reverse sweep across the whole strip.
  let trackX = $state(0);
  let animateTrack = $state(false);
  let prevActiveIndex = -1;
  $effect(() => {
    const idx = activeIndex;
    const left = focusLeft;
    animateTrack = !(prevActiveIndex === -1 || idx < prevActiveIndex);
    prevActiveIndex = idx;
    trackX = left - idx * STRIDE;
  });

  // Slide duration tracks the beat interval so fast tempos get a shorter, less
  // visible travel (half a beat, clamped). One CSS var drives slide + fades.
  let slideDurMs = $derived(
    Math.round(Math.min(0.42, Math.max(0.12, (60 / Math.max(1, bpm)) * 0.5)) * 1000)
  );

  // Spotlight: the focused pictograph is the hero (HERO_SCALE); neighbors dim
  // and shrink with distance so the moving periphery stays quiet.
  function cellOpacity(dist: number) {
    if (dist === 0) return 1;
    return Math.max(0.14, 0.66 - (dist - 1) * 0.18);
  }
  function cellScale(dist: number) {
    if (dist === 0) return HERO_SCALE;
    return Math.max(0.62, 0.84 - (dist - 1) * 0.09);
  }

  // Measure the viewport width (drives centering + the virtualization window).
  $effect(() => {
    const el = beatStripEl;
    if (!el) return;
    stripContainerWidth = el.clientWidth;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) stripContainerWidth = entry.contentRect.width;
    });
    ro.observe(el);
    return () => ro.disconnect();
  });
</script>

<!-- Beat strip: one definition shared by both layouts. Lives inside the stage
     column on mobile (under the canvas, above the dock) and full-width below
     the stage row on desktop so the whole sequence is visible without scroll. -->
{#snippet beatStripBlock()}
  {#if playback?.animationState?.sequenceData && notationCells.length > 0}
    <div class="beat-viewport" bind:this={beatStripEl} style="--slide-dur: {slideDurMs}ms">
      <!-- Fixed gold focus frame: the active (hero) pictograph always lands here. -->
      <div class="beat-focus" style="left: {frameLeft}px"></div>
      <!-- Sliding track: translated so activeIndex sits under the focus frame. -->
      <div
        class="beat-track"
        class:no-anim={!animateTrack}
        style="transform: translateX({trackX}px)"
      >
        {#each notationCells as cell, i (cell.key)}
          {#if i >= visibleRange.start && i < visibleRange.end}
            {@const dist = Math.abs(i - activeIndex)}
            <div
              class="beat-cell"
              class:start-cell={cell.isStart}
              class:is-focus={dist === 0}
              style="opacity: {cellOpacity(dist)}"
            >
              <div class="beat-pictograph" style="transform: scale({cellScale(dist)})">
                <PictographContainer
                  pictographData={cell.data}
                  darkMode={true}
                  disableTransitions={true}
                  disableContentTransitions={true}
                  bluePropTypeOverride={currentPropType}
                  redPropTypeOverride={currentPropType}
                />
              </div>
            </div>
          {:else}
            <div class="beat-cell beat-cell-placeholder" aria-hidden="true"></div>
          {/if}
        {/each}
      </div>
    </div>
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
                hideProgressBar={true}
              />
              {#if playback?.animationState?.sequenceData?.steps?.length}
                <!-- Minimal export-style progress line: the same thin colored bar
                     baked into downloaded videos (no scrubber knob, no play button,
                     no per-beat notches). Play/pause is the canvas tap above. -->
                <div class="mini-progress">
                  <SequenceProgressBar
                    currentStep={playback?.animationState?.currentStep ?? 0}
                    totalSteps={playback.animationState.sequenceData.steps.length}
                    darkMode={true}
                  />
                </div>
              {/if}
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
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* Export-style progress line pinned to the very bottom of the canvas frame —
     the same thin colored bar baked into downloaded videos. Display-only
     (pointer-events off so the canvas tap-to-play still fires through it). */
  .mini-progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    pointer-events: none;
  }

  .mini-progress :global(.progress-bar-container) {
    background: transparent;
    padding: 0 10px 6px;
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

  /* ── Beat strip: focus-locked playhead carousel ─────────────────────────── */
  .beat-viewport {
    position: relative;
    width: 100%;
    height: 124px; /* headroom for the enlarged hero (98px frame) + breathing room */
    overflow: hidden;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
    /* Soft edges so cells dissolve at the borders instead of hard-cutting,
       which quiets the perceived motion churn at the periphery. */
    -webkit-mask-image: linear-gradient(
      to right,
      transparent 0,
      black 10%,
      black 90%,
      transparent 100%
    );
    mask-image: linear-gradient(
      to right,
      transparent 0,
      black 10%,
      black 90%,
      transparent 100%
    );
  }

  /* Sliding track. translateX is set inline; cell i sits at i * STRIDE (78px).
     Cells are vertically centered in the viewport so the hero can grow up/down. */
  .beat-track {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    will-change: transform;
    transition: transform var(--slide-dur, 420ms) cubic-bezier(0.4, 0, 0.2, 1);
  }
  .beat-track.no-anim {
    transition: none;
  }

  /* Fixed gold focus frame — the hero pictograph always lands under it. */
  .beat-focus {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 98px;
    height: 98px;
    border: 2px solid #d4813a;
    border-radius: 8px;
    box-shadow: 0 0 16px rgba(212, 129, 58, 0.5);
    pointer-events: none;
    z-index: 2;
    transition: left 0.2s ease;
  }

  .beat-cell {
    position: relative;
    flex: 0 0 72px;
    width: 72px;
    height: 72px;
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    overflow: hidden;
    /* opacity (spotlight) is set inline per distance-from-focus. */
    transition: opacity var(--slide-dur, 420ms) ease;
  }

  .beat-cell.start-cell {
    border-color: rgba(255, 255, 255, 0.15);
  }

  /* Hero cell: let the enlarged pictograph spill out of the 72px box and sit
     above its neighbors. Border is dropped — the gold frame is the highlight. */
  .beat-cell.is-focus {
    overflow: visible;
    border-color: transparent;
    z-index: 3;
  }

  .beat-pictograph {
    width: 100%;
    height: 100%;
    transform-origin: center;
    /* scale (spotlight) is set inline per distance-from-focus. */
    transition: transform var(--slide-dur, 420ms) ease;
  }

  /* Off-window spacer: same footprint, no border/content, holds index * STRIDE. */
  .beat-cell-placeholder {
    border-color: transparent;
    box-shadow: none;
    background: transparent;
    pointer-events: none;
  }

  /* ── Responsive ────────────────────────────────────────────────────────── */
  @media (max-width: 600px) {
    .showcase {
      max-width: 100%;
      border-radius: 12px;
    }

    .canvas-area {
      max-height: 400px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    /* No sliding/fading motion: the track jumps per step, cells hold full
       opacity/scale so nothing drifts in the periphery. */
    .beat-track,
    .beat-cell,
    .beat-pictograph {
      transition: none;
    }
  }
</style>
