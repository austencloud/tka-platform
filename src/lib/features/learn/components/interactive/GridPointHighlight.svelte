<!--
GridPointHighlight - Single grid with point type highlighting
Shows all points but highlights one type at a time with high-contrast visibility.
Highlighted points are white on dark backgrounds, black on light backgrounds.
Used in the Point Types lesson step.
-->
<script lang="ts">
  type GridType = "diamond" | "box";
  type HighlightPhase = "center" | "hand" | "outer";

  let { gridType = "diamond", highlightPhase = "center" } = $props<{
    gridType: GridType;
    highlightPhase: HighlightPhase;
  }>();

  // Grid geometry - EXACT values from static/images/grid/diamond_grid.svg
  const SIZE = 950;
  const CENTER = 475;
  const OUTER_RADIUS = 300;
  const HAND_RADIUS = 143.1;
  const POINT_RADIUS = 25;
  const HAND_POINT_RADIUS = 8;
  const CENTER_POINT_RADIUS = 12;

  // Diamond mode: Cardinal directions (N, E, S, W)
  const diamondPoints = {
    center: { x: CENTER, y: CENTER },
    hand: [
      { x: CENTER, y: CENTER - HAND_RADIUS }, // N
      { x: CENTER + HAND_RADIUS, y: CENTER }, // E
      { x: CENTER, y: CENTER + HAND_RADIUS }, // S
      { x: CENTER - HAND_RADIUS, y: CENTER }, // W
    ],
    outer: [
      { x: CENTER, y: CENTER - OUTER_RADIUS }, // N
      { x: CENTER + OUTER_RADIUS, y: CENTER }, // E
      { x: CENTER, y: CENTER + OUTER_RADIUS }, // S
      { x: CENTER - OUTER_RADIUS, y: CENTER }, // W
    ],
  };

  // Box mode: Intercardinal directions (NE, SE, SW, NW)
  const diag = OUTER_RADIUS * Math.cos(Math.PI / 4);
  const handDiag = HAND_RADIUS * Math.cos(Math.PI / 4);
  const boxPoints = {
    center: { x: CENTER, y: CENTER },
    hand: [
      { x: CENTER + handDiag, y: CENTER - handDiag }, // NE
      { x: CENTER + handDiag, y: CENTER + handDiag }, // SE
      { x: CENTER - handDiag, y: CENTER + handDiag }, // SW
      { x: CENTER - handDiag, y: CENTER - handDiag }, // NW
    ],
    outer: [
      { x: CENTER + diag, y: CENTER - diag }, // NE
      { x: CENTER + diag, y: CENTER + diag }, // SE
      { x: CENTER - diag, y: CENTER + diag }, // SW
      { x: CENTER - diag, y: CENTER - diag }, // NW
    ],
  };

  const points = $derived(gridType === "diamond" ? diamondPoints : boxPoints);
</script>

<div class="grid-point-highlight">
  <svg viewBox="0 0 {SIZE} {SIZE}" class="highlight-svg">
    <!-- Background -->
    <rect class="grid-bg" x="0" y="0" width={SIZE} height={SIZE} rx="8" />

    <!-- Outer points -->
    {#each points.outer as point, i}
      <circle
        cx={point.x}
        cy={point.y}
        r={POINT_RADIUS}
        class="point outer-point"
        class:highlighted={highlightPhase === "outer"}
        style="--anim-delay: {i * 100}ms"
        data-index={i}
      />
    {/each}

    <!-- Hand points -->
    {#each points.hand as point, i}
      <circle
        cx={point.x}
        cy={point.y}
        r={HAND_POINT_RADIUS}
        class="point hand-point"
        class:highlighted={highlightPhase === "hand"}
        style="--anim-delay: {i * 100}ms"
        data-index={i}
      />
    {/each}

    <!-- Center point -->
    <circle
      cx={points.center.x}
      cy={points.center.y}
      r={CENTER_POINT_RADIUS}
      class="point center-point"
      class:highlighted={highlightPhase === "center"}
      style="--anim-delay: 0ms"
    />
  </svg>
</div>

<style>
  .grid-point-highlight {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .highlight-svg {
    width: 100%;
    height: auto;
    max-width: 320px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .grid-bg {
    fill: #ffffff;
    transition: fill var(--duration-fast) ease-out;
  }

  :global(:root.dark) .grid-bg {
    fill: var(--dm-pictograph-bg, #0a0a0f);
  }

  :global(:root.dark) .highlight-svg {
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.15),
      0 2px 8px rgba(0, 0, 0, 0.3);
  }

  /* Base point styles - very muted when not highlighted */
  .point {
    fill: #d1d5db;
    opacity: 0.4;
    transition:
      fill 300ms ease-out,
      opacity 300ms ease-out,
      transform 300ms ease-out;
    transform-origin: center;
    transform-box: fill-box;
  }

  :global(:root.dark) .point {
    fill: #374151;
    opacity: 0.5;
  }

  /* Highlighted points - high contrast, bold and visible */
  .point.highlighted {
    /* Light mode: dark fill for contrast against white background */
    fill: #1f2937;
    opacity: 1;
    animation: pointHighlight 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    animation-delay: var(--anim-delay, 0ms);
  }

  :global(:root.dark) .point.highlighted {
    /* Dark mode: bright white for contrast against dark background */
    fill: #ffffff;
    opacity: 1;
  }

  @keyframes pointHighlight {
    0% {
      transform: scale(1);
    }
    40% {
      transform: scale(1.4);
    }
    70% {
      transform: scale(0.95);
    }
    100% {
      transform: scale(1.15);
    }
  }

  /* Responsive */
  @media (max-width: 700px) {
    .highlight-svg {
      max-width: 260px;
    }
  }

  @media (max-width: 500px) {
    .highlight-svg {
      max-width: 220px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .point {
      transition: none;
    }

    .point.highlighted {
      animation: none;
      transform: scale(1.1);
    }
  }
</style>
