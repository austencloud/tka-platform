<!--
PositionVisualizer - Interactive 8-point grid showing two hand positions
Uses the real GridSvg component in merged mode for accurate TKA grid geometry.
Overlays blue/red hand circles at correct hand point positions.
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import GridSvg from "$lib/shared/pictograph/grid/components/GridSvg.svelte";

  type HandPosition = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
  type PositionType = "alpha" | "beta" | "gamma";

  let {
    leftHand = $bindable<HandPosition>("N"),
    rightHand = $bindable<HandPosition>("S"),
    interactive = false,
    showLabels = true,
    highlightType = null as PositionType | null,
    onPositionChange,
  } = $props<{
    leftHand?: HandPosition;
    rightHand?: HandPosition;
    interactive?: boolean;
    showLabels?: boolean;
    highlightType?: PositionType | null;
    onPositionChange?: (left: HandPosition, right: HandPosition) => void;
  }>();

  const hapticService = container.items.hapticFeedback;

  // =========================================================================
  // Real grid geometry from grid-merge-constants.ts
  // =========================================================================
  const CENTER = 475;
  const HAND_RADIUS = 143.1;
  const handDiag = HAND_RADIUS * Math.cos(Math.PI / 4); // ~101.17

  const HAND_POINT_COORDS: Record<HandPosition, { x: number; y: number }> = {
    N:  { x: CENTER, y: CENTER - HAND_RADIUS },
    E:  { x: CENTER + HAND_RADIUS, y: CENTER },
    S:  { x: CENTER, y: CENTER + HAND_RADIUS },
    W:  { x: CENTER - HAND_RADIUS, y: CENTER },
    NE: { x: CENTER + handDiag, y: CENTER - handDiag },
    SE: { x: CENTER + handDiag, y: CENTER + handDiag },
    SW: { x: CENTER - handDiag, y: CENTER + handDiag },
    NW: { x: CENTER - handDiag, y: CENTER - handDiag },
  };

  // Hand indicator sizing (in SVG coordinate space)
  const HAND_CIRCLE_R = 20;
  const HAND_GLOW_R = 35;
  const HIT_AREA_R = 50;
  const BETA_OFFSET = 15; // x-offset when both hands at same point

  // =========================================================================
  // Position type detection
  // =========================================================================
  const OPPOSITE_PAIRS: Record<string, string> = {
    N: "S", S: "N", E: "W", W: "E",
    NE: "SW", SW: "NE", NW: "SE", SE: "NW",
  };

  function areAdjacent(p1: string, p2: string): boolean {
    const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const i1 = points.indexOf(p1);
    const i2 = points.indexOf(p2);
    const diff = Math.abs(i1 - i2);
    return diff === 2 || diff === 6;
  }

  const currentPositionType = $derived((): PositionType => {
    if (leftHand === rightHand) return "beta";
    if (OPPOSITE_PAIRS[leftHand] === rightHand) return "alpha";
    if (areAdjacent(leftHand, rightHand)) return "gamma";
    return "gamma";
  });

  // =========================================================================
  // Hand colors
  // =========================================================================
  const LEFT_HAND_COLOR = "var(--prop-blue, #4A9EFF)";
  const RIGHT_HAND_COLOR = "var(--prop-red, #FF4A9E)";

  // =========================================================================
  // Derived hand positions (for smooth CSS transitions)
  // =========================================================================
  const leftPos = $derived(HAND_POINT_COORDS[leftHand as HandPosition]);
  const rightPos = $derived(HAND_POINT_COORDS[rightHand as HandPosition]);
  const isBeta = $derived(leftHand === rightHand);

  // =========================================================================
  // Interactive mode
  // =========================================================================
  let selectingHand = $state<"left" | "right" | null>(null);

  function handlePointClick(point: HandPosition) {
    if (!interactive) return;
    hapticService?.trigger("selection");

    if (!selectingHand) {
      const lp = HAND_POINT_COORDS[leftHand as HandPosition];
      const rp = HAND_POINT_COORDS[rightHand as HandPosition];
      const tp = HAND_POINT_COORDS[point];
      const leftDist = Math.hypot(lp.x - tp.x, lp.y - tp.y);
      const rightDist = Math.hypot(rp.x - tp.x, rp.y - tp.y);

      if (leftDist < rightDist) {
        leftHand = point;
      } else {
        rightHand = point;
      }
    } else if (selectingHand === "left") {
      leftHand = point;
      selectingHand = null;
    } else {
      rightHand = point;
      selectingHand = null;
    }

    onPositionChange?.(leftHand as HandPosition, rightHand as HandPosition);
  }

  function selectHand(hand: "left" | "right") {
    if (!interactive) return;
    selectingHand = selectingHand === hand ? null : hand;
    hapticService?.trigger("selection");
  }
</script>

<div class="position-visualizer" class:interactive>
  <svg viewBox="0 0 950 950" class="position-grid-svg">
    <!-- Grid background matching LessonGridDisplay -->
    <rect class="grid-background" width="950" height="950" rx="8" />

    <!-- Real grids in merged mode (all 8 hand points visible) -->
    <g class="merged-grids">
      <GridSvg gridMode={GridMode.DIAMOND} />
      <GridSvg gridMode={GridMode.BOX} />
    </g>

    <!-- Interactive hit areas (invisible, large touch targets) -->
    {#if interactive}
      {#each Object.entries(HAND_POINT_COORDS) as [key, point]}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <circle
          cx={point.x}
          cy={point.y}
          r={HIT_AREA_R}
          fill="transparent"
          class="hit-area"
          class:clickable={interactive}
          onclick={() => handlePointClick(key as HandPosition)}
          onkeydown={(e) =>
            (e.key === "Enter" || e.key === " ") &&
            handlePointClick(key as HandPosition)}
          role="button"
          tabindex={0}
          aria-label="{key} position"
        />
      {/each}
    {/if}

    <!-- Hand indicators -->
    {#if isBeta}
      <!-- Beta: both hands at same point, offset so both visible -->
      <circle
        class="hand-glow left-glow"
        cx={leftPos.x - BETA_OFFSET}
        cy={leftPos.y}
        r={HAND_GLOW_R}
      />
      <circle
        class="hand-indicator left-hand"
        cx={leftPos.x - BETA_OFFSET}
        cy={leftPos.y}
        r={HAND_CIRCLE_R}
      />
      <circle
        class="hand-glow right-glow"
        cx={rightPos.x + BETA_OFFSET}
        cy={rightPos.y}
        r={HAND_GLOW_R}
      />
      <circle
        class="hand-indicator right-hand"
        cx={rightPos.x + BETA_OFFSET}
        cy={rightPos.y}
        r={HAND_CIRCLE_R}
      />
    {:else}
      <!-- Non-beta: hands at separate points -->
      <circle
        class="hand-glow left-glow"
        cx={leftPos.x}
        cy={leftPos.y}
        r={HAND_GLOW_R}
      />
      <circle
        class="hand-indicator left-hand"
        cx={leftPos.x}
        cy={leftPos.y}
        r={HAND_CIRCLE_R}
      />
      <circle
        class="hand-glow right-glow"
        cx={rightPos.x}
        cy={rightPos.y}
        r={HAND_GLOW_R}
      />
      <circle
        class="hand-indicator right-hand"
        cx={rightPos.x}
        cy={rightPos.y}
        r={HAND_CIRCLE_R}
      />
    {/if}

    <!-- Direction labels -->
    {#if showLabels}
      {#each Object.entries(HAND_POINT_COORDS) as [key, point]}
        {@const labelOffset = 45}
        {@const dx = point.x - CENTER}
        {@const dy = point.y - CENTER}
        {@const dist = Math.hypot(dx, dy) || 1}
        <text
          x={point.x + (dx / dist) * labelOffset}
          y={point.y + (dy / dist) * labelOffset}
          text-anchor="middle"
          dominant-baseline="middle"
          class="point-label"
        >
          {key}
        </text>
      {/each}
    {/if}
  </svg>

  <!-- Hand legend (interactive mode) -->
  {#if interactive}
    <div class="hand-legend">
      <button
        class="legend-item"
        class:selecting={selectingHand === "left"}
        onclick={() => selectHand("left")}
      >
        <div class="legend-dot left-dot"></div>
        <span>Left Hand: {leftHand}</span>
      </button>
      <button
        class="legend-item"
        class:selecting={selectingHand === "right"}
        onclick={() => selectHand("right")}
      >
        <div class="legend-dot right-dot"></div>
        <span>Right Hand: {rightHand}</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .position-visualizer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .position-visualizer.interactive {
    padding: 0.5rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid color-mix(in srgb, var(--prop-blue, #4a9eff) 30%, transparent);
    border-radius: 16px;
  }

  /* Grid SVG container */
  .position-grid-svg {
    width: 100%;
    max-width: 320px;
    height: auto;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px var(--theme-shadow, rgba(0, 0, 0, 0.1));
  }

  /* Background respects light/dark mode - matches LessonGridDisplay */
  .grid-background {
    fill: var(--lm-pictograph-bg, #ffffff);
    transition: fill var(--duration-fast) ease-out;
  }

  :global(:root.dark) .grid-background {
    fill: var(--dm-pictograph-bg, #0a0a0f);
  }

  :global(:root.dark) .position-grid-svg {
    box-shadow:
      0 0 0 1px var(--theme-stroke, rgba(255, 255, 255, 0.15)),
      0 2px 8px color-mix(in srgb, var(--theme-shadow, #000) 30%, transparent);
  }

  /* Hand indicators - smooth transitions when positions change */
  .hand-indicator,
  .hand-glow {
    transition:
      cx 0.4s cubic-bezier(0.33, 1, 0.68, 1),
      cy 0.4s cubic-bezier(0.33, 1, 0.68, 1);
  }

  .left-hand {
    fill: var(--prop-blue, #4A9EFF);
  }

  .right-hand {
    fill: var(--prop-red, #FF4A9E);
  }

  .left-glow {
    fill: var(--prop-blue, #4A9EFF);
    opacity: 0.25;
    animation: handPulse 2s ease-in-out infinite;
  }

  .right-glow {
    fill: var(--prop-red, #FF4A9E);
    opacity: 0.25;
    animation: handPulse 2s ease-in-out infinite 0.5s;
  }

  @keyframes handPulse {
    0%, 100% { opacity: 0.25; }
    50% { opacity: 0.4; }
  }

  /* Hit areas */
  .hit-area {
    cursor: default;
  }

  .hit-area.clickable {
    cursor: pointer;
  }

  .hit-area.clickable:hover {
    fill: rgba(255, 255, 255, 0.05);
  }

  /* Point labels */
  .point-label {
    font-size: 28px;
    font-weight: 600;
    fill: var(--theme-text, #374151);
    font-family: system-ui, -apple-system, sans-serif;
    pointer-events: none;
    user-select: none;
  }

  :global(:root.dark) .point-label {
    fill: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* Hand legend */
  .hand-legend {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) ease;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .legend-item:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .legend-item.selecting {
    background: color-mix(in srgb, var(--prop-blue, #4a9eff) 15%, transparent);
    border-color: color-mix(in srgb, var(--prop-blue, #4a9eff) 40%, transparent);
  }

  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .left-dot {
    background: var(--prop-blue, #4A9EFF);
  }

  .right-dot {
    background: var(--prop-red, #FF4A9E);
  }

  @media (max-width: 400px) {
    .hand-legend {
      flex-direction: column;
      gap: 0.5rem;
    }

    .legend-item {
      width: 100%;
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hand-glow {
      animation: none;
    }

    .hand-indicator,
    .hand-glow {
      transition: none;
    }
  }
</style>
