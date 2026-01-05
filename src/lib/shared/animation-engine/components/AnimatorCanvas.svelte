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
  import type { BeatData } from "../../../features/create/shared/domain/models/BeatData";
  import type { PropState } from "../domain/PropState";
  import type { TrailSettings } from "../domain/types/TrailTypes";
  import GlyphRenderer from "./GlyphRenderer.svelte";
  import GlyphOverlay from "./layers/GlyphOverlay.svelte";
  import WordHeader from "./layers/WordHeader.svelte";
  import ProgressOverlay from "./layers/ProgressOverlay.svelte";
  import { AnimationEngine } from "../services/implementations/AnimationEngine.svelte";
  import { getAnimationVisibilityManager } from "../state/animation-visibility-state.svelte";
  import { onMount, onDestroy, untrack } from "svelte";

  // Props
  let {
    blueProp,
    redProp,
    secondaryBlueProp = null,
    secondaryRedProp = null,
    gridVisible = true,
    gridMode = GridMode.DIAMOND,
    backgroundAlpha = 1,
    letter = null,
    beatData = null,
    sequenceData = null,
    currentBeat = 0,
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
  }: {
    blueProp: PropState | null;
    redProp: PropState | null;
    secondaryBlueProp?: PropState | null;
    secondaryRedProp?: PropState | null;
    gridVisible?: boolean;
    gridMode?: GridMode | null;
    backgroundAlpha?: number;
    letter?: Letter | null;
    beatData?: StartPositionData | BeatData | null;
    sequenceData?: SequenceData | null;
    currentBeat?: number;
    isPlaying?: boolean;
    onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
    onPlaybackToggle?: () => void;
    trailSettings?: TrailSettings;
    bluePropType?: string | null;
    redPropType?: string | null;
    word?: string | null;
    previewDarkMode?: boolean | null;
  } = $props();

  // Container element
  let containerElement: HTMLDivElement;

  // Engine instance
  const engine = new AnimationEngine();

  // Visibility manager - direct observation for reliable reactivity
  const visibilityManager = getAnimationVisibilityManager();

  // Local visibility state updated via observer (more reliable than engine state propagation)
  let tkaGlyphVisible = $state(visibilityManager.getVisibility("tkaGlyph"));
  let beatNumbersVisible = $state(visibilityManager.getVisibility("beatNumbers"));
  let globalDarkMode = $state(visibilityManager.isDarkMode());
  let wordHeaderVisible = $state(visibilityManager.getVisibility("wordHeader"));

  // Effective dark mode: use preview override if provided, otherwise global
  const darkModeEnabled = $derived(
    previewDarkMode !== null ? previewDarkMode : globalDarkMode
  );

  function handleVisibilityChange() {
    tkaGlyphVisible = visibilityManager.getVisibility("tkaGlyph");
    beatNumbersVisible = visibilityManager.getVisibility("beatNumbers");
    globalDarkMode = visibilityManager.isDarkMode();
    wordHeaderVisible = visibilityManager.getVisibility("wordHeader");
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
  const displayedBeatNumber = $derived(engine.state.displayedBeatNumber);
  const fadingOutLetter = $derived(engine.state.fadingOutLetter);
  const fadingOutTurnsTuple = $derived(engine.state.fadingOutTurnsTuple);
  const fadingOutBeatNumber = $derived(engine.state.fadingOutBeatNumber);
  const isNewLetter = $derived(engine.state.isNewLetter);

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
      secondaryBlueProp,
      secondaryRedProp,
      gridVisible,
      gridMode,
      backgroundAlpha,
      letter,
      beatData,
      sequenceData,
      currentBeat,
      isPlaying,
      externalTrailSettings,
      bluePropType,
      redPropType,
    };
    untrack(() => {
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
</script>

<!-- Hidden GlyphRenderer that converts TKAGlyph to SVG for Canvas2D rendering -->
{#if letter}
  <GlyphRenderer {letter} {beatData} onSvgReady={handleGlyphSvgReady} />
{/if}

<!-- Outer container: word header above + canvas area below -->
<div class="animation-container" data-lights-off={darkModeEnabled ? "true" : "false"}>
  <!-- Word header lives ABOVE the canvas (not overlaid) -->
  <WordHeader {word} visible={wordHeaderVisible} />

  <!-- Canvas wrapper maintains 1:1 aspect ratio for animation only -->
  <div
    class="canvas-wrapper"
    bind:this={containerElement}
    data-transparent={backgroundAlpha === 0 ? "true" : "false"}
    data-lights-off={darkModeEnabled ? "true" : "false"}
  >
    <GlyphOverlay
      {letter}
      {displayedLetter}
      {displayedTurnsTuple}
      {displayedBeatNumber}
      {fadingOutLetter}
      {fadingOutTurnsTuple}
      {fadingOutBeatNumber}
      {isNewLetter}
      {tkaGlyphVisible}
      {beatNumbersVisible}
    />

    <ProgressOverlay
      {isPreRendering}
      {preRenderProgress}
      {preRenderedFramesReady}
    />
  </div>
</div>

<style>
  /* Outer container: column layout with word header above canvas */
  .animation-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    width: 100%;
    container-type: size;
  }

  /* Canvas wrapper maintains 1:1 aspect ratio for animation content only */
  .canvas-wrapper {
    position: relative;
    aspect-ratio: 1 / 1;
    flex: 1 1 auto;
    min-height: 0;
    width: auto;
    max-width: 100%;
    max-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .canvas-wrapper :global(canvas) {
    border: 1px solid rgba(229, 231, 235, 0.4);
    border-radius: 2px;
    /* Background is drawn via JavaScript fillRect for smooth transitions */
    /* CSS background is only a fallback before first render */
    background: var(--canvas-bg, #ffffff);
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    /* Only transition border - background is handled by JS interpolation */
    transition: border-color 150ms ease-out;
  }

  .canvas-wrapper[data-transparent="true"] :global(canvas) {
    background: transparent !important;
    border: none !important;
    --canvas-bg: transparent;
  }

  /* Dark Mode: border color only - background is handled by JS interpolation */
  .canvas-wrapper[data-lights-off="true"] :global(canvas) {
    border-color: rgba(0, 255, 255, 0.2);
  }
</style>
