<!--
AnimatorCanvas.svelte - Canvas2D Animation Canvas

================================================================================
ARCHITECTURAL NOTE
================================================================================

This component is a thin wrapper (~120 lines) around AnimationEngine.

All orchestration logic (previously 23 effects) has been extracted to:
  src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts

The component's role:
1. Mount container element
2. Initialize engine
3. Pass props to engine.update() in single $effect
4. Derive state from engine.state
5. Render template (canvas-wrapper, GlyphOverlay, ProgressOverlay)

This follows the standard canvas animation pattern:
- Thin component (~120 lines)
- Fat engine class (~500 lines)
- Services handle specific concerns

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
  import { getAnimationVisibilityManager } from "../state/animation-visibility-state.svelte";
  import { sequenceLoopabilityChecker } from "$lib/features/compose/services/implementations/SequenceLoopabilityChecker";
  import type { FireOverlayConfig } from "../domain/types/FireTypes";
  import type { LedOverlayConfig } from "../domain/types/LedTypes";
  import CanvasContextMenuHost from "./canvas-context-menu/CanvasContextMenuHost.svelte";
  import CanvasSettingsModal from "./canvas-settings-modal/CanvasSettingsModal.svelte";
  import DisassembleTransition from "./DisassembleTransition.svelte";
  import type { SettingsPanelCategory } from "./canvas-context-menu/CanvasContextMenuBuilder";
  import { onDestroy, untrack } from "svelte";

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
    // Prop type overrides - bypass settings when provided (useful for demos/previews)
    bluePropType = null,
    redPropType = null,
    // Word for header display
    word = null,
    // Preview-only dark mode override - when provided, bypasses global setting
    // Used in sequence viewer preview so dark mode toggle doesn't affect global app state
    previewDarkMode = null,
    // Tunnel mode: hide TKA glyph and beat numbers (combined motions don't form a letter)
    hideTkaGlyph = false,
    hideStepNumbers = false,
    // Hide progress bar for this instance (e.g. small canvases in Disassemble tab)
    hideProgressBar = false,
    // Whether sequence returns to start position - controls trail clearing on loop
    isSeamlesslyLoopable = undefined,
    // Progress bar visual variant
    progressBarVariant = "gradient",
    // Progress bar seek callback
    onProgressBarSeek = null,
    // When true, always show word header and progress bar regardless of aspect ratio.
    // Used when the animation canvas is the only visible content (focused/expanded pane).
    focused = false,
    // Fire overlay configuration — when provided, overrides the engine's defaults
    fireConfig = undefined,
    // LED overlay configuration — when provided, overrides the engine's defaults
    ledConfig = undefined,
    // When true, suppresses context menu and settings modal (used inside CanvasSettingsModal to prevent recursion)
    disableContextMenu = false,
    // When true, canvas fills its parent edge-to-edge (no centering, no border, no square constraint)
    fillContainer = false,
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
    disableContextMenu?: boolean;
    fillContainer?: boolean;
  } = $props();

  // Disassemble mode state machine
  type ViewState = "assembled" | "disassembling" | "disassembled" | "reassembling";
  let viewState = $state<ViewState>("assembled");
  let assembledRect = $state<DOMRect | null>(null);
  let contentWrapperEl: HTMLDivElement | undefined = $state();
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  // Brief flag: when true, header/progress start collapsed and CSS-transition open.
  // Prevents the visual "snap" when chrome appears after reassembly.
  let reassembleEntry = $state(false);

  // Derived boolean for context menu display
  const isDisassembledView = $derived(viewState !== "assembled");

  function toggleDisassemble() {
    if (viewState === "assembled") {
      // Measure the square canvas-wrapper rect (not the content-wrapper which includes
      // word header + progress bar and is non-square — scaling square slots to a
      // non-square target causes visible distortion)
      if (containerElement) {
        assembledRect = containerElement.getBoundingClientRect();
      }
      viewState = "disassembling";
    } else if (viewState === "disassembled") {
      viewState = "reassembling";
    }
    // Ignore during active transitions
  }

  function handleTransitionComplete() {
    if (viewState === "disassembling") {
      viewState = "disassembled";
    } else if (viewState === "reassembling") {
      // Chrome starts collapsed so there's no layout snap when
      // the assembled view mounts with header + progress bar.
      reassembleEntry = true;
      viewState = "assembled";
      // Wait 2 rAFs (one for mount, one for paint) then let CSS transitions expand
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          reassembleEntry = false;
        });
      });
    }
  }

  function handlePointerDown(e: PointerEvent) {
    // Only primary button, only touch/pen (not mouse — mouse uses context menu)
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

  // Container element — must be $state so the initialization $effect
  // re-runs when bind:this assigns a new element after disassemble/reassemble
  let containerElement: HTMLDivElement | undefined = $state();
  let contextMenuHost: CanvasContextMenuHost | undefined = $state();

  // Settings modal state
  let settingsModalOpen = $state(false);
  let settingsModalCategory = $state<SettingsPanelCategory | undefined>(undefined);

  function handleOpenPanel(category: SettingsPanelCategory) {
    settingsModalCategory = category;
    settingsModalOpen = true;
  }

  // Engine instance
  const engine = new AnimationEngine();

  // Visibility manager - direct observation for reliable reactivity
  const visibilityManager = getAnimationVisibilityManager();

  // Local visibility state updated via observer (more reliable than engine state propagation)
  let tkaGlyphVisible = $state(visibilityManager.getVisibility("tkaGlyph"));
  let stepNumbersVisible = $state(visibilityManager.getVisibility("stepNumbers"));
  let beatPositionVisible = $state(visibilityManager.getVisibility("beatPosition"));
  let globalDarkMode = $state(visibilityManager.isDarkMode());
  let wordHeaderVisible = $state(visibilityManager.getVisibility("wordHeader"));
  let progressBarVisible = $state(visibilityManager.getVisibility("progressBar"));
  let fireEffectEnabled = $state(visibilityManager.isFireEffectEnabled());

  // Effective dark mode: use preview override if provided, otherwise global
  const darkModeEnabled = $derived(
    previewDarkMode !== null ? previewDarkMode : globalDarkMode
  );

  // Effective visibility: combine global settings with hide props (for tunnel mode)
  const effectiveTkaGlyphVisible = $derived(tkaGlyphVisible && !hideTkaGlyph);
  const effectiveBeatNumbersVisible = $derived(stepNumbersVisible && !hideStepNumbers);
  const effectiveBeatPositionVisible = $derived(beatPositionVisible);

  // Derive loopability: use prop if provided, otherwise check from sequence data
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

  // Derived state from engine (non-visibility state)
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

  // Initialize engine when container element appears (or reappears after disassemble/reassemble).
  // Using $effect instead of onMount because the {#if} branching destroys and recreates
  // the .canvas-wrapper DOM element. The engine must reinitialize with the new element.
  $effect(() => {
    const el = containerElement;
    if (!el) return;

    untrack(() => {
      engine.initialize(el, {
        onCanvasReady,
        onTrailSettingsChange: (settings) => {
          externalTrailSettings = settings;
        },
      });
    });

    return () => {
      untrack(() => engine.dispose());
    };
  });

  // Single effect to pass all props to engine.
  // Fire/LED configs are synced BEFORE engine.update() so the first render frame
  // uses correct physics — not the defaults that would show a brief flash of
  // full-intensity fire on tab switch.
  $effect(() => {
    // Read reactive props outside untrack
    const currentFireConfig = fireConfig;
    const currentLedConfig = ledConfig;
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
      // Sync fire/LED config before update so render frame uses correct values
      if (currentFireConfig) {
        engine.setFireConfig(currentFireConfig);
      }
      if (currentLedConfig) {
        engine.setLedConfig(currentLedConfig);
      }
      engine.update(props);
    });
  });

  // Process pending glyphs when initialized
  $effect(() => {
    if (isInitialized) {
      engine.processPendingGlyph();
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

{#if viewState !== "assembled"}
  <!-- Disassembled / transitioning: single component stays mounted for all non-assembled states.
       Avoids canvas re-initialization flash by keeping the three AnimatorCanvases alive. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="animation-container"
    oncontextmenu={handleContextMenu}
    onpointerdown={handlePointerDown}
    onpointermove={cancelLongPress}
    onpointerup={cancelLongPress}
    onpointercancel={cancelLongPress}
  >
    <DisassembleTransition
      direction={viewState === "disassembling" ? "disassemble" : viewState === "reassembling" ? "reassemble" : "idle"}
      {assembledRect}
      {blueProp}
      {redProp}
      gridVisible={gridVisible}
      gridMode={gridMode}
      backgroundAlpha={backgroundAlpha}
      letter={letter}
      stepData={stepData}
      sequenceData={sequenceData}
      currentStep={currentStep}
      isPlaying={isPlaying}
      word={word}
      fireConfig={fireConfig}
      ledConfig={ledConfig}
      oncomplete={handleTransitionComplete}
    />

    {#if !disableContextMenu}
      <CanvasContextMenuHost
        bind:this={contextMenuHost}
        onOpenPanel={handleOpenPanel}
        disassembled={isDisassembledView}
        onToggleDisassemble={toggleDisassemble}
      />
    {/if}
  </div>
{:else}
  <!-- Hidden GlyphRenderer that converts TKAGlyph to SVG for Canvas2D rendering -->
  {#if letter}
    <GlyphRenderer {letter} {stepData} onSvgReady={handleGlyphSvgReady} />
  {/if}

  <!-- Outer container centers the content -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="animation-container"
    data-focused={focused || undefined}
    data-fill={fillContainer || undefined}
    data-reassemble-entry={reassembleEntry || undefined}
    oncontextmenu={handleContextMenu}
    onpointerdown={handlePointerDown}
    onpointermove={cancelLongPress}
    onpointerup={cancelLongPress}
    onpointercancel={cancelLongPress}
  >
    <!-- Inner wrapper: adaptive layout (vertical in portrait, horizontal in landscape) -->
    <div class="content-wrapper" bind:this={contentWrapperEl} data-dark-mode={darkModeEnabled ? "true" : "false"}>
      <!-- Word header - position adapts to layout mode -->
      <div class="header-slot">
        <WordHeader
          {word}
          visible={wordHeaderVisible}
          darkMode={darkModeEnabled}
          activeStepNumber={isPlaying && currentStep >= 1 && currentStep < (sequenceData?.steps?.length ?? 0) + 0.99 ? Math.floor(currentStep) : null}
        />
      </div>

      <!-- Canvas wrapper maintains 1:1 aspect ratio for animation only -->
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

      <!-- Progress bar - position adapts to layout mode -->
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
        onOpenPanel={handleOpenPanel}
        disassembled={isDisassembledView}
        onToggleDisassemble={toggleDisassemble}
      />

      <CanvasSettingsModal
        bind:open={settingsModalOpen}
        initialCategory={settingsModalCategory}
        {sequenceData}
        {blueProp}
        {redProp}
        {letter}
        {stepData}
        {word}
      />
    {/if}
  </div>
{/if}

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
    transition: border-color 350ms ease;
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
     This prevents wasted horizontal space when the animation
     pane is wider than the portrait-mode canvas needs.
     =========================================== */

  @container (min-aspect-ratio: 1.15) {
    .content-wrapper {
      /* Size based on shorter dimension (height), minus progress bar overhead (~2.5rem) */
      width: calc(100cqh - 2.5rem);
      max-width: calc(100cqh - 2.5rem);
      /* Remove overhead calculation - square canvas + progress bar */
      height: auto;
      /* Tighter border in constrained mode */
      border-width: 1px;
    }

    /* Smoothly collapse header - word is visible in choreo card below */
    .header-slot {
      max-height: 0;
      opacity: 0;
    }

    /* Progress bar stays visible in constrained mode */

    /* Canvas fills the available space */
    .canvas-wrapper {
      /* Square based on parent width (which equals height minus progress) */
      width: 100%;
      height: 100cqw;
    }
  }

  /* ===========================================
     FOCUSED MODE: Always show word + progress bar
     When the animation canvas is the only visible
     content (pane expanded), override constrained
     mode to always show chrome.
     =========================================== */

  .animation-container[data-focused] .content-wrapper {
    /* Size canvas side = min(container_width, container_height - chrome_overhead)
     * Chrome: word header (~53px) + progress bar (~32px) + border (~3px) = ~88px
     * Use 6.5rem (104px) for breathing room */
    width: min(calc(100cqw - 12px), calc(100cqh - 6.5rem - 12px));
    max-width: calc(100cqh - 6.5rem);
    /* Safety net: never exceed container height */
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
    /* Allow shrinking as last resort if chrome + canvas exceeds max-height */
    flex-shrink: 1;
    min-height: 0;
  }

  /* ===========================================
     EXTREMELY CONSTRAINED: Minimal chrome
     When aspect ratio > 2.5, remove all borders
     =========================================== */

  @container (min-aspect-ratio: 2.5) {
    .content-wrapper {
      border: none;
      border-radius: 0;
    }
  }

  /* ===========================================
     FILL CONTAINER MODE: Edge-to-edge rendering
     Used by DisassembleCanvasView sub-canvases.
     Strips centering, borders, and square constraint
     so the canvas fills its parent slot completely.
     =========================================== */

  /* Fill mode: canvas stretches to fill its parent slot completely.
     Used by disassemble views so canvases sit flush against each other. */
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
    /* Override the square constraint — fill remaining space after header/progress */
    height: auto !important;
    min-height: 0;
  }

  /* ===========================================
     REASSEMBLE ENTRY: Smooth chrome reveal
     After reassembly FLIP completes, the assembled view mounts
     with chrome collapsed. Removing the attribute triggers CSS
     transitions to smoothly expand header + progress bar.
     MUST appear after focused/fill/constrained overrides to win cascade.
     =========================================== */

  .animation-container[data-reassemble-entry] .header-slot,
  .animation-container[data-reassemble-entry] .progress-slot {
    max-height: 0 !important;
    opacity: 0 !important;
  }

  /* ===========================================
     REDUCED MOTION
     =========================================== */

  @media (prefers-reduced-motion: reduce) {
    .content-wrapper,
    .header-slot,
    .progress-slot,
    .canvas-wrapper :global(canvas) {
      transition: none;
    }
  }
</style>
