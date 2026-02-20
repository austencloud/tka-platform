<!--
  StripBeatCell.svelte - Mini pictograph for the beat strip

  Renders a small pictograph showing grid lines, prop(s) at start positions,
  and arrow arcs/lines for each hand's motion. Uses the same 950x950 SVG
  coordinate space as InteractiveGrid, scaled down via CSS.
-->
<script lang="ts">
  import {
    GridLocation,
    GridMode,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropRotAngleManager } from "$lib/shared/pictograph/prop/services/implementations/PropRotAngleManager";
  import type { BuilderBeat } from "../state/visual-builder-state.svelte";
  import {
    HALF_PI,
    LOCATION_ANGLES,
    PI,
    TWO_PI,
  } from "$lib/features/compose/shared/domain/math-constants";

  interface PropSvgData {
    svgContent: string;
    center: { x: number; y: number };
  }

  let {
    blueBeat = null,
    redBeat = null,
    bluePropSvg = null,
    redPropSvg = null,
    gridMode = GridMode.DIAMOND,
    beatIndex = 0,
  }: {
    blueBeat: BuilderBeat | null;
    redBeat: BuilderBeat | null;
    bluePropSvg: PropSvgData | null;
    redPropSvg: PropSvgData | null;
    gridMode: GridMode;
    beatIndex: number;
  } = $props();

  // 950x950 coordinate space constants
  const CENTER = 475;
  const GRID_RADIUS = 143.1;

  // Diamond grid points
  const DIAMOND_POINTS = [
    { location: GridLocation.NORTH, x: 475, y: 331.9 },
    { location: GridLocation.EAST, x: 618.1, y: 475 },
    { location: GridLocation.SOUTH, x: 475, y: 618.1 },
    { location: GridLocation.WEST, x: 331.9, y: 475 },
  ] as const;

  // Diamond grid lines (connecting adjacent points)
  const DIAMOND_LINES = [
    { x1: 475, y1: 331.9, x2: 618.1, y2: 475 },   // N → E
    { x1: 618.1, y1: 475, x2: 475, y2: 618.1 },     // E → S
    { x1: 475, y1: 618.1, x2: 331.9, y2: 475 },     // S → W
    { x1: 331.9, y1: 475, x2: 475, y2: 331.9 },     // W → N
  ] as const;

  /** Normalize angle to [0, 2*PI) */
  function normPos(angle: number): number {
    const n = angle % TWO_PI;
    return n < 0 ? n + TWO_PI : n;
  }

  /** Normalize angle to (-PI, PI] */
  function normSigned(angle: number): number {
    const n = normPos(angle);
    return n > PI ? n - TWO_PI : n;
  }

  /** Check if two grid locations are diametrically opposite */
  function isOpposite(a: GridLocation, b: GridLocation): boolean {
    const angleA = LOCATION_ANGLES[a];
    const angleB = LOCATION_ANGLES[b];
    const delta = Math.abs(normSigned(angleB - angleA));
    return Math.abs(delta - PI) < 0.01;
  }

  /** Get pixel coordinates for a grid location */
  function locationToPixel(loc: GridLocation): { x: number; y: number } {
    const angle = LOCATION_ANGLES[loc];
    return {
      x: CENTER + Math.cos(angle) * GRID_RADIUS,
      y: CENTER + Math.sin(angle) * GRID_RADIUS,
    };
  }

  /** Build SVG path for an arrow between two grid locations */
  function buildArrowPath(start: GridLocation, end: GridLocation): string {
    if (start === end) return ""; // static — no arrow

    const startPt = locationToPixel(start);
    const endPt = locationToPixel(end);

    if (isOpposite(start, end)) {
      // Dash: straight line
      return `M ${startPt.x} ${startPt.y} L ${endPt.x} ${endPt.y}`;
    }

    // Shift: arc along the grid circle
    const centerMovement = normSigned(LOCATION_ANGLES[end] - LOCATION_ANGLES[start]);
    const sweepFlag = centerMovement > 0 ? 1 : 0;
    return `M ${startPt.x} ${startPt.y} A ${GRID_RADIUS} ${GRID_RADIUS} 0 0 ${sweepFlag} ${endPt.x} ${endPt.y}`;
  }

  /** Build CSS transform for a prop SVG at a given position/orientation */
  function propTransform(
    loc: GridLocation,
    ori: string,
    center: { x: number; y: number },
    mode: GridMode,
  ): string {
    const pt = locationToPixel(loc);
    const rotation = PropRotAngleManager.calculateRotation(loc, ori as any, mode);
    return `translate(${pt.x}px, ${pt.y}px) rotate(${rotation}deg) translate(${-center.x}px, ${-center.y}px)`;
  }

  // Derived arrow paths
  const blueArrowPath = $derived(
    blueBeat ? buildArrowPath(blueBeat.startPosition, blueBeat.endPosition) : ""
  );
  const redArrowPath = $derived(
    redBeat ? buildArrowPath(redBeat.startPosition, redBeat.endPosition) : ""
  );
</script>

<div class="strip-beat-cell" aria-label="Beat {beatIndex + 1}">
  <svg viewBox="0 0 950 950" xmlns="http://www.w3.org/2000/svg">
    <!-- Background -->
    <rect width="950" height="950" fill="rgba(18, 18, 28, 0.95)" rx="40" />

    <!-- Grid lines -->
    {#each DIAMOND_LINES as line}
      <line
        x1={line.x1} y1={line.y1}
        x2={line.x2} y2={line.y2}
        stroke="rgba(255, 255, 255, 0.12)"
        stroke-width="3"
      />
    {/each}

    <!-- Grid points (small dots) -->
    {#each DIAMOND_POINTS as pt}
      <circle cx={pt.x} cy={pt.y} r="8" fill="rgba(255, 255, 255, 0.2)" />
    {/each}

    <!-- Arrow marker defs -->
    <defs>
      <marker id="blue-arrow-{beatIndex}" markerWidth="12" markerHeight="8"
        refX="10" refY="4" orient="auto-start-reverse">
        <path d="M 0 0 L 12 4 L 0 8 Z" fill="var(--prop-blue, #2e8bf0)" />
      </marker>
      <marker id="red-arrow-{beatIndex}" markerWidth="12" markerHeight="8"
        refX="10" refY="4" orient="auto-start-reverse">
        <path d="M 0 0 L 12 4 L 0 8 Z" fill="var(--prop-red, #ed1c24)" />
      </marker>
    </defs>

    <!-- Blue arrow -->
    {#if blueBeat && blueArrowPath}
      <path
        d={blueArrowPath}
        fill="none"
        stroke="var(--prop-blue, #2e8bf0)"
        stroke-width="6"
        stroke-opacity="0.7"
        marker-end="url(#blue-arrow-{beatIndex})"
      />
    {/if}

    <!-- Red arrow -->
    {#if redBeat && redArrowPath}
      <path
        d={redArrowPath}
        fill="none"
        stroke="var(--prop-red, #ed1c24)"
        stroke-width="6"
        stroke-opacity="0.7"
        marker-end="url(#red-arrow-{beatIndex})"
      />
    {/if}

    <!-- Blue prop at start position -->
    {#if blueBeat && bluePropSvg}
      <g
        class="prop-svg"
        style="transform: {propTransform(blueBeat.startPosition, blueBeat.startOrientation, bluePropSvg.center, gridMode)}"
      >
        {@html bluePropSvg.svgContent}
      </g>
    {/if}

    <!-- Red prop at start position -->
    {#if redBeat && redPropSvg}
      <g
        class="prop-svg"
        style="transform: {propTransform(redBeat.startPosition, redBeat.startOrientation, redPropSvg.center, gridMode)}"
      >
        {@html redPropSvg.svgContent}
      </g>
    {/if}
  </svg>

  <!-- Beat number label -->
  <span class="beat-label">{beatIndex + 1}</span>
</div>

<style>
  .strip-beat-cell {
    position: relative;
    flex-shrink: 0;
    width: var(--cell-size, 90px);
    height: var(--cell-size, 90px);
  }

  .strip-beat-cell svg {
    width: 100%;
    height: 100%;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .prop-svg {
    transform-origin: 0 0;
  }

  .beat-label {
    position: absolute;
    bottom: 2px;
    right: 4px;
    font-size: 10px;
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    pointer-events: none;
  }
</style>
