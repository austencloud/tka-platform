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
  import ProgressOverlay from "./layers/ProgressOverlay.svelte";
  import { AnimationEngine } from "../services/implementations/AnimationEngine.svelte";
  import { onMount, untrack } from "svelte";

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
  } = $props();

  // Container element
  let containerElement: HTMLDivElement;

  // Engine instance
  const engine = new AnimationEngine();

  // Derived state from engine
  const rendererLoading = $derived(engine.state.rendererLoading);
  const rendererError = $derived(engine.state.rendererError);
  const isInitialized = $derived(engine.state.isInitialized);
  const tkaGlyphVisible = $derived(engine.state.visibilityState.tkaGlyph);
  const beatNumbersVisible = $derived(engine.state.visibilityState.beatNumbers);
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
  const darkModeEnabled = $derived(engine.state.visibilityState.darkMode);

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

<style>
  .canvas-wrapper {
    position: relative;
    aspect-ratio: 1 / 1;
    height: 100%;
    width: auto;
    max-width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .canvas-wrapper :global(canvas) {
    border: 1px solid rgba(229, 231, 235, 0.4);
    border-radius: 2px;
    background: var(--canvas-bg, #ffffff);
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .canvas-wrapper[data-transparent="true"] :global(canvas) {
    background: transparent !important;
    border: none !important;
    --canvas-bg: transparent;
  }

  /* Dark Mode: dark background */
  .canvas-wrapper[data-lights-off="true"] :global(canvas) {
    background: #0a0a0f !important;
    border-color: rgba(0, 255, 255, 0.2);
  }
</style>
