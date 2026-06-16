<!--
AnimatorCanvas.svelte - Canvas2D Animation Canvas

================================================================================
ARCHITECTURAL NOTE
================================================================================

This component is a thin wrapper around AnimationEngine.

All orchestration logic has been extracted to:
  src/lib/shared/animation-engine/services/animation-engine.svelte.ts

The component's role:
1. Mount container element
2. Initialize engine
3. Pass props to engine.update() in single $effect
4. Derive state from engine.animatorState
5. Render template (canvas-wrapper, GlyphOverlay, ProgressOverlay)
6. Disassemble/reassemble: same DOM tree, CSS transitions only

Last audit: 2025-12-27
================================================================================
-->
<script lang="ts">
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { Letter } from "$lib/shared/foundation/domain/models/letter";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
  import type { TrailSettings } from "../domain/types/trail-types";
  import type { AdditionalLayerProps } from "$lib/shared/animation-engine/domain/types/trail-capture-types";
  import CanvasSurface from "./CanvasSurface.svelte";
  import WordHeader from "./layers/WordHeader.svelte";
  import UnifiedTimeline from "$lib/shared/timeline/UnifiedTimeline.svelte";
  import { createAnimatorPlaybackAdapter } from "$lib/shared/timeline/adapters/animator-playback-adapter.svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { AnimationEngine } from "../services/animation-engine.svelte";
  import { getAnimationVisibilityManager, type AnimationVisibilityStateManager } from "../state/animation-visibility-state.svelte";
  import { calculateDifficultyLevel as calculateSequenceDifficultyLevel } from "$lib/shared/browse/services/sequence-difficulty-calculator";
  import { tryGetLoopDisplayResolver } from "$lib/shared/loop-labeler/get-loop-display-resolver";
  import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import type { FireOverlayConfig } from "../domain/types/fire-types";
  import type { LedOverlayConfig } from "../domain/types/led-types";
  import type { TipEffectMap, TipEffortMap } from "../domain/types/tip-effect-types";
  import CanvasContextMenuHost from "./canvas-context-menu/CanvasContextMenuHost.svelte";
  import SplitCanvasView from "./SplitCanvasView.svelte";
  import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";

  // Props
  let {
    blueProp,
    redProp,
    additionalLayers = [],
    gridVisible = true,
    gridMode = GridMode.DIAMOND,
    backgroundAlpha = 1,
    letter = null,
    stepData = null,
    sequenceData = null,
    currentStep = 0,
    isPlaying = false,
    onCanvasReady = () => {},
    onPlaybackToggle = () => {},
    trailSettings: externalTrailSettings = $bindable(),
    bluePropType = null,
    redPropType = null,
    word = null,
    previewDarkMode = null,
    hideTkaGlyph = false,
    hideStepNumbers = false,
    hideProgressBar = false,
    hideHeader = false,
    isSeamlesslyLoopable = undefined,
    progressBarVariant = "gradient",
    onProgressBarSeek = null,
    onProgressBarScrubStart = null,
    onProgressBarScrubEnd = null,
    focused = false,
    fireConfig = undefined,
    ledConfig = undefined,
    tipEffectMap: cellTipEffectMap = undefined,
    tipEffortMap: cellTipEffortMap = undefined,
    disableContextMenu = false,
    fillContainer = false,
    showNonRadialPoints = true,
    resizePaused = false,
    onInitialized: onInitializedCallback = undefined,
    onEffectError = undefined,
    visibilityManagerOverride = undefined,
    effectsConfigState = undefined,
    externalToggleDisassemble = undefined,
    externalDisassembled = false,
    suppress2DOverlays = false,
    virtualTime = undefined,
    onToggle3DView = undefined,
    contextId = undefined,
    tapToToggle = false,
  }: {
    blueProp: PropState | null;
    redProp: PropState | null;
    additionalLayers?: AdditionalLayerProps[];
    gridVisible?: boolean;
    gridMode?: GridMode | null;
    backgroundAlpha?: number;
    letter?: Letter | null;
    stepData?: StartPositionData | StepData | null;
    sequenceData?: SequenceData | null;
    currentStep?: number;
    isPlaying?: boolean;
    onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
    onPlaybackToggle?: () => void;
    trailSettings?: TrailSettings;
    bluePropType?: string | null;
    redPropType?: string | null;
    word?: string | null;
    previewDarkMode?: boolean | null;
    hideTkaGlyph?: boolean;
    hideStepNumbers?: boolean;
    hideProgressBar?: boolean;
    /** Hide the WordHeader slot (portrait-mobile reclaims this vertical space). */
    hideHeader?: boolean;
    isSeamlesslyLoopable?: boolean;
    progressBarVariant?: "minimal" | "raised" | "rounded" | "neon" | "gradient" | "labeled" | "gradient-labeled";
    onProgressBarSeek?: ((targetStep: number) => void) | null;
    onProgressBarScrubStart?: (() => void) | null;
    onProgressBarScrubEnd?: (() => void) | null;
    focused?: boolean;
    fireConfig?: Partial<FireOverlayConfig>;
    ledConfig?: Partial<LedOverlayConfig>;
    /** Per-cell tip effect map that overrides the global map */
    tipEffectMap?: TipEffectMap;
    /** Per-cell tip effort map that overrides the global map */
    tipEffortMap?: TipEffortMap;
    disableContextMenu?: boolean;
    fillContainer?: boolean;
    showNonRadialPoints?: boolean;
    /** When true, the engine's ResizeObserver is paused to prevent canvas buffer clears during CSS transitions */
    resizePaused?: boolean;
    /** Fires when the canvas engine has initialized and rendered its first frame */
    onInitialized?: () => void;
    /** Called when an effect (fire/charcoal/LED) fails repeatedly and is auto-disabled */
    onEffectError?: (effectName: string, error: Error) => void;
    /** Per-instance visibility manager. When provided, this canvas uses its own
     * manager instead of the global singleton. Enables multiple canvases to have
     * independent visibility/effect settings (e.g. landing page with two players). */
    visibilityManagerOverride?: AnimationVisibilityStateManager;
    /** Live EffectsConfigState (single source of truth for per-effect intents -
     *  zap, sparkles, motion, bloom today; fire/led/charcoal in later phases).
     *  The engine reads from this each frame to pick up slider changes from
     *  the Customize panels without touching the visibility manager. */
    effectsConfigState?: EffectsConfigState;
    /** When provided, overrides the internal disassemble toggle for the context menu.
     * The context menu will call this callback instead of the built-in split animation. */
    externalToggleDisassemble?: () => void;
    /** When provided alongside externalToggleDisassemble, controls the context menu label
     * ("Disassemble" vs "Reassemble"). Defaults to false. */
    externalDisassembled?: boolean;
    /** When true, 2D effect overlays (fire/charcoal/LED/trails) are hidden - 3D mode handles effects */
    suppress2DOverlays?: boolean;
    /** Virtual time for this frame (in ms). Used during video export. */
    virtualTime?: number;
    onToggle3DView?: () => void;
    contextId?: string;
    /** When true, a quick tap on the canvas body toggles play/pause and flashes
     *  a transient play/pause icon. Off by default so views with their own tap
     *  semantics are unaffected. */
    tapToToggle?: boolean;
  } = $props();

  const resolvedContextId = contextId ?? `canvas-${Math.random().toString(36).slice(2, 8)}`;

  const playbackAdapter = createAnimatorPlaybackAdapter({
    getCurrentStep: () => currentStep,
    getSteps: () => sequenceData?.steps ?? [],
    getIsPlaying: () => isPlaying,
    onSeek: (targetStep) => onProgressBarSeek?.(targetStep),
    onTogglePlay: () => onPlaybackToggle(),
  });

  // Disassemble mode state machine
  // assembled → disassembling → disassembled → reassembling → assembled
  // All transitions happen via CSS on the SAME DOM tree. No overlay swaps.
  type ViewState = "assembled" | "disassembling" | "disassembled" | "reassembling";
  let viewState = $state<ViewState>("assembled");
  let contentWrapperEl: HTMLDivElement | undefined = $state();
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressFired = false;
  let pointerStart: { x: number; y: number; t: number } | null = null;
  let tapFeedbackSeq = 0;
  let tapFeedback = $state<{ icon: "play" | "pause"; key: number } | null>(null);
  let tapFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  const isDisassembledView = $derived(viewState !== "assembled");
  // Mount the split view in the DOM for all non-assembled states.
  const showSplitCanvases = $derived(viewState !== "assembled");
  // Ask the split view to be expanded while disassembling/disassembled; collapse
  // while reassembling. The split view gates the actual expand on its own
  // engines being ready first.
  const splitExpandRequested = $derived(viewState === "disassembling" || viewState === "disassembled");
  // Pause split canvas resize during transitions - only allow resize in the
  // settled "disassembled" state.
  const splitResizePaused = $derived(viewState !== "disassembled");

  function toggleDisassemble() {
    if (viewState === "assembled") {
      // Pause ResizeObserver so the CSS width transition doesn't clear the canvas buffer
      engine?.pauseResize();
      viewState = "disassembling";
      // The split view mounts collapsed and fires onBothReady when its engines render.
    } else if (viewState === "disassembled") {
      // Pause ResizeObserver before CSS width transition back to full size
      engine?.pauseResize();
      // Collapse the split view (splitExpandRequested flips false); remove it when
      // its collapse transition ends (onCollapseComplete).
      viewState = "reassembling";
    }
    // Ignore during active transitions
  }

  // The split view finished its expand (open) transition: settle into the
  // disassembled state and resume the hero engine's ResizeObserver so it catches
  // up to the new (narrower) container size.
  function handleSplitExpandComplete() {
    if (viewState === "disassembling") {
      viewState = "disassembled";
      engine?.resumeResize();
    }
  }

  // The split view finished its collapse (close) transition: settle back to
  // assembled (which unmounts the split view) and resume the hero engine's
  // ResizeObserver so it catches up to the restored full-width container.
  function handleSplitCollapseComplete() {
    if (viewState === "reassembling") {
      viewState = "assembled";
      engine?.resumeResize();
    }
  }

  function handlePointerDown(e: PointerEvent) {
    pointerStart = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    longPressFired = false;
    if (e.button !== 0 || e.pointerType === "mouse" || disableContextMenu) return;
    const x = e.clientX;
    const y = e.clientY;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      longPressFired = true;
      contextMenuHost?.openContextMenu(x, y);
    }, 500);
  }

  function handlePointerMove(e: PointerEvent) {
    cancelLongPress();
    if (pointerStart) {
      const dx = e.clientX - pointerStart.x;
      const dy = e.clientY - pointerStart.y;
      if (dx * dx + dy * dy > 100) pointerStart = null; // moved >10px → not a tap
    }
  }

  function handlePointerUp(e: PointerEvent) {
    cancelLongPress();
    if (!tapToToggle || longPressFired || !pointerStart) {
      pointerStart = null;
      return;
    }
    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;
    const elapsed = e.timeStamp - pointerStart.t;
    pointerStart = null;
    if (dx * dx + dy * dy > 100 || elapsed > 500) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'button, a, [role="slider"], [role="menu"], [role="menuitem"], .unified-timeline, input',
      )
    )
      return;
    onPlaybackToggle();
    showTapFeedback(!isPlaying);
  }

  function showTapFeedback(willPlay: boolean) {
    getHapticFeedback().impact("light");
    tapFeedback = { icon: willPlay ? "play" : "pause", key: ++tapFeedbackSeq };
    if (tapFeedbackTimer !== null) clearTimeout(tapFeedbackTimer);
    tapFeedbackTimer = setTimeout(() => {
      tapFeedback = null;
      tapFeedbackTimer = null;
    }, 600);
  }

  function cancelLongPress() {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  // Unmount cleanup so the long-press and tap-feedback timeouts can't fire
  // (and touch state or the context-menu host) after the component is gone.
  $effect(() => {
    return () => {
      cancelLongPress();
      if (tapFeedbackTimer !== null) {
        clearTimeout(tapFeedbackTimer);
        tapFeedbackTimer = null;
      }
    };
  });

  let contextMenuHost: CanvasContextMenuHost | undefined = $state();

  // Engine instance - created and owned by the CanvasSurface leaf, bound back
  // here so the disassemble transition can drive pauseResize/resumeResize and
  // the context menu can read effect diagnostics. Undefined until the leaf mounts.
  let engine = $state<AnimationEngine>();

  // Use $derived to read visibilityManagerOverride reactively (avoids state_referenced_locally)
  const visibilityManager = $derived(visibilityManagerOverride ?? getAnimationVisibilityManager());

  // Initialize visibility state via $effect.pre to avoid state_referenced_locally on visibilityManager
  let tkaGlyphVisible = $state(false);
  let stepNumbersVisible = $state(false);
  let beatPositionVisible = $state(false);
  let globalDarkMode = $state(false);
  let wordHeaderVisible = $state(false);
  let progressBarVisible = $state(false);
  let pathLinesVisible = $state(false);
  $effect.pre(() => {
    tkaGlyphVisible = visibilityManager.getVisibility("tkaGlyph");
    stepNumbersVisible = visibilityManager.getVisibility("stepNumbers");
    beatPositionVisible = visibilityManager.getVisibility("beatPosition");
    globalDarkMode = visibilityManager.isDarkMode();
    wordHeaderVisible = visibilityManager.getVisibility("wordHeader");
    progressBarVisible = visibilityManager.getVisibility("progressBar");
    pathLinesVisible = visibilityManager.getVisibility("pathLines");
  });

  const darkModeEnabled = $derived(
    previewDarkMode !== null ? previewDarkMode : globalDarkMode
  );

  const effectiveTkaGlyphVisible = $derived(tkaGlyphVisible && !hideTkaGlyph);
  const effectiveBeatNumbersVisible = $derived(stepNumbersVisible && !hideStepNumbers);
  const effectiveStepPositionVisible = $derived(beatPositionVisible);

  function handleVisibilityChange() {
    tkaGlyphVisible = visibilityManager.getVisibility("tkaGlyph");
    stepNumbersVisible = visibilityManager.getVisibility("stepNumbers");
    beatPositionVisible = visibilityManager.getVisibility("beatPosition");
    globalDarkMode = visibilityManager.isDarkMode();
    wordHeaderVisible = visibilityManager.getVisibility("wordHeader");
    progressBarVisible = visibilityManager.getVisibility("progressBar");
    pathLinesVisible = visibilityManager.getVisibility("pathLines");
  }

  // Register/unregister observer reactively so visibilityManager is tracked
  $effect(() => {
    const mgr = visibilityManager;
    mgr.registerObserver(handleVisibilityChange);
    return () => {
      mgr.unregisterObserver(handleVisibilityChange);
    };
  });

  // Difficulty level from sequence data
  const computedDifficultyLevel = $derived.by(() => {
    if (!sequenceData?.steps?.length) return null;
    return calculateSequenceDifficultyLevel([...sequenceData.steps]);
  });

  // Shared resolver: same components + slice-aware rotation as every other
  // LOOP badge surface, cached by sequence id.
  const emptyLoopDisplay = {
    components: new Set<LOOPComponent>(),
    rotationPeriod: undefined as
      | import("$lib/shared/foundation/domain/models/generation/circular-models").Period
      | undefined,
    inversionPeriod: undefined as
      | import("$lib/shared/foundation/domain/models/generation/circular-models").Period
      | undefined,
    period: 1,
  };
  const loopDisplay = $derived.by(() => {
    if (!sequenceData) return emptyLoopDisplay;
    const resolver = tryGetLoopDisplayResolver();
    return resolver ? resolver(sequenceData) : emptyLoopDisplay;
  });
  const computedLoopComponents = $derived(
    loopDisplay.components.size > 0 ? loopDisplay.components : null
  );
  const computedRotationPeriod = $derived(loopDisplay.rotationPeriod);
  const computedInversionPeriod = $derived(loopDisplay.inversionPeriod);

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenuHost?.openContextMenu(e.clientX, e.clientY);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="animation-container"
  data-focused={focused || undefined}
  data-fill={fillContainer || undefined}
  data-no-progress={hideProgressBar || undefined}
  data-hide-header={hideHeader || undefined}
  data-view={viewState}
  oncontextmenu={handleContextMenu}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={cancelLongPress}
>
  <div class="content-wrapper" bind:this={contentWrapperEl} data-dark-mode={darkModeEnabled ? "true" : "false"}>
    <!-- Always mounted so 3D→2D flips don't re-mount the header. -->
    <div class="header-slot">
      <WordHeader
        {word}
        visible={wordHeaderVisible}
        darkMode={darkModeEnabled}
        activeStepNumber={currentStep >= 1 && currentStep < (sequenceData?.steps?.length ?? 0) + 0.99 ? Math.floor(currentStep) : null}
        difficultyLevel={computedDifficultyLevel}
        loopComponents={computedLoopComponents}
        rotationPeriod={computedRotationPeriod}
        inversionPeriod={computedInversionPeriod}
      />
    </div>

    <CanvasSurface
      bind:engine
      {blueProp}
      {redProp}
      {additionalLayers}
      {gridVisible}
      {gridMode}
      {backgroundAlpha}
      {letter}
      {stepData}
      {sequenceData}
      {currentStep}
      {isPlaying}
      bind:trailSettings={externalTrailSettings}
      {bluePropType}
      {redPropType}
      {previewDarkMode}
      {isSeamlesslyLoopable}
      {showNonRadialPoints}
      {fireConfig}
      {ledConfig}
      tipEffectMap={cellTipEffectMap}
      tipEffortMap={cellTipEffortMap}
      {virtualTime}
      {hideTkaGlyph}
      {hideStepNumbers}
      {darkModeEnabled}
      {effectiveTkaGlyphVisible}
      {effectiveBeatNumbersVisible}
      {effectiveStepPositionVisible}
      {pathLinesVisible}
      {suppress2DOverlays}
      {resizePaused}
      visibilityManagerOverride={visibilityManagerOverride}
      {effectsConfigState}
      contextId={resolvedContextId}
      {onCanvasReady}
      onInitialized={onInitializedCallback}
      {onEffectError}
    />

    <!-- Split canvases: blue-only and red-only, expand below hero during disassemble.
         Rendered via SplitCanvasView (CanvasSurface leaves) - never a self-import. -->
    {#if showSplitCanvases}
      <SplitCanvasView
        {blueProp}
        {redProp}
        {gridVisible}
        {gridMode}
        {letter}
        {stepData}
        {sequenceData}
        {currentStep}
        {isPlaying}
        {fireConfig}
        {ledConfig}
        {darkModeEnabled}
        expandRequested={splitExpandRequested}
        resizePaused={splitResizePaused}
        onExpandComplete={handleSplitExpandComplete}
        onCollapseComplete={handleSplitCollapseComplete}
      />
    {/if}

    <!-- Always mounted, same reason as header-slot above. -->
    <div class="progress-slot">
      <UnifiedTimeline
        playback={playbackAdapter}
        visible={progressBarVisible && !hideProgressBar}
      />
    </div>
  </div>

  {#if tapFeedback}
    {#key tapFeedback.key}
      <div class="tap-feedback" aria-hidden="true">
        <i class="fas {tapFeedback.icon === 'play' ? 'fa-play' : 'fa-pause'}"></i>
      </div>
    {/key}
  {/if}

  {#if !disableContextMenu}
    <CanvasContextMenuHost
      bind:this={contextMenuHost}
      disassembled={externalToggleDisassemble ? externalDisassembled : isDisassembledView}
      onToggleDisassemble={externalToggleDisassemble ?? toggleDisassemble}
      captureEffectDiagnostics={() => engine?.captureEffectDiagnostics() ?? {}}
      {onToggle3DView}
    />
  {/if}
</div>

<style>
  /* Outer container: centers content, establishes container query context */
  .animation-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    container-type: size;
    position: relative;
  }

  /* Transient play/pause flash on canvas tap — teaches the tap-to-toggle gesture
     the way video players do (icon pops, then fades). pointer-events:none so it
     never eats the next tap. */
  .tap-feedback {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 6;
  }

  .tap-feedback i {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 84px;
    height: 84px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(4px);
    color: rgba(255, 255, 255, 0.95);
    font-size: 36px;
    animation: tapFeedbackPop 600ms cubic-bezier(0.2, 0, 0, 1) forwards;
  }

  @keyframes tapFeedbackPop {
    0% {
      opacity: 0;
      transform: scale(0.6);
    }
    25% {
      opacity: 1;
      transform: scale(1);
    }
    100% {
      opacity: 0;
      transform: scale(1.3);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tap-feedback i {
      animation-duration: 250ms;
    }
  }

  /* ===========================================
     PORTRAIT MODE (default): Vertical stack
     [Header]
     [Square Canvas]
     [Split Canvases - only when disassembled]
     [Progress Bar]
     =========================================== */

  .content-wrapper {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    /*
     * Portrait mode: Width = canvas side = min(container_width, container_height - overhead)
     * Overhead: header (~53px) + pill timeline (~60px) + margin (12px) = ~125px
     * Use 8.5rem (136px) for breathing room
     */
    width: min(calc(100cqw - 12px), calc(100cqh - 8.5rem - 12px));
    max-width: calc(100cqh - 8.5rem);
    /* Container query context for header font scaling */
    container-type: inline-size;
    border-radius: 4px;
    overflow: hidden;
  }

  /* When the progress bar is relocated out of the canvas (e.g. mobile split,
     where the transport lives in its own bar below the choreo card), the
     8.5rem reservation above over-reserves by the height of an absent pill.
     Reclaim it in portrait so the square canvas grows to fill the pane.
     Overhead drops to header (~3.3rem) + breathing room. */
  @container (max-aspect-ratio: 1.15) {
    .animation-container[data-no-progress] .content-wrapper {
      width: min(calc(100cqw - 12px), calc(100cqh - 3.5rem - 12px));
      max-width: calc(100cqh - 3.5rem);
    }
  }

  /* Header slot: in portrait, takes natural height at top */
  .header-slot {
    flex-shrink: 0;
    overflow: hidden;
    max-height: 100px;
    opacity: 1;
  }

  /* Base .canvas-wrapper styling lives in CanvasSurface.svelte (the leaf that
     owns the element). The responsive overrides below reach into it via
     :global() because component-scoped selectors don't cross the component
     boundary. */

  /* ===========================================
     SPLIT CANVASES container sizing.
     The split-row visuals (.split-canvases / .split-canvas + their
     max-height/opacity transition) now live in SplitCanvasView.svelte.
     AnimatorCanvas only adjusts the hero content-wrapper to make room.
     =========================================== */

  /* When split canvases are showing, narrow the content-wrapper so the taller
     layout (hero + split row) fits vertically. The 2:3 aspect ratio means
     width = (available_height - chrome) * 2/3 */
  .animation-container[data-view="disassembling"] .content-wrapper,
  .animation-container[data-view="disassembled"] .content-wrapper {
    width: min(calc(100cqw - 12px), calc((100cqh - 7rem) * 2 / 3));
    max-width: calc((100cqh - 7rem) * 2 / 3);
    transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                max-width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* Progress slot: in portrait, takes natural height at bottom */
  .progress-slot {
    flex-shrink: 0;
    overflow: hidden;
    max-height: 100px;
    opacity: 1;
    transition: max-height 0.3s cubic-bezier(0.32, 0.72, 0, 1),
                opacity 0.2s ease-out;
  }

  /* ===========================================
     CONSTRAINED MODE: Canvas-only when squeezed
     When container is wider than tall (aspect ratio > 1.15),
     hide chrome and maximize the square canvas.
     =========================================== */

  @container (min-aspect-ratio: 1.15) {
    .content-wrapper {
      width: calc(100cqh - 2.5rem);
      max-width: calc(100cqh - 2.5rem);
      height: auto;
    }

    /* No in-canvas progress bar (relocated transport): the 2.5rem here was
       breathing room above an absent pill. Header is already hidden in this
       branch, so drop nearly all the overhead and let the square grow to the
       pane's full height. */
    .animation-container[data-no-progress] .content-wrapper {
      width: calc(100cqh - 1rem);
      max-width: calc(100cqh - 1rem);
    }

    .header-slot {
      max-height: 0;
      opacity: 0;
    }

    :global(.canvas-wrapper) {
      width: 100%;
      height: 100cqw;
    }
  }

  /* ===========================================
     FOCUSED MODE: Always show word + progress bar
     =========================================== */

  .animation-container[data-focused] .content-wrapper {
    width: min(calc(100cqw - 12px), calc(100cqh - 8.5rem - 12px));
    max-width: calc(100cqh - 8.5rem);
    max-height: calc(100cqh - 4px);
    height: auto;
  }

  .animation-container[data-focused] .header-slot {
    max-height: 100px !important;
    opacity: 1 !important;
  }

  /* Explicit hide wins over the focused force-show (higher specificity). Used in
     portrait-mobile to reclaim the word-header band for the canvas. */
  .animation-container[data-hide-header] .header-slot,
  .animation-container[data-focused][data-hide-header] .header-slot {
    max-height: 0 !important;
    opacity: 0 !important;
    pointer-events: none;
  }

  /* Header hidden AND transport relocated: let the square canvas claim almost
     the whole pane height. */
  .animation-container[data-focused][data-hide-header][data-no-progress] .content-wrapper {
    width: min(calc(100cqw - 12px), calc(100cqh - 1rem));
    max-width: calc(100cqh - 1rem);
    max-height: calc(100cqh - 4px);
  }

  .animation-container[data-focused] :global(.canvas-wrapper) {
    width: 100%;
    height: 100cqw;
    flex-shrink: 1;
    min-height: 0;
  }

  /* Focused + constrained: when container is wider than tall (e.g. mobile
     video export with settings open), reduce chrome overhead so the square
     canvas can use more of the limited height. */
  @container (min-aspect-ratio: 1.15) {
    .animation-container[data-focused] .content-wrapper {
      width: min(calc(100cqw - 12px), calc(100cqh - 3.5rem - 12px));
      max-width: calc(100cqh - 3.5rem);
    }
  }

  /* Only crush the header on extremely wide containers (mobile landscape)
     where vertical space is truly scarce. The 1.15 threshold was too aggressive
     and smushed the word header on desktop export mode. */
  @container (min-aspect-ratio: 2.5) {
    .animation-container[data-focused] .header-slot {
      max-height: 28px !important;
    }
  }

  /* Focused + disassembled: content-wrapper narrows for the split row */
  .animation-container[data-focused][data-view="disassembling"] .content-wrapper,
  .animation-container[data-focused][data-view="disassembled"] .content-wrapper {
    width: min(calc(100cqw - 12px), calc((100cqh - 8.5rem) * 2 / 3));
    max-width: calc((100cqh - 8.5rem) * 2 / 3);
    transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                max-width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* ===========================================
     EXTREMELY CONSTRAINED: Minimal chrome
     =========================================== */

  @container (min-aspect-ratio: 2.5) {
    .content-wrapper {
      border-radius: 0;
    }
  }

  /* ===========================================
     FILL CONTAINER MODE: Edge-to-edge rendering
     Used by sub-canvases in split view.
     =========================================== */

  .animation-container[data-fill] {
    align-items: stretch;
    justify-content: stretch;
  }

  .animation-container[data-fill] .content-wrapper {
    width: 100% !important;
    max-width: none !important;
    max-height: none !important;
    height: 100%;
    container-type: size;
  }

  .animation-container[data-fill] :global(.canvas-wrapper) {
    flex: 1;
    height: auto !important;
    min-height: 0;
  }

  /* ===========================================
     REDUCED MOTION
     =========================================== */

  @media (prefers-reduced-motion: reduce) {
    .content-wrapper,
    .header-slot,
    .progress-slot {
      transition: none;
    }
  }
</style>
