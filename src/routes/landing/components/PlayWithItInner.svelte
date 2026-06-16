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
  import {
    animationSettings,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { setAnimationVisibilityContext } from "$lib/shared/animation-engine/state/animation-visibility-context";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { createStartPositionFromBeatStart } from "$lib/shared/create/services/sequence-transforms";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  // ── Factory state ──────────────────────────────────────────────────────────
  let playback = $state<EndlessPlaybackState | null>(null);
  let animationReady = $state(false);
  let animationError = $state(false);

  // Prop state
  let currentPropType = $state<PropType>(PropType.STAFF);

  // Per-instance visibility manager so this player's effect/dark-mode settings
  // don't conflict with other AnimatorCanvas instances on the same page.
  // Ephemeral: no localStorage persistence, no global dark-class sync.
  // Exposed via context so the AnimationPanel sections (Effort/Display/Paths)
  // drive THIS instance instead of the global singleton.
  const visibilityManager = setAnimationVisibilityContext(
    new AnimationVisibilityStateManager({ ephemeral: true })
  );

  // Section-scoped effects state: the panel's Effects section and the canvas
  // engine share this one instance through context + the canvas prop.
  const effectsConfigState = setEffectsConfigContext(createEffectsConfigState());
  visibilityManager.effectsConfigState = effectsConfigState;

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
      animationSettings.setTrackingMode(TrackingMode.BOTH_ENDS);
      // Set landing-page default BPM (60 feels comfortable for visitors)
      animationSettings.setBpm(bpm);

      // Dark mode on for visual impact
      visibilityManager.setDarkMode(true);
      // Trails on by default
      effectsConfigState.setActiveEffect("trails");

      const browseLoader = getBrowseLoader();
      const pc = createAnimationPlaybackController();

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
    animationSettings.setBpm(newBpm);
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

  // Auto-scroll beat strip to keep active beat visible
  let beatStripEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!beatStripEl || !playback?.animationState?.isPlaying) return;
    const activeCell = beatStripEl.querySelector('.beat-cell.active') as HTMLElement | null;
    if (activeCell) {
      activeCell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  });

  // ── Beat strip virtualization ─────────────────────────────────────────────
  // Only render PictographContainers for cells that are actually visible in the
  // scrollable strip. Each cell is 72px wide with a 6px gap = 78px per slot.
  // We keep a 2-cell buffer on each side so pictographs are already rendered
  // when the user scrolls to them.
  const CELL_SIZE = 78; // 72px cell + 6px gap
  const BUFFER = 2;

  let stripScrollLeft = $state(0);
  let stripContainerWidth = $state(800);

  let visibleRange = $derived.by(() => {
    const start = Math.max(0, Math.floor(stripScrollLeft / CELL_SIZE) - BUFFER);
    const end = Math.min(
      notationCells.length,
      Math.ceil((stripScrollLeft + stripContainerWidth) / CELL_SIZE) + BUFFER
    );
    return { start, end };
  });

  // Wire scroll + resize tracking to the beat-strip element.
  $effect(() => {
    const el = beatStripEl;
    if (!el) return;

    // Capture initial dimensions
    stripContainerWidth = el.clientWidth;
    stripScrollLeft = el.scrollLeft;

    // Hoist to a typed non-nullable local so closures below see a non-null ref
    const strip: HTMLDivElement = el;

    function onScroll() {
      stripScrollLeft = strip.scrollLeft;
    }

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) stripContainerWidth = entry.contentRect.width;
    });

    strip.addEventListener('scroll', onScroll, { passive: true });
    ro.observe(strip);

    return () => {
      strip.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  });
</script>

<div class="play-inner">
  <!-- Unified showcase: canvas + beat strip, with the real AnimationPanel
       as a sidebar (desktop) or ControlDock bottom bar (mobile). -->
  <div class="showcase" class:with-sidebar={isDesktopLayout}>
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
              trailSettings={animationSettings.trail}
              bluePropType={currentPropType}
              redPropType={currentPropType}
              word={playback?.animationState?.sequenceData?.intendedWord ?? playback?.animationState?.sequenceData?.word ?? null}
              previewDarkMode={true}
              visibilityManagerOverride={visibilityManager}
              effectsConfigState={effectsConfigState}
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

      <!-- Beat strip below the canvas -->
      {#if playback?.animationState?.sequenceData && notationCells.length > 0}
        <div class="beat-strip" bind:this={beatStripEl}>
          {#each notationCells as cell, i (cell.key)}
            {@const isActive = isPlaying && (
              cell.isStart
                ? currentStepNumber === 0
                : currentStepNumber === cell.stepNumber
            )}
            {#if i >= visibleRange.start && i < visibleRange.end}
              <div class="beat-cell" class:active={isActive} class:start-cell={cell.isStart}>
                <div class="beat-pictograph">
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
      {/if}

      <!-- Mobile: the same panel as a ControlDock bottom bar inside the frame -->
      {#if !isDesktopLayout}
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
        />
      </div>
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

  /* Desktop: stage left, AnimationPanel sidebar right */
  .showcase.with-sidebar {
    flex-direction: row;
    align-items: stretch;
    max-width: 1140px;
  }

  .stage-column {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
  }

  .panel-slot {
    flex: 0 0 340px;
    max-width: 340px;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .canvas-area {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    max-height: 640px;
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

  /* ── Beat strip ────────────────────────────────────────────────────────── */
  .beat-strip {
    display: flex;
    gap: 6px;
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
  }

  .beat-strip::-webkit-scrollbar {
    height: 3px;
  }
  .beat-strip::-webkit-scrollbar-track {
    background: transparent;
  }
  .beat-strip::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 2px;
  }

  .beat-cell {
    flex: 0 0 72px;
    width: 72px;
    height: 72px;
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    overflow: hidden;
    scroll-snap-align: start;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .beat-cell.active {
    border-color: #d4813a;
    box-shadow: 0 0 10px rgba(212, 129, 58, 0.3);
  }

  .beat-cell.start-cell {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .beat-pictograph {
    width: 100%;
    height: 100%;
  }

  /* Off-screen placeholder: same dimensions as a real cell, no border or content.
     Keeps the scrollable width correct while the PictographContainer is unmounted. */
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

    .beat-cell {
      flex: 0 0 56px;
      width: 56px;
      height: 56px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .beat-cell {
      transition: none;
    }
  }
</style>
