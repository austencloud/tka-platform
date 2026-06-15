<!--
  HandPathBuilderLab.svelte - Hand Path Builder lab tab

  Tap grid locations to draw spatial hand paths for blue and red hands.
  No rotation - pure geometric paths through grid positions.
  Output: HandPathData objects saved to Firestore via HandPathRepository.

  Workflow:
    1. Pick a grid mode (diamond default)
    2. Tap to build the blue hand path (min 2 points)
    3. Switch to red, tap to build the red hand path (must match blue length)
    4. Complete → save both paths to the library

  Rendering: InteractiveCanvas composes AnimatorCanvas (Canvas2D) with
  HitTargetOverlay for click detection. Path trace lines and animated
  hand SVGs render through the SVG animation overlay layer.
-->
<script lang="ts">
  import { createBuilderState } from "./state/builder-state.svelte";
  import { setBuilderContext } from "./context/builder-context";
  import InteractiveCanvas from "$lib/shared/interactive-canvas/InteractiveCanvas.svelte";
  import { HandPathAnimator, getPathD } from "./services/hand-path-animator";
  import { propSvgLoader } from "$lib/shared/pictograph/prop/services/prop-svg-loader";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { PropRenderData } from "$lib/shared/pictograph/prop/domain/models/prop-render-data";
  import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { HandMove } from "./state/builder-state.svelte";
  import { getHitTargets } from "$lib/shared/assemble-lab/services/grid-hit-target-calculator";
  import PathPreview from "./components/PathPreview.svelte";
  import BuilderControls from "./components/BuilderControls.svelte";
  import GridModeSelector from "./components/GridModeSelector.svelte";

  const builder = createBuilderState();
  setBuilderContext(builder);

  const gridHandPoints = $derived(getHitTargets(builder.gridMode));

  const blueAnimator = new HandPathAnimator();
  const redAnimator = new HandPathAnimator();
  const ANIMATION_DURATION_MS = 350;

  const blueColor = "var(--prop-blue, #2e8bf0)";
  const redColor = "var(--prop-red, #ed1c24)";

  // Hand SVG render data (loaded on mount)
  let blueHandData = $state<PropRenderData | null>(null);
  let redHandData = $state<PropRenderData | null>(null);

  // Refs for animated hand SVG elements in the animation overlay
  let activeBlueHandRef: SVGGElement | null = $state(null);
  let activeRedHandRef: SVGGElement | null = $state(null);

  // Load hand SVGs on mount
  $effect(() => {
    const blueMotion = createMotionData({ propType: PropType.HAND, color: MotionColor.BLUE });
    propSvgLoader.loadPropSvg(
      { positionX: 0, positionY: 0, rotationAngle: 0 }, blueMotion, false,
    ).then(data => { blueHandData = data; }).catch(console.error);

    const redMotion = createMotionData({ propType: PropType.HAND, color: MotionColor.RED });
    propSvgLoader.loadPropSvg(
      { positionX: 0, positionY: 0, rotationAngle: 0 }, redMotion, false,
    ).then(data => { redHandData = data; }).catch(console.error);
  });

  // Register animation callback so builder.addLocation() can animate the hand
  $effect(() => {
    builder.setAnimationCallback(async (move: HandMove) => {
      const handData = builder.phase === "blue" ? blueHandData : redHandData;
      const handRef = builder.phase === "blue" ? activeBlueHandRef : activeRedHandRef;
      if (!handRef || !handData?.svgData) return;

      const animator = builder.phase === "blue" ? blueAnimator : redAnimator;
      await animator.animate({
        element: handRef,
        startPosition: move.from,
        endPosition: move.to,
        durationMs: ANIMATION_DURATION_MS,
        handCenter: handData.svgData.center,
      });
    });
  });

  // Map builder phase to the color the HitTargetOverlay should use
  const activePhaseColor = $derived(
    builder.phase === "blue" ? "blue" as const
    : builder.phase === "red" ? "red" as const
    : null
  );

  // Build SVG path "d" strings that follow the actual movement path
  // (arc for shifts, straight line for dashes)
  const bluePathDs = $derived(buildPathDs(builder.blueLocations));
  const redPathDs = $derived(buildPathDs(builder.redLocations));

  function buildPathDs(locations: readonly GridLocation[]): string[] {
    const ds: string[] = [];
    for (let i = 0; i < locations.length - 1; i++) {
      ds.push(getPathD(locations[i]!, locations[i + 1]!));
    }
    return ds;
  }
</script>

<div class="hand-path-builder">
  <header class="lab-header">
    <h2 class="lab-title">Hand Path Builder</h2>
    <p class="lab-subtitle">Tap grid points to draw spatial paths for each hand.</p>
  </header>

  <div class="mode-bar">
    <GridModeSelector />
  </div>

  <div class="grid-area">
    <InteractiveCanvas
      blueProp={null}
      redProp={null}
      gridMode={builder.gridMode}
      gridVisible={false}
      interactive={builder.phase !== "complete"}
      {activePhaseColor}
      currentPosition={builder.lastLocation}
      disabled={builder.isAnimating}
      onPointClick={(loc) => builder.addLocation(loc)}
    >
      {#snippet animationLayer()}
        <!-- Hand points and center - rendered here instead of Canvas2D grid
             to avoid outer points and layer 2 clutter -->
        <circle cx="475" cy="475" r="6" fill="var(--dm-grid-color, #d0d0d0)" opacity="0.6" />
        {#each gridHandPoints as pt (pt.location)}
          <circle cx={pt.x} cy={pt.y} r="4.7" fill="var(--dm-grid-color, #d0d0d0)" />
        {/each}

        <!-- Path trace lines following actual movement geometry -->
        {#each bluePathDs as d, i (i)}
          <path {d} fill="none" stroke={blueColor} stroke-width="4" stroke-linecap="round" opacity="0.7" />
        {/each}
        {#each redPathDs as d, i (i)}
          <path {d} fill="none" stroke={redColor} stroke-width="4" stroke-linecap="round" opacity="0.7" />
        {/each}

        <!-- Animated hand SVGs (positioned via HandPathAnimator.animate()) -->
        {#if builder.blueLocations.length > 0 && blueHandData?.svgData}
          <g bind:this={activeBlueHandRef} class="hand-anim-group" aria-hidden="true">
            {@html blueHandData.svgData.svgContent}
          </g>
        {/if}
        {#if builder.redLocations.length > 0 && redHandData?.svgData}
          <g bind:this={activeRedHandRef} class="hand-anim-group" aria-hidden="true">
            {@html redHandData.svgData.svgContent}
          </g>
        {/if}

        <!-- Complete state -->
        {#if builder.phase === "complete"}
          <text x="475" y="475" text-anchor="middle" dominant-baseline="middle"
            font-size="20" fill="rgba(255,255,255,0.45)">Paths complete</text>
        {/if}
      {/snippet}
    </InteractiveCanvas>
  </div>

  <div class="preview-area">
    <PathPreview />
  </div>

  <div class="controls-area">
    <BuilderControls />
  </div>
</div>

<style>
  .hand-path-builder {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    padding: 16px;
    gap: 12px;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    box-sizing: border-box;
  }

  .lab-header {
    text-align: center;
    flex-shrink: 0;
  }

  .lab-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-text, #fff);
    margin: 0 0 4px;
  }

  .lab-subtitle {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.45));
    margin: 0;
  }

  .mode-bar {
    width: 100%;
    max-width: 440px;
    flex-shrink: 0;
  }

  .grid-area {
    width: 100%;
    max-width: 400px;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: 20px;
  }

  /* Zoom in on the grid - hands are small so we don't need the prop
     buffer space that the assemble tab requires for staffs/fans */
  .grid-area :global(.interactive-canvas-wrapper) {
    transform: scale(1.85);
    transform-origin: center center;
  }


  .preview-area {
    width: 100%;
    max-width: 440px;
    flex-shrink: 0;
  }

  .controls-area {
    width: 100%;
    max-width: 440px;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .hand-path-builder {
      padding: 10px;
      gap: 10px;
    }

    .lab-title {
      font-size: 16px;
    }
  }
</style>
