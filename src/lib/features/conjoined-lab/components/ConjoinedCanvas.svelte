<!--
  ConjoinedCanvas.svelte - Dual-grid canvas for conjoined visualization

  Renders two separate grids side by side (or other arrangements) where:
  - Grid A shows only the blue prop
  - Grid B shows only the red prop
  - Junction outer points are masked so center points show through

  Rendering order (back to front):
  1. Background
  2. Grid A lines/points
  3. Grid B lines/points
  4. Junction masks (hide outer points at overlap)
  5. Center point dots redrawn on top of masks
  6. Props and arrows (on top of everything)
  7. Labels
-->
<script lang="ts">
  import type { ConjoinedLayout, ConjoinedEdge } from "../domain/types";
  import { STRICT_HAND_POINT_COORDS } from "../domain/types";
  import type { PreparedPictographData } from "$lib/shared/pictograph/shared/domain/models/PreparedPictographData";
  import { container } from "$lib/shared/di";
  import GridSvg from "$lib/shared/pictograph/grid/components/GridSvg.svelte";
  import PropSvg from "$lib/shared/pictograph/prop/components/PropSvg.svelte";
  import ArrowSvg from "$lib/shared/pictograph/arrow/rendering/components/ArrowSvg.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PropPosition } from "$lib/shared/pictograph/prop/domain/models/PropPosition";
  import { getBetaOffsetSize } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";

  // Normal→strict hand point coordinate deltas by grid location.
  // Props use normal coordinates (~143px from center) but conjoined mode
  // needs strict coordinates (150px from center) to align with strict hand points.
  // Diamond (cardinal): 6.9px outward from center along one axis
  // Box (intercardinal): 4.9px outward per axis (6.9/√2)
  const STRICT_DELTAS: Record<string, { x: number; y: number }> = {
    n:  { x: 0,    y: -6.9 },
    e:  { x: 6.9,  y: 0    },
    s:  { x: 0,    y: 6.9  },
    w:  { x: -6.9, y: 0    },
    ne: { x: 4.9,  y: -4.9 },
    se: { x: 4.9,  y: 4.9  },
    sw: { x: -4.9, y: 4.9  },
    nw: { x: -4.9, y: -4.9 },
  };

  function toStrictPosition(position: PropPosition, endLocation: string): PropPosition {
    const delta = STRICT_DELTAS[endLocation.toLowerCase()];
    if (!delta) return position;
    return { x: position.x + delta.x, y: position.y + delta.y, rotation: position.rotation };
  }


  // Separation axis perpendicular to each conjoined edge direction
  const SEPARATION_AXES: Record<ConjoinedEdge, { x: number; y: number }> = {
    e: { x: 0, y: 1 }, w: { x: 0, y: 1 },
    n: { x: 1, y: 0 }, s: { x: 1, y: 0 },
    ne: { x: -0.707, y: 0.707 }, sw: { x: -0.707, y: 0.707 },
    nw: { x: 0.707, y: 0.707 }, se: { x: 0.707, y: 0.707 },
  };

  const OVERLAP_THRESHOLD = 5;

  // Props
  let {
    pictograph,
    layout,
    darkMode = true,
    showGrid = true,
    showArrows = true,
  }: {
    pictograph: PreparedPictographData | null;
    layout: ConjoinedLayout;
    darkMode?: boolean;
    showGrid?: boolean;
    showArrows?: boolean;
  } = $props();

  // Grid constants
  const GRID_CENTER = 475;
  const OUTER_POINT_RADIUS = 25; // r="25" in diamond_grid.svg
  const OUTER_POINT_STROKE = 13; // stroke-width: 13
  const MASK_RADIUS = OUTER_POINT_RADIUS + OUTER_POINT_STROKE / 2 + 2; // ~33.5, covers the full visual circle
  const CENTER_POINT_RADIUS = 12; // r="12" in diamond_grid.svg

  // Layout calculator from DI
  const layoutCalculator = container.items.conjoinedLayoutCalculator;

  // Calculate grid positions and canvas dimensions
  const gridPositions = $derived(layoutCalculator.calculateGridPositions(layout));
  const canvasDimensions = $derived(layoutCalculator.calculateCanvasDimensions(layout));

  // Derived prepared data
  const arrowPositions = $derived(pictograph?._prepared?.arrowPositions ?? {});
  const arrowAssets = $derived(pictograph?._prepared?.arrowAssets ?? {});
  const arrowMirroring = $derived(pictograph?._prepared?.arrowMirroring ?? {});
  const propPositions = $derived(pictograph?._prepared?.propPositions ?? {});
  const propAssets = $derived(pictograph?._prepared?.propAssets ?? {});
  const gridMode = $derived(pictograph?._prepared?.gridMode ?? GridMode.DIAMOND);

  // Motions
  const blueMotion = $derived(pictograph?.motions?.blue);
  const redMotion = $derived(pictograph?.motions?.red);

  // Adjust prop positions from normal to strict coordinates for conjoined mode.
  // Props are prepared with normal hand point coords (~143px from center) but
  // conjoined grids use strict hand points (150px from center).
  const blueStrictPropPosition = $derived(
    propPositions.blue && blueMotion
      ? toStrictPosition(propPositions.blue, blueMotion.endLocation)
      : propPositions.blue
  );
  const redStrictPropPosition = $derived(
    propPositions.red && redMotion
      ? toStrictPosition(propPositions.red, redMotion.endLocation)
      : propPositions.red
  );

  // Conjoined beta separation: when props on different grids physically
  // overlap at the junction, separate them perpendicular to the edge.
  const conjoinedBetaOffset = $derived.by(() => {
    const noOffset = { blue: { x: 0, y: 0 }, red: { x: 0, y: 0 } };
    if (!blueMotion || !redMotion || !blueStrictPropPosition || !redStrictPropPosition) {
      return noOffset;
    }

    const blueEnd = blueMotion.endLocation?.toLowerCase();
    const redEnd = redMotion.endLocation?.toLowerCase();
    if (!blueEnd || !redEnd) return noOffset;

    const blueCoord = STRICT_HAND_POINT_COORDS[blueEnd];
    const redCoord = STRICT_HAND_POINT_COORDS[redEnd];
    if (!blueCoord || !redCoord) return noOffset;

    // Compute global positions to detect physical overlap
    const blueGlobal = {
      x: gridPositions.gridA.x + blueCoord.x,
      y: gridPositions.gridA.y + blueCoord.y,
    };
    const redGlobal = {
      x: gridPositions.gridB.x + redCoord.x,
      y: gridPositions.gridB.y + redCoord.y,
    };

    const dist = Math.hypot(blueGlobal.x - redGlobal.x, blueGlobal.y - redGlobal.y);
    if (dist >= OVERLAP_THRESHOLD) return noOffset;

    // Overlap detected — determine separation direction from blue's arrow vector
    const axis = SEPARATION_AXES[layout.conjoinedEdge];
    const blueStart = STRICT_HAND_POINT_COORDS[blueMotion.startLocation?.toLowerCase()];
    if (!blueStart) return noOffset;

    const blueDir = { x: blueCoord.x - blueStart.x, y: blueCoord.y - blueStart.y };
    const projection = blueDir.x * axis.x + blueDir.y * axis.y;
    // Blue moves in its arrow's projected direction; default to -1 for zero projection
    const sign = projection > 0.01 ? 1 : -1;

    const propType = String(blueMotion.propType ?? "staff");
    const gridModeStr = gridMode === GridMode.BOX ? "box" : "diamond";
    const offset = getBetaOffsetSize(propType, gridModeStr);

    return {
      blue: { x: axis.x * sign * offset, y: axis.y * sign * offset },
      red: { x: -axis.x * sign * offset, y: -axis.y * sign * offset },
    };
  });

  // Final prop positions: strict coordinates + conjoined beta separation
  const blueFinalPropPosition = $derived(
    blueStrictPropPosition ? {
      x: blueStrictPropPosition.x + conjoinedBetaOffset.blue.x,
      y: blueStrictPropPosition.y + conjoinedBetaOffset.blue.y,
      rotation: blueStrictPropPosition.rotation,
    } : blueStrictPropPosition
  );
  const redFinalPropPosition = $derived(
    redStrictPropPosition ? {
      x: redStrictPropPosition.x + conjoinedBetaOffset.red.x,
      y: redStrictPropPosition.y + conjoinedBetaOffset.red.y,
      rotation: redStrictPropPosition.rotation,
    } : redStrictPropPosition
  );

  // Get the opposite edge for Grid B's outer point that sits on Grid A's center
  const OPPOSITE_EDGES: Record<ConjoinedEdge, ConjoinedEdge> = {
    n: "s", s: "n", e: "w", w: "e",
    ne: "sw", sw: "ne", se: "nw", nw: "se",
  };

  // Junction point A: Grid A's outer point position (= Grid B's center)
  const conjoinedPointOffset = $derived(layoutCalculator.getOuterPointOffset(layout.conjoinedEdge));
  const junctionA = $derived({
    x: gridPositions.gridA.x + GRID_CENTER + conjoinedPointOffset.x,
    y: gridPositions.gridA.y + GRID_CENTER + conjoinedPointOffset.y,
  });

  // Junction point B: Grid B's opposite outer point position (= Grid A's center)
  const oppositeEdge = $derived(OPPOSITE_EDGES[layout.conjoinedEdge]);
  const oppositeOffset = $derived(layoutCalculator.getOuterPointOffset(oppositeEdge));
  const junctionB = $derived({
    x: gridPositions.gridB.x + GRID_CENTER + oppositeOffset.x,
    y: gridPositions.gridB.y + GRID_CENTER + oppositeOffset.y,
  });

  // Background color based on dark mode
  const backgroundColor = $derived(darkMode ? "#0a0a0f" : "#d8d8d2");
  const gridColor = $derived(darkMode ? "#d0d0d0" : "#000000");
</script>

<div class="conjoined-canvas">
  <svg
    width="100%"
    height="100%"
    viewBox={canvasDimensions.viewBox}
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Conjoined Grid Visualization"
    class:dark-mode={darkMode}
  >
    <!-- 1. Background -->
    <rect
      x={canvasDimensions.viewBox.split(" ")[0]}
      y={canvasDimensions.viewBox.split(" ")[1]}
      width={canvasDimensions.width}
      height={canvasDimensions.height}
      fill={backgroundColor}
    />

    <!-- 2. Grid A (grid lines and points only) -->
    <!-- strict-mode: shows strict hand points (at exact midpoints) instead of normal ones -->
    <g transform="translate({gridPositions.gridA.x}, {gridPositions.gridA.y})" class="strict-mode">
      {#if showGrid}
        <GridSvg
          {gridMode}
          visible={true}
          showNonRadialPoints={false}
        />
      {/if}
    </g>

    <!-- 3. Grid B (grid lines and points only) -->
    <g transform="translate({gridPositions.gridB.x}, {gridPositions.gridB.y})" class="strict-mode">
      {#if showGrid}
        <GridSvg
          {gridMode}
          visible={true}
          showNonRadialPoints={false}
        />
      {/if}
    </g>

    <!-- 4. Junction masks: hide outer points where grids overlap -->
    <!-- Mask at junction A: hides Grid A's outer point so Grid B's center shows -->
    <circle
      cx={junctionA.x}
      cy={junctionA.y}
      r={MASK_RADIUS}
      fill={backgroundColor}
    />
    <!-- Mask at junction B: hides Grid B's outer point so Grid A's center shows -->
    <circle
      cx={junctionB.x}
      cy={junctionB.y}
      r={MASK_RADIUS}
      fill={backgroundColor}
    />

    <!-- 5. Redraw center point dots on top of the masks -->
    <!-- Grid B's center point (at junction A position) -->
    <circle
      cx={junctionA.x}
      cy={junctionA.y}
      r={CENTER_POINT_RADIUS}
      fill={gridColor}
    />
    <!-- Grid A's center point (at junction B position) -->
    <circle
      cx={junctionB.x}
      cy={junctionB.y}
      r={CENTER_POINT_RADIUS}
      fill={gridColor}
    />

    <!-- 6. Props and arrows (rendered on top of everything) -->
    <!-- Blue prop + arrow on Grid A -->
    <g transform="translate({gridPositions.gridA.x}, {gridPositions.gridA.y})">
      {#if blueMotion && propAssets.blue && blueFinalPropPosition}
        <PropSvg
          motionData={blueMotion}
          propAssets={propAssets.blue}
          propPosition={blueFinalPropPosition}
          showProp={true}
        />
      {/if}

      {#if showArrows && blueMotion && arrowAssets.blue && arrowPositions.blue}
        <ArrowSvg
          motionData={blueMotion}
          color="blue"
          pictographData={pictograph}
          arrowAssets={arrowAssets.blue}
          arrowPosition={arrowPositions.blue}
          shouldMirror={arrowMirroring.blue ?? false}
          showArrow={true}
        />
      {/if}
    </g>

    <!-- Red prop + arrow on Grid B -->
    <g transform="translate({gridPositions.gridB.x}, {gridPositions.gridB.y})">
      {#if redMotion && propAssets.red && redFinalPropPosition}
        <PropSvg
          motionData={redMotion}
          propAssets={propAssets.red}
          propPosition={redFinalPropPosition}
          showProp={true}
        />
      {/if}

      {#if showArrows && redMotion && arrowAssets.red && arrowPositions.red}
        <ArrowSvg
          motionData={redMotion}
          color="red"
          pictographData={pictograph}
          arrowAssets={arrowAssets.red}
          arrowPosition={arrowPositions.red}
          shouldMirror={arrowMirroring.red ?? false}
          showArrow={true}
        />
      {/if}
    </g>

    <!-- 7. Labels -->
    <text
      x={gridPositions.gridA.x + GRID_CENTER}
      y={gridPositions.gridA.y + 60}
      text-anchor="middle"
      fill={darkMode ? "rgba(59, 130, 246, 0.8)" : "rgba(59, 130, 246, 1)"}
      font-size="48"
      font-weight="600"
      font-family="system-ui, -apple-system, sans-serif"
    >
      BLUE
    </text>

    <text
      x={gridPositions.gridB.x + GRID_CENTER}
      y={gridPositions.gridB.y + 60}
      text-anchor="middle"
      fill={darkMode ? "rgba(239, 68, 68, 0.8)" : "rgba(239, 68, 68, 1)"}
      font-size="48"
      font-weight="600"
      font-family="system-ui, -apple-system, sans-serif"
    >
      RED
    </text>
  </svg>
</div>

<style>
  .conjoined-canvas {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  svg {
    max-width: 100%;
    max-height: 100%;
  }

  /* In conjoined mode, hide normal hand points and show strict ones instead.
     Strict hand points sit at exact midpoints (150px from center) which look
     correct when grids overlap. The SVG's embedded <style> handles showing
     .strict-hand-point via the .strict-mode parent class. */
  :global(.strict-mode .normal-hand-point) {
    opacity: 0;
  }
</style>
