<!--
AnimatorCanvas.svelte - Canvas2D Animation Canvas

================================================================================
ARCHITECTURAL NOTE
================================================================================

This component is a thin wrapper around AnimationEngine.

All orchestration logic has been extracted to:
  src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts

The component's role:
1. Mount container element
2. Initialize engine
3. Pass props to engine.update() in single $effect
4. Derive state from engine.state
5. Render template (canvas-wrapper, GlyphOverlay, ProgressOverlay)
6. Disassemble/reassemble: same DOM tree, CSS transitions only

Last audit: 2025-12-27
================================================================================
-->
<script lang="ts">
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { StartPositionData } from "../../../features/create/shared/domain/models/StartPositionData";
  import type { StepData } from "../../../features/create/shared/domain/models/StepData";
  import type { PropState } from "../domain/PropState";
  import type { TrailSettings } from "../domain/types/TrailTypes";
  import type { AdditionalLayerProps } from "$lib/features/compose/services/contracts/ITrailCapturer";
  import GlyphRenderer from "./GlyphRenderer.svelte";
  import GlyphOverlay from "./layers/GlyphOverlay.svelte";
  import WordHeader from "./layers/WordHeader.svelte";
  import ProgressOverlay from "./layers/ProgressOverlay.svelte";
  import SegmentedSequenceProgressBar from "./layers/SegmentedSequenceProgressBar.svelte";
  import { AnimationEngine } from "../services/implementations/AnimationEngine.svelte";
  import { getAnimationVisibilityManager, type AnimationVisibilityStateManager } from "../state/animation-visibility-state.svelte";
  import { sequenceLoopabilityChecker } from "$lib/features/compose/services/implementations/SequenceLoopabilityChecker";
  import type { FireOverlayConfig } from "../domain/types/FireTypes";
  import type { LedOverlayConfig } from "../domain/types/LedTypes";
  import type { TipEffectMap, TipEffortMap } from "../domain/types/TipEffectTypes";
  import CanvasContextMenuHost from "./canvas-context-menu/CanvasContextMenuHost.svelte";
  import AnimationSettingsModal from "./animation-settings-modal/AnimationSettingsModal.svelte";
  import { onDestroy, untrack } from "svelte";
  import { fireCacheInvalidation } from "../state/fire-invalidation-signal.svelte";
  import { effectErrorSignal } from "../state/effect-error-signal.svelte";
  import AnimatorCanvasSelf from "./AnimatorCanvas.svelte";

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
    isSeamlesslyLoopable = undefined,
    progressBarVariant = "gradient",
    onProgressBarSeek = null,
    focused = false,
    fireConfig = undefined,
    ledConfig = undefined,
    tipEffectMap: cellTipEffectMap = undefined,
    tipEffortMap: cellTipEffortMap = undefined,
    disableContextMenu = false,
    fillContainer = false,
    resizePaused = false,
    onInitialized: onInitializedCallback = undefined,
    onEffectError = undefined,
    visibilityManagerOverride = undefined,
    externalToggleDisassemble = undefined,
    externalDisassembled = false,
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
    isSeamlesslyLoopable?: boolean;
    progressBarVariant?: "minimal" | "raised" | "rounded" | "neon" | "gradient" | "labeled" | "gradient-labeled";
    onProgressBarSeek?: ((targetStep: number) => void) | null;
    focused?: boolean;
    fireConfig?: Partial<FireOverlayConfig>;
    ledConfig?: Partial<LedOverlayConfig>;
    /** Per-cell tip effect map that overrides the global map */
    tipEffectMap?: TipEffectMap;
    /** Per-cell tip effort map that overrides the global map */
    tipEffortMap?: TipEffortMap;
    disableContextMenu?: boolean;
    fillContainer?: boolean;
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
    /** When provided, overrides the internal disassemble toggle for the context menu.
     * The context menu will call this callback instead of the built-in split animation. */
    externalToggleDisassemble?: () => void;
    /** When provided alongside externalToggleDisassemble, controls the context menu label
     * ("Disassemble" vs "Reassemble"). Defaults to false. */
    externalDisassembled?: boolean;
  } = $props();

  // Disassemble mode state machine
  // assembled → disassembling → disassembled → reassembling → assembled
  // All transitions happen via CSS on the SAME DOM tree. No overlay swaps.
  type ViewState = "assembled" | "disassembling" | "disassembled" | "reassembling";
  let viewState = $state<ViewState>("assembled");
  let contentWrapperEl: HTMLDivElement | undefined = $state();
  let splitCanvasesEl: HTMLDivElement | undefined = $state();
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  // Mount split canvases collapsed, expand only after both engines are initialized
  let splitExpanded = $state(false);
  let splitReadyCount = $state(0);

  const isDisassembledView = $derived(viewState !== "assembled");
  // Show split canvases in DOM for all non-assembled states
  const showSplitCanvases = $derived(viewState !== "assembled");
  // Pause split canvas resize during transitions — only allow resize in settled "disassembled" state
  const splitResizePaused = $derived(viewState !== "disassembled");

  function handleSplitCanvasReady() {
    splitReadyCount++;
  }

  function toggleDisassemble() {
    if (viewState === "assembled") {
      splitReadyCount = 0;
      // Pause ResizeObserver so the CSS width transition doesn't clear the canvas buffer
      engine.pauseResize();
      viewState = "disassembling";
      // Split canvases mount collapsed. They'll fire onInitialized when ready.
    } else if (viewState === "disassembled") {
      // Pause ResizeObserver before CSS width transition back to full size
      engine.pauseResize();
      // Collapse split canvases, then remove them when transition ends
      splitExpanded = false;
      viewState = "reassembling";
    }
    // Ignore during active transitions
  }

  // Expand split canvases once both engines have initialized and rendered
  $effect(() => {
    if (viewState === "disassembling" && splitReadyCount >= 2) {
      // Both split canvases are initialized. Expand on next frame so the
      // browser has laid out the collapsed state first (CSS transition trigger).
      untrack(() => {
        requestAnimationFrame(() => {
          splitExpanded = true;
        });
      });
    }
  });

  // Listen for CSS transition end to finalize state changes
  function handleSplitTransitionEnd(e: TransitionEvent) {
    // Only react to max-height transitions on the split-canvases element itself
    if (e.target !== splitCanvasesEl || e.propertyName !== "max-height") return;

    if (viewState === "disassembling") {
      viewState = "disassembled";
      // Resume ResizeObserver — catch up to the new (narrower) container size
      engine.resumeResize();
    } else if (viewState === "reassembling") {
      viewState = "assembled";
      splitExpanded = false;
      // Resume ResizeObserver — catch up to the restored full-width container
      engine.resumeResize();
    }
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0 || e.pointerType === "mouse" || disableContextMenu) return;
    const x = e.clientX;
    const y = e.clientY;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      contextMenuHost?.openContextMenu(x, y);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  let containerElement: HTMLDivElement | undefined = $state();
  let contextMenuHost: CanvasContextMenuHost | undefined = $state();

  // Settings modal state
  let settingsModalOpen = $state(false);

  function handleOpenSettings() {
    settingsModalOpen = true;
  }

  // Engine instance — wire per-instance visibility manager before initialization
  const engine = new AnimationEngine();
  if (visibilityManagerOverride) {
    engine.setVisibilityManager(visibilityManagerOverride);
  }

  // Visibility manager — use per-instance override when provided
  const visibilityManager = visibilityManagerOverride ?? getAnimationVisibilityManager();

  let tkaGlyphVisible = $state(visibilityManager.getVisibility("tkaGlyph"));
  let stepNumbersVisible = $state(visibilityManager.getVisibility("stepNumbers"));
  let beatPositionVisible = $state(visibilityManager.getVisibility("beatPosition"));
  let globalDarkMode = $state(visibilityManager.isDarkMode());
  let wordHeaderVisible = $state(visibilityManager.getVisibility("wordHeader"));
  let progressBarVisible = $state(visibilityManager.getVisibility("progressBar"));
  let fireEffectEnabled = $state(visibilityManager.isFireEffectEnabled());

  const darkModeEnabled = $derived(
    previewDarkMode !== null ? previewDarkMode : globalDarkMode
  );

  const effectiveTkaGlyphVisible = $derived(tkaGlyphVisible && !hideTkaGlyph);
  const effectiveBeatNumbersVisible = $derived(stepNumbersVisible && !hideStepNumbers);
  const effectiveBeatPositionVisible = $derived(beatPositionVisible);

  const effectiveIsSeamlesslyLoopable = $derived.by(() => {
    if (isSeamlesslyLoopable !== undefined) return isSeamlesslyLoopable;
    if (!sequenceData) return false;
    return sequenceLoopabilityChecker.isSeamlesslyLoopable(sequenceData);
  });

  function handleVisibilityChange() {
    tkaGlyphVisible = visibilityManager.getVisibility("tkaGlyph");
    stepNumbersVisible = visibilityManager.getVisibility("stepNumbers");
    beatPositionVisible = visibilityManager.getVisibility("beatPosition");
    globalDarkMode = visibilityManager.isDarkMode();
    wordHeaderVisible = visibilityManager.getVisibility("wordHeader");
    progressBarVisible = visibilityManager.getVisibility("progressBar");
    fireEffectEnabled = visibilityManager.isFireEffectEnabled();
  }

  visibilityManager.registerObserver(handleVisibilityChange);

  onDestroy(() => {
    visibilityManager.unregisterObserver(handleVisibilityChange);
  });

  // When an external caller (e.g. video export orchestrator) signals that the
  // fire frame cache is stale, invalidate it so the simulation re-records.
  let lastFireInvalidationSignal = fireCacheInvalidation.signal;
  $effect(() => {
    const sig = fireCacheInvalidation.signal;
    if (sig !== lastFireInvalidationSignal) {
      lastFireInvalidationSignal = sig;
      untrack(() => engine.invalidateFireCache());
    }
  });

  // When an overlay effect (fire/charcoal/LED) fails repeatedly, the render loop
  // auto-disables it and fires this signal. Show a warning so the user knows.
  let lastEffectErrorSignal = effectErrorSignal.signal;
  $effect(() => {
    const sig = effectErrorSignal.signal;
    if (sig !== lastEffectErrorSignal) {
      lastEffectErrorSignal = sig;
      const name = effectErrorSignal.effectName;
      const err = effectErrorSignal.error;
      if (name && err) {
        console.warn(
          `[AnimatorCanvas] ${name} effect was auto-disabled after repeated failures. ` +
          `Toggle the effect off and on to retry. Error: ${err.message}`
        );
        effectErrorSignal.clear();
      }
    }
  });

  // Derived state from engine
  const rendererLoading = $derived(engine.state.rendererLoading);
  const rendererError = $derived(engine.state.rendererError);
  const isInitialized = $derived(engine.state.isInitialized);
  const isPreRendering = $derived(engine.state.isPreRendering);
  const preRenderProgress = $derived(engine.state.preRenderProgress);
  const preRenderedFramesReady = $derived(engine.state.preRenderedFramesReady);
  const displayedLetter = $derived(engine.state.displayedLetter);
  const displayedTurnsTuple = $derived(engine.state.displayedTurnsTuple);
  const displayedStepNumber = $derived(engine.state.displayedStepNumber);
  const displayedMusicalPosition = $derived(engine.state.displayedMusicalPosition);

  // Initialize engine when container element appears.
  // The hero canvas stays mounted always — no teardown during disassemble.
  $effect(() => {
    const el = containerElement;
    if (!el) return;

    untrack(() => {
      engine.initialize(el, {
        onCanvasReady,
        onTrailSettingsChange: (settings) => {
          externalTrailSettings = settings;
        },
        onEffectError,
      });
    });

    return () => {
      untrack(() => {
        engine.dispose();
      });
    };
  });

  // Single effect to pass all props to engine
  $effect(() => {
    const currentFireConfig = fireConfig;
    const currentLedConfig = ledConfig;
    const currentCellTipEffectMap = cellTipEffectMap;
    const currentCellTipEffortMap = cellTipEffortMap;
    const props = {
      blueProp,
      redProp,
      additionalLayers,
      gridVisible,
      gridMode,
      backgroundAlpha,
      letter,
      stepData,
      sequenceData,
      currentStep,
      isPlaying,
      externalTrailSettings,
      bluePropType,
      redPropType,
      previewDarkMode,
      isSeamlesslyLoopable,
    };
    untrack(() => {
      if (currentFireConfig) {
        engine.setFireConfig(currentFireConfig);
      }
      if (currentLedConfig) {
        engine.setLedConfig(currentLedConfig);
      }
      engine.setCellTipEffectMap(currentCellTipEffectMap);
      engine.setCellTipEffortMap(currentCellTipEffortMap);
      engine.update(props);
    });
  });

  $effect(() => {
    if (isInitialized) {
      engine.processPendingGlyph();
      // Wait for the render loop to paint at least one frame before
      // signaling readiness. The initializer sets isInitialized BEFORE
      // starting the render loop (step 8 vs step 10), so without this
      // delay the callback fires while the canvas is still blank.
      untrack(() => {
        if (onInitializedCallback) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              onInitializedCallback?.();
            });
          });
        }
      });
    }
  });

  // Pause/resume resize observation when parent controls it via prop
  $effect(() => {
    if (resizePaused) {
      engine.pauseResize();
    } else {
      engine.resumeResize();
    }
  });

  function handleGlyphSvgReady(
    svgString: string,
    width: number,
    height: number,
    x: number,
    y: number
  ) {
    engine.handleGlyphSvgReady(svgString, width, height, x, y);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenuHost?.openContextMenu(e.clientX, e.clientY);
  }
</script>

<!-- Hidden GlyphRenderer that converts TKAGlyph to SVG for Canvas2D rendering -->
{#if letter}
  <GlyphRenderer {letter} {stepData} onSvgReady={handleGlyphSvgReady} />
{/if}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="animation-container"
  data-focused={focused || undefined}
  data-fill={fillContainer || undefined}
  data-view={viewState}
  oncontextmenu={handleContextMenu}
  onpointerdown={handlePointerDown}
  onpointermove={cancelLongPress}
  onpointerup={cancelLongPress}
  onpointercancel={cancelLongPress}
>
  <div class="content-wrapper" bind:this={contentWrapperEl} data-dark-mode={darkModeEnabled ? "true" : "false"}>
    <div class="header-slot">
      <WordHeader
        {word}
        visible={wordHeaderVisible}
        darkMode={darkModeEnabled}
        activeStepNumber={currentStep >= 1 && currentStep < (sequenceData?.steps?.length ?? 0) + 0.99 ? Math.floor(currentStep) : null}
      />
    </div>

    <div
      class="canvas-wrapper"
      bind:this={containerElement}
      data-transparent={backgroundAlpha === 0 ? "true" : "false"}
      data-dark-mode={darkModeEnabled ? "true" : "false"}
    >
      <GlyphOverlay
        {letter}
        {displayedLetter}
        {displayedTurnsTuple}
        {displayedStepNumber}
        {displayedMusicalPosition}
        {stepData}
        tkaGlyphVisible={effectiveTkaGlyphVisible}
        stepNumbersVisible={effectiveBeatNumbersVisible}
        beatPositionVisible={effectiveBeatPositionVisible}
        darkMode={darkModeEnabled}
        isAtStartPosition={!hideStepNumbers && currentStep < 1 && sequenceData !== null}
        isAtEndPosition={
          !hideStepNumbers &&
          sequenceData !== null &&
          !effectiveIsSeamlesslyLoopable &&
          currentStep >= (sequenceData.steps?.length ?? 0) + 0.99
        }
      />

      <ProgressOverlay
        {isPreRendering}
        {preRenderProgress}
        {preRenderedFramesReady}
      />
    </div>

    <!-- Split canvases: blue-only and red-only, expand below hero during disassemble -->
    {#if showSplitCanvases}
      <div
        class="split-canvases"
        class:expanded={splitExpanded}
        bind:this={splitCanvasesEl}
        ontransitionend={handleSplitTransitionEnd}
      >
        <div class="split-canvas">
          <AnimatorCanvasSelf
            {blueProp}
            redProp={null}
            {gridVisible}
            {gridMode}
            backgroundAlpha={0}
            {letter}
            {stepData}
            {sequenceData}
            {currentStep}
            {isPlaying}
            {fireConfig}
            {ledConfig}
            fillContainer={true}
            hideTkaGlyph={true}
            hideStepNumbers={true}
            hideProgressBar={true}
            disableContextMenu={true}
            focused={false}
            resizePaused={splitResizePaused}
            onInitialized={handleSplitCanvasReady}
          />
        </div>
        <div class="split-canvas">
          <AnimatorCanvasSelf
            blueProp={null}
            {redProp}
            {gridVisible}
            {gridMode}
            backgroundAlpha={0}
            {letter}
            {stepData}
            {sequenceData}
            {currentStep}
            {isPlaying}
            {fireConfig}
            {ledConfig}
            fillContainer={true}
            hideTkaGlyph={true}
            hideStepNumbers={true}
            hideProgressBar={true}
            disableContextMenu={true}
            focused={false}
            resizePaused={splitResizePaused}
            onInitialized={handleSplitCanvasReady}
          />
        </div>
      </div>
    {/if}

    <div class="progress-slot">
      <SegmentedSequenceProgressBar
        steps={sequenceData?.steps ?? []}
        currentStep={currentStep}
        visible={progressBarVisible && !hideProgressBar}
        darkMode={darkModeEnabled}
        variant={progressBarVariant}
        showLabels={progressBarVariant === "labeled" || progressBarVariant === "gradient-labeled"}
        onSeek={onProgressBarSeek}
      />
    </div>
  </div>

  {#if !disableContextMenu}
    <CanvasContextMenuHost
      bind:this={contextMenuHost}
      onOpenSettings={handleOpenSettings}
      disassembled={externalToggleDisassemble ? externalDisassembled : isDisassembledView}
      onToggleDisassemble={externalToggleDisassemble ?? toggleDisassemble}
      captureEffectDiagnostics={() => engine.captureEffectDiagnostics()}
      {sequenceData}
    />

    <AnimationSettingsModal
      bind:open={settingsModalOpen}
      {sequenceData}
      {blueProp}
      {redProp}
      {letter}
      {stepData}
      {word}
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
     * Overhead: header (~53px) + progress (~32px) + border (3px) + margin (12px) = ~100px
     * Use 6.5rem (104px) for breathing room
     */
    width: min(calc(100cqw - 12px), calc(100cqh - 6.5rem - 12px));
    max-width: calc(100cqh - 6.5rem);
    /* Container query context for header font scaling */
    container-type: inline-size;
    /* Border styling */
    border: 1.5px solid var(--theme-panel-bg, #1a1a2e);
    border-radius: 4px;
    overflow: hidden;
    /* Smooth width change during disassemble (content-wrapper narrows to fit split row) */
    transition: border-color 350ms ease,
                width 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                max-width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .content-wrapper[data-dark-mode="true"] {
    border-color: var(--theme-accent, #00b8b8);
  }

  /* Header slot: in portrait, takes natural height at top */
  .header-slot {
    flex-shrink: 0;
    overflow: hidden;
    /* Smooth collapse/expand for constrained ↔ focused transitions */
    max-height: 100px;
    opacity: 1;
    transition: max-height 0.3s cubic-bezier(0.32, 0.72, 0, 1),
                opacity 0.2s ease-out;
  }

  /* Canvas wrapper: square in portrait mode */
  .canvas-wrapper {
    position: relative;
    width: 100%;
    /* Square: height = width using container query */
    height: 100cqw;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ===========================================
     SPLIT CANVASES: Blue-only and Red-only
     Expand below hero during disassemble.
     Same DOM tree — no swap, CSS transitions only.
     =========================================== */

  .split-canvases {
    display: flex;
    width: 100%;
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    /* Collapse: fade out quickly, no delay */
    transition: max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                opacity 0.2s ease-in;
  }

  .split-canvases.expanded {
    /* Each half-width canvas is square, so row height = 50% of wrapper width */
    max-height: 50cqw;
    opacity: 1;
    /* Expand: delay opacity so engines have time to render before becoming visible */
    transition: max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                opacity 0.3s ease-out 0.2s;
  }

  .split-canvas {
    width: 50%;
    aspect-ratio: 1 / 1;
    position: relative;
    overflow: hidden;
  }

  /* When split canvases are showing, narrow the content-wrapper so the taller
     layout (hero + split row) fits vertically. The 2:3 aspect ratio means
     width = (available_height - chrome) * 2/3 */
  .animation-container[data-view="disassembling"] .content-wrapper,
  .animation-container[data-view="disassembled"] .content-wrapper {
    width: min(calc(100cqw - 12px), calc((100cqh - 5rem) * 2 / 3));
    max-width: calc((100cqh - 5rem) * 2 / 3);
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

  .canvas-wrapper :global(canvas) {
    background: #f5f5f5;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: background-color 350ms ease;
  }

  .canvas-wrapper[data-dark-mode="true"] :global(canvas) {
    background: #0a0a0f;
  }

  .canvas-wrapper[data-transparent="true"] :global(canvas) {
    background: transparent !important;
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
      border-width: 1px;
    }

    .header-slot {
      max-height: 0;
      opacity: 0;
    }

    .canvas-wrapper {
      width: 100%;
      height: 100cqw;
    }
  }

  /* ===========================================
     FOCUSED MODE: Always show word + progress bar
     =========================================== */

  .animation-container[data-focused] .content-wrapper {
    width: min(calc(100cqw - 12px), calc(100cqh - 6.5rem - 12px));
    max-width: calc(100cqh - 6.5rem);
    max-height: calc(100cqh - 4px);
    height: auto;
  }

  .animation-container[data-focused] .header-slot {
    max-height: 100px !important;
    opacity: 1 !important;
  }

  .animation-container[data-focused] .canvas-wrapper {
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
    width: min(calc(100cqw - 12px), calc((100cqh - 6.5rem) * 2 / 3));
    max-width: calc((100cqh - 6.5rem) * 2 / 3);
  }

  /* ===========================================
     EXTREMELY CONSTRAINED: Minimal chrome
     =========================================== */

  @container (min-aspect-ratio: 2.5) {
    .content-wrapper {
      border: none;
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

  .animation-container[data-fill] .canvas-wrapper {
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
    .progress-slot,
    .split-canvases,
    .canvas-wrapper :global(canvas) {
      transition: none;
    }
  }
</style>
