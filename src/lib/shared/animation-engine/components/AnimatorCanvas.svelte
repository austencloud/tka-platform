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
  import type { FireOverlayConfig } from "../domain/types/FireTypes";
  import { onMount, onDestroy, untrack } from "svelte";

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
    // Whether sequence returns to start position - controls trail clearing on loop
    isSeamlesslyLoopable = undefined,
    // Progress bar visual variant
    progressBarVariant = "gradient-labeled",
    // Progress bar seek callback
    onProgressBarSeek = null,
    // When true, always show word header and progress bar regardless of aspect ratio.
    // Used when the animation canvas is the only visible content (focused/expanded pane).
    focused = false,
    // Fire overlay configuration — when provided, overrides the engine's defaults
    fireConfig = undefined,
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
    isSeamlesslyLoopable?: boolean;
    progressBarVariant?: "minimal" | "raised" | "rounded" | "neon" | "gradient" | "labeled" | "gradient-labeled";
    onProgressBarSeek?: ((targetStep: number) => void) | null;
    focused?: boolean;
    fireConfig?: Partial<FireOverlayConfig>;
  } = $props();

  // Container element
  let containerElement: HTMLDivElement;

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
  // Fire forces dark mode ON because fire on white background looks terrible
  const darkModeEnabled = $derived(
    previewDarkMode !== null ? previewDarkMode : (globalDarkMode || fireEffectEnabled)
  );

  // Effective visibility: combine global settings with hide props (for tunnel mode)
  const effectiveTkaGlyphVisible = $derived(tkaGlyphVisible && !hideTkaGlyph);
  const effectiveBeatNumbersVisible = $derived(stepNumbersVisible && !hideStepNumbers);
  const effectiveBeatPositionVisible = $derived(beatPositionVisible);

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

  // Initialize engine when container mounts
  onMount(() => {
    engine.initialize(containerElement, {
      onCanvasReady,
      onTrailSettingsChange: (settings) => {
        externalTrailSettings = settings;
      },
    });
    return () => {
      engine.dispose();
    };
  });

  // Single effect to pass all props to engine
  // NOTE: The engine.update() call is wrapped in untrack() because the engine
  // internally reads reactive state (visibility manager, etc.) that would cause
  // infinite loops if tracked. Props are read outside untrack() so changes still trigger updates.
  $effect(() => {
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
      // Pass preview dark mode override to engine for background rendering
      previewDarkMode,
      // Pass loopability for trail clearing logic
      isSeamlesslyLoopable,
    };
    untrack(() => {
      engine.update(props);
    });
  });

  // Sync fire config to engine when provided
  $effect(() => {
    if (fireConfig) {
      untrack(() => {
        engine.setFireConfig(fireConfig);
      });
    }
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
</script>

<!-- Hidden GlyphRenderer that converts TKAGlyph to SVG for Canvas2D rendering -->
{#if letter}
  <GlyphRenderer {letter} {stepData} onSvgReady={handleGlyphSvgReady} />
{/if}

<!-- Outer container centers the content -->
<div class="animation-container" data-focused={focused || undefined}>
  <!-- Inner wrapper: adaptive layout (vertical in portrait, horizontal in landscape) -->
  <div class="content-wrapper" data-dark-mode={darkModeEnabled ? "true" : "false"}>
    <!-- Word header - position adapts to layout mode -->
    <div class="header-slot">
      <WordHeader
        {word}
        visible={wordHeaderVisible}
        darkMode={darkModeEnabled}
        activeStepNumber={isPlaying ? Math.floor(currentStep) : null}
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
        isAtStartPosition={currentStep < 1 && sequenceData !== null}
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
        visible={progressBarVisible}
        darkMode={darkModeEnabled}
        variant={progressBarVariant}
        showLabels={progressBarVariant === "labeled" || progressBarVariant === "gradient-labeled"}
        onSeek={onProgressBarSeek}
      />
    </div>
  </div>
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
    border: 1.5px solid #1a1a2e;
    border-radius: 4px;
    overflow: hidden;
    transition: border-color var(--duration-fast) ease-out;
  }

  .content-wrapper[data-dark-mode="true"] {
    border-color: #00b8b8;
  }

  /* Header slot: in portrait, takes natural height at top */
  .header-slot {
    flex-shrink: 0;
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
  }

  .canvas-wrapper :global(canvas) {
    background: var(--canvas-bg, #f5f5f5);
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .canvas-wrapper[data-dark-mode="true"] :global(canvas) {
    --canvas-bg: #0a0a0f;
  }

  .canvas-wrapper[data-transparent="true"] :global(canvas) {
    background: transparent !important;
    --canvas-bg: transparent;
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
      /* Size based on shorter dimension (height) */
      width: calc(100cqh - 8px);
      max-width: calc(100cqh - 8px);
      /* Remove overhead calculation - just the square */
      height: auto;
      /* Tighter border in constrained mode */
      border-width: 1px;
    }

    /* Hide header when constrained - word is visible in choreo card below */
    .header-slot {
      display: none;
    }

    /* Hide progress bar when constrained - modal has playback controls */
    .progress-slot {
      display: none;
    }

    /* Canvas fills the available space */
    .canvas-wrapper {
      /* Square based on parent width (which equals height) */
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
    display: block !important;
  }

  .animation-container[data-focused] .progress-slot {
    display: block !important;
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
     REDUCED MOTION
     =========================================== */

  @media (prefers-reduced-motion: reduce) {
    .content-wrapper {
      transition: none;
    }
  }
</style>
